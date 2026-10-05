// HIPO 3.2 – Schedule Plotter
// Pure request checks for schedule entries (no database): days, times, grade levels and the
// shape of a class row (subject + 1–2 teachers + room unless asynchronous) or an activity row (BREAK, LUNCH, ...).
const { HttpError } = require('../../utils/httpError')

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ENTRY_STATUSES = ['draft', 'pending', 'approved', 'rejected']
const MAX_ENTRIES_PER_REQUEST = 600
const DELIVERY_MODES = ['face_to_face', 'asynchronous']
const MAX_TEACHERS_PER_ENTRY = 2
const DAY_PATTERNS = ['MON_THU', 'MON', 'TUE', 'WED', 'THU', 'FRI']

// "07:30" or "07:30:00" -> 450 (minutes after midnight); anything else -> null.
const toMinutes = value => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(String(value ?? ''))
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

// 450 -> "07:30"
const formatMinutes = minutes => {
  const hours = Math.floor(minutes / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

// "Grade 7", "grade 11 - STEM" -> 7, 11; null when no grade 7–12 is found.
const gradeOf = gradeLevelName => {
  const match = String(gradeLevelName || '').match(/\b(?:grade\s*)?(7|8|9|10|11|12)\b/i)
  return match ? Number(match[1]) : null
}

// Grades 7–10 are Junior High School, 11–12 are Senior High School.
const schoolLevelOf = gradeLevelName => {
  const grade = gradeOf(gradeLevelName)
  if (!grade) return null
  return grade <= 10 ? 'JHS' : 'SHS'
}

const positiveIdOrNull = value => {
  if (value === undefined || value === null || value === '') return null
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, `"${value}" is not a valid id.`)
  return id
}

const requireId = (value, label) => {
  const id = positiveIdOrNull(value)
  if (!id) throw new HttpError(400, `${label} is required.`)
  return id
}

// teacher_ids [primary, co-teacher?] or a single teacher_id -> 0–2 distinct ids, primary first.
const normalizeTeacherIds = raw => {
  if (raw.teacher_ids === undefined || raw.teacher_ids === null) {
    const single = positiveIdOrNull(raw.teacher_id)
    return single ? [single] : []
  }
  if (!Array.isArray(raw.teacher_ids)) throw new HttpError(400, 'teacher_ids must be a list of teacher ids.')
  const ids = raw.teacher_ids.map(positiveIdOrNull).filter(Boolean)
  if (ids.length > MAX_TEACHERS_PER_ENTRY) throw new HttpError(400, `A class has at most ${MAX_TEACHERS_PER_ENTRY} teachers.`)
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'The same teacher is listed twice for one class.')
  const single = positiveIdOrNull(raw.teacher_id)
  if (single && ids.length && single !== ids[0]) throw new HttpError(400, 'teacher_id must be the first of teacher_ids.')
  return ids
}

