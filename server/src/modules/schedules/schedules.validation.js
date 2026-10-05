// HIPO 3.2 – Schedule Plotter
// Pure request checks for schedule entries (no database): days, times, grade levels and the
// shape of a class row (subject + teacher + room) or an activity row (BREAK, LUNCH, ...).
const { HttpError } = require('../../utils/httpError')

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ENTRY_STATUSES = ['draft', 'pending', 'approved', 'rejected']
const MAX_ENTRIES_PER_REQUEST = 600

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

// Turns one request row into a clean entry. Accepts either start_min/end_min or
// start_time ("07:30") with end_time or duration_minutes.
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
  const teacherId = positiveIdOrNull(raw.teacher_id)
  const roomId = positiveIdOrNull(raw.room_id)
  const activity = String(raw.activity || '').trim().slice(0, 100) || null
  if (subjectId) {
    if (!teacherId || !roomId || activity) throw new HttpError(400, 'A class row needs one subject, one teacher and one room.')
  } else if (teacherId || roomId || !activity) {
    throw new HttpError(400, 'A break or activity row needs an activity name and no teacher or room.')
  }

  return {
    entry_id: positiveIdOrNull(raw.entry_id),
    term_id: termId ?? requireId(raw.term_id, 'term_id'),
    section_id: sectionId ?? requireId(raw.section_id, 'section_id'),
    subject_id: subjectId,
    teacher_id: teacherId,
    room_id: roomId,
    activity: subjectId ? null : activity,
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

// Adds readable times to an entry for API responses.
const withTimes = entry => ({ ...entry, start_time: formatMinutes(entry.start_min), end_time: formatMinutes(entry.end_min) })

module.exports = {
  WEEK_DAYS,
  ENTRY_STATUSES,
  toMinutes,
  formatMinutes,
  gradeOf,
  schoolLevelOf,
  positiveIdOrNull,
  requireId,
  normalizeEntry,
  normalizeEntries,
  withTimes
}