// Turns one request row into a clean entry. Accepts either start_min/end_min or
// start_time ("07:30") with end_time or duration_minutes. A class row has 1–2 teachers
// (teacher_ids, or teacher_id) and a room unless delivery_mode is "asynchronous".
const normalizeEntry = (raw, { termId, sectionId } = {}) => {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'Each schedule row must be an object.')
  const day = String(raw.day_of_week || '')
  if (!WEEK_DAYS.includes(day)) throw new HttpError(400, 'Each row needs a weekday from Monday to Saturday.')

  const startMin = raw.start_min !== undefined ? Number(raw.start_min) : toMinutes(raw.start_time)
  let endMin = raw.end_min !== undefined ? Number(raw.end_min) : toMinutes(raw.end_time)
  if (endMin === null && raw.duration_minutes !== undefined && startMin !== null) endMin = startMin + Number(raw.duration_minutes)
  if (!Number.isInteger(startMin) || !Number.isInteger(endMin)) throw new HttpError(400, 'Each row needs a valid 24-hour start time and an end time or duration.')
  if (startMin < 0 || endMin > 1440 || startMin >= endMin) throw new HttpError(400, 'The end time must be after the start time, within the same day.')

  const subjectId = positiveIdOrNull(raw.subject_id)
  const teacherIds = normalizeTeacherIds(raw)
  const roomId = positiveIdOrNull(raw.room_id)
  const activity = String(raw.activity || '').trim().slice(0, 100) || null
  const deliveryMode = raw.delivery_mode === undefined || raw.delivery_mode === null || raw.delivery_mode === '' ? 'face_to_face' : raw.delivery_mode
  if (!DELIVERY_MODES.includes(deliveryMode)) throw new HttpError(400, `delivery_mode must be one of: ${DELIVERY_MODES.join(', ')}.`)
  if (subjectId) {
    if (!teacherIds.length || activity) throw new HttpError(400, 'A class row needs one subject and one or two teachers.')
    if (!roomId && deliveryMode === 'face_to_face') throw new HttpError(400, 'A face-to-face class needs a room.')
  } else if (teacherIds.length || roomId || !activity) {
    throw new HttpError(400, 'A break or activity row needs an activity name and no teacher or room.')
  } else if (deliveryMode !== 'face_to_face') {
    throw new HttpError(400, 'Only a class can be asynchronous.')
  }

  return {
    entry_id: positiveIdOrNull(raw.entry_id),
    term_id: termId ?? requireId(raw.term_id, 'term_id'),
    section_id: sectionId ?? requireId(raw.section_id, 'section_id'),
    subject_id: subjectId,
    teacher_id: teacherIds[0] || null,
    teacher_ids: teacherIds,
    room_id: roomId,
    activity: subjectId ? null : activity,
    delivery_mode: deliveryMode,
    day_of_week: day,
    start_min: startMin,
    end_min: endMin
  }
}

const normalizeEntries = (rawEntries, options) => {
  if (!Array.isArray(rawEntries)) throw new HttpError(400, 'entries must be an array.')
  if (rawEntries.length > MAX_ENTRIES_PER_REQUEST) throw new HttpError(400, `Send at most ${MAX_ENTRIES_PER_REQUEST} rows at a time.`)
  return rawEntries.map(raw => normalizeEntry(raw, options))
}

const normalizeDayPattern = value => {
  const pattern = String(value || '').toUpperCase()
  if (!DAY_PATTERNS.includes(pattern)) throw new HttpError(400, `day_pattern must be one of: ${DAY_PATTERNS.join(', ')}.`)
  return pattern
}

// Query of GET /api/schedules/available-rooms -> { term_id, day_pattern | day_of_week, start_min, end_min, section_id, entry_id }.
const normalizeSlotQuery = query => {
  const slot = { term_id: requireId(query.term_id, 'term_id'), section_id: positiveIdOrNull(query.section_id), entry_id: positiveIdOrNull(query.entry_id) }
  if (query.day_pattern) slot.day_pattern = normalizeDayPattern(query.day_pattern)
  else if (WEEK_DAYS.includes(query.day_of_week)) slot.day_of_week = query.day_of_week
  else throw new HttpError(400, 'Give a day_pattern (e.g. MON_THU) or a day_of_week (e.g. Monday).')
  slot.start_min = query.start_min !== undefined ? Number(query.start_min) : toMinutes(query.start_time)
  slot.end_min = query.end_min !== undefined ? Number(query.end_min) : toMinutes(query.end_time)
  if (!Number.isInteger(slot.start_min) || !Number.isInteger(slot.end_min) || slot.start_min < 0 || slot.end_min > 1440 || slot.start_min >= slot.end_min) {
    throw new HttpError(400, 'Give a valid start_time and a later end_time (24-hour, e.g. 07:30).')
  }
  return slot
}

// Adds readable times to an entry for API responses.
const withTimes = entry => ({ ...entry, start_time: formatMinutes(entry.start_min), end_time: formatMinutes(entry.end_min) })

module.exports = {
  WEEK_DAYS,
  ENTRY_STATUSES,
  DELIVERY_MODES,
  MAX_TEACHERS_PER_ENTRY,
  DAY_PATTERNS,
  toMinutes,
  formatMinutes,
  gradeOf,
  schoolLevelOf,
  positiveIdOrNull,
  requireId,
  normalizeEntry,
  normalizeEntries,
  normalizeDayPattern,
  normalizeSlotQuery,
  withTimes
}
