// HIPO 3.2 – Schedule Plotter: conflict detection (API level)
// Checks a proposed schedule entry against CLAUDE.md "Scheduling Rules" and returns EVERY problem at once.
//
//   type             rule
//   teacher          a teacher of the entry (primary or co-teacher, entry_teachers) already teaches at that time
//   room             the room is already used at that time (face_to_face only; an asynchronous class uses no room)
//   section          the section already has something at that time
//   time_slot        the entry is not inside a "class" slot of the section's time template (e.g. on BREAK or LUNCH)
//   qualification    a teacher is not qualified for the subject (teacher_subjects);
//                    the section's class adviser may always teach its homeroom subject (HGP / Homeroom)
//   teacher_load     a teacher goes over max_subject_load or weekly_load_minutes
//   weekly_minutes   the section gets more minutes of the subject than subjects.weekly_minutes
//   subject_teacher  the subject already has other teacher(s) in this section (one teacher per subject per week)
//   subject          the subject does not belong to the section's grade level
//   invalid          a teacher, room, subject or section does not exist
//
// Overlap rule: two entries clash when they share a day AND their minute ranges overlap:
//   a.start_min < b.end_min AND b.start_min < a.end_min
// The ranges are half-open, so back-to-back periods (07:15–08:00, then 08:00–09:20) do not clash.
// An entry has one weekday (day_of_week, how rows are saved) or a day pattern (day_pattern). MON_THU stands
// for Monday–Thursday, so it overlaps a Monday, Tuesday, Wednesday or Thursday row, but never a Friday row.
// Every grade level is compared with every other, so a teacher or room shared by JHS and SHS is caught too.
//
// Layout: pure functions (no database) do all the work, so the unit tests and Auto-Generate call them
// directly. loadConflictContext() reads one term from PostgreSQL in a few queries. The async functions at
// the bottom (checkConflicts, getTeacherAvailability, getAvailableRooms) put the two together.
// The database repeats the overlap rules with exclusion constraints (entryTeachers.migration.js) – change both together.
const pool = require('../../config/database')
const { WEEK_DAYS, formatMinutes, schoolLevelOf } = require('./schedules.validation')

const DEFAULT_MAX_SUBJECT_LOAD = 5
const MAX_ALTERNATIVE_ROOMS = 5
const SHS_GRID_MINUTES = 30
const LEVEL_NAMES = { JHS: 'Junior High School', SHS: 'Senior High School' }

// The weekdays behind each day pattern (the same patterns as time_template_slots.day_pattern).
const PATTERN_DAYS = {
  MON_THU: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
  MON: ['Monday'],
  TUE: ['Tuesday'],
  WED: ['Wednesday'],
  THU: ['Thursday'],
  FRI: ['Friday']
}
const DAY_PATTERNS = Object.keys(PATTERN_DAYS) // same list as schedules.validation.js DAY_PATTERNS

// ---------------------------------------------------------------------------------------------
// Days and minutes
// ---------------------------------------------------------------------------------------------

const daysOf = entry => entry.day_pattern ? PATTERN_DAYS[entry.day_pattern] || [] : [entry.day_of_week]
const shareADay = (a, b) => daysOf(a).some(day => daysOf(b).includes(day))
const minutesOverlap = (a, b) => a.start_min < b.end_min && b.start_min < a.end_min
const timesOverlap = (a, b) => shareADay(a, b) && minutesOverlap(a, b)

// Minutes per week: a MON_THU entry counts four times.
const weeklyMinutesOf = entry => (entry.end_min - entry.start_min) * daysOf(entry).length
const totalWeeklyMinutes = entries => entries.reduce((total, entry) => total + weeklyMinutesOf(entry), 0)

const dayLabel = entry => entry.day_pattern === 'MON_THU' ? 'Monday–Thursday' : daysOf(entry).join(', ')
const rangeLabel = item => `${formatMinutes(item.start_min)}–${formatMinutes(item.end_min)}`
const whenLabel = entry => `${dayLabel(entry)} ${rangeLabel(entry)}`

// ---------------------------------------------------------------------------------------------
// Entries and names
// ---------------------------------------------------------------------------------------------

// Every teacher of an entry, primary first (rows from before co-teaching only have teacher_id).
const teacherIdsOf = entry => entry.teacher_ids?.length ? entry.teacher_ids : entry.teacher_id ? [entry.teacher_id] : []
const teacherSetKey = entry => [...teacherIdsOf(entry)].sort((a, b) => a - b).join(',')
const usesRoom = entry => Boolean(entry.room_id) && entry.delivery_mode !== 'asynchronous'
const isSameEntry = (a, b) => Boolean(a.entry_id) && a.entry_id === b.entry_id

// HGP (Junior High) and Homeroom (Senior High) are taught by the section's class adviser.
const isHomeroomSubject = subject => /\b(hgp|homeroom)\b/i.test(subject?.subject_name || '')

const sectionLabel = (sectionId, context) => context.sections.get(sectionId)?.label || `Section #${sectionId}`
const subjectName = (subjectId, context) => context.subjects.get(subjectId)?.subject_name || `Subject #${subjectId}`
const teacherName = (teacherId, context) => context.teachers.get(teacherId)?.name || `Teacher #${teacherId}`
const roomLabel = (roomId, context) => context.rooms.get(roomId)?.label || `Room #${roomId}`

// "Math 7" for a class row, "BREAK" for an activity row.
const whatOf = (entry, context) => entry.subject_id ? subjectName(entry.subject_id, context) : entry.activity

// "Grade 7 - Mabini (Math 7)"
const describeEntry = (entry, context) => `${sectionLabel(entry.section_id, context)} (${whatOf(entry, context)})`

const conflictOf = (type, entry, message, extra = {}) => ({
  type,
  message,
  day_of_week: entry.day_of_week ?? null,
  ...(entry.day_pattern ? { day_pattern: entry.day_pattern } : {}),
  start_time: formatMinutes(entry.start_min),
  end_time: formatMinutes(entry.end_min),
  ...extra
})

const otherEntryId = other => other.entry_id ? { conflicting_entry_id: other.entry_id } : {}

// ---------------------------------------------------------------------------------------------
// Time templates
// ---------------------------------------------------------------------------------------------

const templateFor = (section, templates) => section ? templates.get(section.grade_level_id) || null : null

// The template's slots for one weekday, by start time. A template uses MON_THU or MON..THU, never both.
const daySlotsFor = (template, day) => {
  const patterns = DAY_PATTERNS.filter(pattern => PATTERN_DAYS[pattern].includes(day))
  const used = patterns.find(pattern => template.slots.some(slot => slot.day_pattern === pattern))
  return used ? template.slots.filter(slot => slot.day_pattern === used).sort((a, b) => a.start_min - b.start_min) : []
}

// True when [start, end) is fully covered by back-to-back slots that pass `allowed`.
const coveredBySlots = (start, end, slots, allowed) => {
  let cursor = start
  while (cursor < end) {
    const slot = slots.find(item => allowed(item) && item.start_min <= cursor && cursor < item.end_min)
    if (!slot) return false
    cursor = slot.end_min
  }
  return true
}

// Senior High: on the 30-minute grid and inside the day's class slots (an activity may also use breaks).
const checkShsDay = (entry, day, section, slots) => {
  if (entry.start_min % SHS_GRID_MINUTES || entry.end_min % SHS_GRID_MINUTES) {
    return `${LEVEL_NAMES.SHS} classes use a ${SHS_GRID_MINUTES}-minute grid; ${rangeLabel(entry)} does not start and end on it.`
  }
  const allowed = slot => !entry.subject_id || slot.slot_type === 'class'
  if (coveredBySlots(entry.start_min, entry.end_min, slots, allowed)) return null
  const classTimes = slots.filter(slot => slot.slot_type === 'class').map(rangeLabel).join(', ')
  return `${rangeLabel(entry)} is outside the ${day} class times of ${section.grade_level_name} (${classTimes}).`
}

// Junior High: exactly one period of the day, and a class only in a "class" period.
const checkJhsDay = (entry, day, section, slots) => {
  const slot = slots.find(item => item.start_min === entry.start_min && item.end_min === entry.end_min)
  if (!slot) {
    const classTimes = slots.filter(item => item.slot_type === 'class').map(rangeLabel).join(', ')
    return `${rangeLabel(entry)} is not a ${day} period of ${section.grade_level_name}. Periods: ${classTimes}.`
  }
  if (entry.subject_id && slot.slot_type !== 'class') {
    return `${rangeLabel(entry)} is ${slot.label || slot.slot_type.toUpperCase()} in the time template; no class can be placed there.`
  }
  return null
}

// The entry must sit in the template's slots on every one of its days. No template yet: nothing to check.
const checkTimeSlot = (entry, section, template) => {
  if (!template) return []
  for (const day of daysOf(entry)) {
    const slots = daySlotsFor(template, day)
    const problem = !slots.length
      ? `${section.grade_level_name} has no classes on ${day} (time template "${template.template_name}").`
      : section.level === 'SHS' ? checkShsDay(entry, day, section, slots) : checkJhsDay(entry, day, section, slots)
    if (problem) return [conflictOf('time_slot', entry, problem)]
  }
  return []
}

// ---------------------------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------------------------

const roomSummary = room => ({ room_id: room.room_id, room_number: room.room_number, building_name: room.building_name, label: room.label })

// Rooms that are free for the whole slot, rooms of the section's own department first.
// slot: { day_of_week | day_pattern, start_min, end_min, section_id?, entry_id? }
const availableRooms = (slot, entries, context) => {
  const busyRoomIds = new Set(entries
    .filter(entry => usesRoom(entry) && !isSameEntry(slot, entry) && timesOverlap(slot, entry))
    .map(entry => entry.room_id))
  const departmentId = context.sections.get(slot.section_id)?.department_id
  const otherDepartment = room => Number(room.department_id !== departmentId)
  return [...context.rooms.values()]
    .filter(room => !busyRoomIds.has(room.room_id))
    .sort((a, b) => otherDepartment(a) - otherDepartment(b) || a.label.localeCompare(b.label))
    .map(roomSummary)
}

// ---------------------------------------------------------------------------------------------
// The checks for one entry (pure). Each returns a list of conflicts.
// ---------------------------------------------------------------------------------------------

// Every id on the entry must exist; the other checks assume it.
const checkReferences = (entry, context) => {
  const missing = []
  if (!context.sections.has(entry.section_id)) missing.push(`Section #${entry.section_id}`)
  if (entry.subject_id && !context.subjects.has(entry.subject_id)) missing.push(`Subject #${entry.subject_id}`)
  teacherIdsOf(entry).filter(id => !context.teachers.has(id)).forEach(id => missing.push(`Teacher #${id}`))
  if (entry.room_id && !context.rooms.has(entry.room_id)) missing.push(`Room #${entry.room_id}`)
  return missing.map(name => conflictOf('invalid', entry, `${name} does not exist.`))
}

// Each teacher of the entry (primary and co-teacher) against each class that teacher already has.
const checkTeacherOverlaps = (entry, others, context) => teacherIdsOf(entry).flatMap(teacherId => others
  .filter(other => teacherIdsOf(other).includes(teacherId) && timesOverlap(entry, other))
  .map(other => conflictOf('teacher', entry,
    `${teacherName(teacherId, context)} is already teaching ${describeEntry(other, context)} on ${whenLabel(other)}.`,
    { teacher_id: teacherId, ...otherEntryId(other) })))

// Face-to-face classes only. Senior High also gets a few free rooms to choose from.
const checkRoomOverlaps = (entry, others, context) => {
  if (!usesRoom(entry)) return []
  const isShs = context.sections.get(entry.section_id)?.level === 'SHS'
  return others
    .filter(other => usesRoom(other) && other.room_id === entry.room_id && timesOverlap(entry, other))
    .map(other => conflictOf('room', entry,
      `${roomLabel(entry.room_id, context)} is already used by ${describeEntry(other, context)} on ${whenLabel(other)}.`,
      { ...otherEntryId(other), ...(isShs ? { alternative_rooms: availableRooms(entry, others, context).slice(0, MAX_ALTERNATIVE_ROOMS) } : {}) }))
}

const checkSectionOverlaps = (entry, others, context) => others
  .filter(other => other.section_id === entry.section_id && timesOverlap(entry, other))
  .map(other => conflictOf('section', entry,
    `${sectionLabel(entry.section_id, context)} already has ${whatOf(other, context)} on ${whenLabel(other)}.`,
    otherEntryId(other)))

const isQualified = (teacherId, subjectId, section, context) =>
  Boolean(context.qualified?.get(subjectId)?.has(teacherId)) ||
  (section.adviser_id === teacherId && isHomeroomSubject(context.subjects.get(subjectId)))

const checkQualification = (entry, section, context) => {
  if (!entry.subject_id) return []
  return teacherIdsOf(entry)
    .filter(teacherId => !isQualified(teacherId, entry.subject_id, section, context))
    .map(teacherId => conflictOf('qualification', entry,
      `${teacherName(teacherId, context)} is not qualified to teach ${subjectName(entry.subject_id, context)} (add it to the teacher's qualified subjects first).`,
      { teacher_id: teacherId }))
}

const checkSubjectGrade = (entry, section, context) => {
  const subject = context.subjects.get(entry.subject_id)
  if (!subject || subject.grade_level_id === section.grade_level_id) return []
  return [conflictOf('subject', entry, `${subject.subject_name} is not a subject of ${section.grade_level_name}.`)]
}

// One teacher (or one co-teaching pair) per subject per section for the whole week.
const checkSubjectTeacher = (entry, others, context) => {
  if (!entry.subject_id) return []
  const other = others.find(item => item.section_id === entry.section_id && item.subject_id === entry.subject_id &&
    teacherSetKey(item) !== teacherSetKey(entry))
  if (!other) return []
  const teachers = teacherIdsOf(other).map(id => teacherName(id, context)).join(' / ')
  return [conflictOf('subject_teacher', entry,
    `${subjectName(entry.subject_id, context)} in ${sectionLabel(entry.section_id, context)} is already taught by ${teachers} (${whenLabel(other)}); a subject keeps the same teacher(s) for the whole week.`)]
}

// ---------------------------------------------------------------------------------------------
// Weekly totals: teacher load and subject minutes (checked over a whole list of entries)
// ---------------------------------------------------------------------------------------------

// Load of one teacher over a list of entries. A co-taught class counts in full for each of its teachers.
const summarizeTeacherLoad = (teacherId, entries, context) => {
  const teacher = context.teachers.get(teacherId)
  const own = entries.filter(entry => teacherIdsOf(entry).includes(teacherId))
  const subjectCount = new Set(own.map(entry => entry.subject_id)).size
  const weeklyMinutes = totalWeeklyMinutes(own)
  const maxSubjects = teacher?.max_subject_load || DEFAULT_MAX_SUBJECT_LOAD
  const maxMinutes = teacher?.weekly_load_minutes || null
  return {
    teacher_id: teacherId,
    teacher_name: teacherName(teacherId, context),
    subject_count: subjectCount,
    max_subject_load: maxSubjects,
    weekly_minutes: weeklyMinutes,
    weekly_load_minutes: maxMinutes,
    ancillary_tasks: teacher?.ancillary_tasks || [],
    overloaded: subjectCount > maxSubjects || (maxMinutes !== null && weeklyMinutes > maxMinutes)
  }
}

const teacherLoadConflicts = (load, entry) => {
  const conflicts = []
  if (load.subject_count > load.max_subject_load) {
    conflicts.push(conflictOf('teacher_load', entry, `${load.teacher_name} would teach ${load.subject_count} different subjects this term (limit ${load.max_subject_load}).`, { teacher_id: load.teacher_id }))
  }
  if (load.weekly_load_minutes !== null && load.weekly_minutes > load.weekly_load_minutes) {
    conflicts.push(conflictOf('teacher_load', entry, `${load.teacher_name} would teach ${load.weekly_minutes} minutes a week (limit ${load.weekly_load_minutes}).`, { teacher_id: load.teacher_id }))
  }
  return conflicts
}

// The section may not get more minutes of a subject than subjects.weekly_minutes (not set: no limit).
const checkWeeklyMinutes = (entry, entries, context) => {
  const subject = context.subjects.get(entry.subject_id)
  if (!subject?.weekly_minutes) return []
  const minutes = totalWeeklyMinutes(entries.filter(item => item.section_id === entry.section_id && item.subject_id === entry.subject_id))
  if (minutes <= subject.weekly_minutes) return []
  return [conflictOf('weekly_minutes', entry,
    `${sectionLabel(entry.section_id, context)} would have ${minutes} minutes of ${subject.subject_name} a week (limit ${subject.weekly_minutes}).`)]
}

const checkWeeklyTotals = (entry, entries, context) => [
  ...teacherIdsOf(entry).flatMap(teacherId => teacherLoadConflicts(summarizeTeacherLoad(teacherId, entries, context), entry)),
  ...checkWeeklyMinutes(entry, entries, context)
]

// ---------------------------------------------------------------------------------------------
// detectConflicts – every check for ONE entry (pure). context.existingEntries holds the term's
// other non-rejected entries; when the entry is an edit, its own saved version is skipped.
// ---------------------------------------------------------------------------------------------
const detectConflicts = (entry, context, { checkTotals = true } = {}) => {
  const invalid = checkReferences(entry, context)
  if (invalid.length) return invalid

  const section = context.sections.get(entry.section_id)
  const others = context.existingEntries.filter(other => !isSameEntry(entry, other))
  return [
    ...checkTeacherOverlaps(entry, others, context),
    ...checkRoomOverlaps(entry, others, context),
    ...checkSectionOverlaps(entry, others, context),
    ...checkTimeSlot(entry, section, templateFor(section, context.templates)),
    ...checkQualification(entry, section, context),
    ...checkSubjectGrade(entry, section, context),
    ...checkSubjectTeacher(entry, others, context),
    ...(checkTotals ? checkWeeklyTotals(entry, [...others, entry], context) : [])
  ]
}

// A list of new entries (e.g. a whole week from the plotter). Each row is compared with the saved
// entries AND the rows before it, so a clash inside the list is reported once, on the later row.
// The weekly totals are checked once per teacher and once per subject over the whole list.
const detectConflictsForEntries = (entries, context) => {
  const conflicts = []
  entries.forEach((entry, index) => {
    const rowContext = { ...context, existingEntries: [...context.existingEntries, ...entries.slice(0, index)] }
    detectConflicts(entry, rowContext, { checkTotals: false }).forEach(conflict => conflicts.push({ ...conflict, entry_index: index }))
  })

  const changedIds = new Set(entries.map(entry => entry.entry_id).filter(Boolean))
  const allEntries = [...context.existingEntries.filter(entry => !changedIds.has(entry.entry_id)), ...entries]
  const firstIndex = test => entries.findIndex(test)

  const teacherIds = [...new Set(entries.flatMap(teacherIdsOf).filter(id => context.teachers.has(id)))]
  const teacherLoads = teacherIds.map(teacherId => summarizeTeacherLoad(teacherId, allEntries, context))
  for (const load of teacherLoads) {
    const index = firstIndex(entry => teacherIdsOf(entry).includes(load.teacher_id))
    teacherLoadConflicts(load, entries[index]).forEach(conflict => conflicts.push({ ...conflict, entry_index: index }))
  }

  const sectionSubjects = new Set(entries.filter(entry => entry.subject_id).map(entry => `${entry.section_id}:${entry.subject_id}`))
  for (const key of sectionSubjects) {
    const index = firstIndex(entry => `${entry.section_id}:${entry.subject_id}` === key)
    checkWeeklyMinutes(entries[index], allEntries, context).forEach(conflict => conflicts.push({ ...conflict, entry_index: index }))
  }
  return { conflicts, teacherLoads }
}

// ---------------------------------------------------------------------------------------------
// Plotter hints (pure): when is a teacher busy, which rooms are free
// ---------------------------------------------------------------------------------------------

const dayIndex = entry => WEEK_DAYS.indexOf(daysOf(entry)[0])
const byDayThenStart = (a, b) => dayIndex(a) - dayIndex(b) || a.start_min - b.start_min

// A teacher's classes on the days of a pattern (MON_THU = Monday–Thursday), for green/red hints.
// With a sectionId, that section's template class slots come back marked available or not.
const teacherAvailability = (teacherId, dayPattern, context, { sectionId = null } = {}) => {
  const probe = { day_pattern: dayPattern }
  const busy = context.existingEntries
    .filter(entry => teacherIdsOf(entry).includes(teacherId) && shareADay(entry, probe))
    .sort(byDayThenStart)
    .map(entry => ({
      entry_id: entry.entry_id, section_id: entry.section_id, day_of_week: entry.day_of_week,
      start_min: entry.start_min, end_min: entry.end_min,
      start_time: formatMinutes(entry.start_min), end_time: formatMinutes(entry.end_min),
      description: describeEntry(entry, context)
    }))
  const result = {
    teacher_id: teacherId,
    teacher_name: teacherName(teacherId, context),
    day_pattern: dayPattern,
    days: PATTERN_DAYS[dayPattern] || [],
    busy,
    load: summarizeTeacherLoad(teacherId, context.existingEntries, context)
  }
  if (!sectionId) return result

  const template = templateFor(context.sections.get(sectionId), context.templates)
  const classSlots = template ? template.slots.filter(slot => slot.day_pattern === dayPattern && slot.slot_type === 'class') : []
  result.slots = classSlots.sort((a, b) => a.start_min - b.start_min).map(slot => {
    const clash = busy.find(item => minutesOverlap(slot, item))
    return {
      start_min: slot.start_min, end_min: slot.end_min,
      start_time: formatMinutes(slot.start_min), end_time: formatMinutes(slot.end_min),
      label: slot.label, available: !clash,
      ...(clash ? { busy_with: `${clash.description} on ${clash.day_of_week}` } : {})
    }
  })
  return result
}

// ---------------------------------------------------------------------------------------------
// Loading the context from PostgreSQL
// ---------------------------------------------------------------------------------------------

// Every time template with its slots, keyed by grade_level_id.
const loadTemplates = async (db = pool) => {
  const result = await db.query(`
    SELECT tt.template_id, tt.template_name, tt.grade_level_id, tt.department_id,
           s.slot_id, s.day_pattern, s.start_min, s.end_min, s.slot_type, s.label, s.default_delivery_mode
    FROM time_templates tt
    LEFT JOIN time_template_slots s ON s.template_id = tt.template_id
    ORDER BY tt.template_id, s.day_pattern, s.start_min
  `)
  const templates = new Map()
  for (const row of result.rows) {
    if (!templates.has(row.grade_level_id)) {
      templates.set(row.grade_level_id, { template_id: row.template_id, template_name: row.template_name, grade_level_id: row.grade_level_id, department_id: row.department_id, slots: [] })
    }
    if (row.slot_id) {
      templates.get(row.grade_level_id).slots.push({
        slot_id: row.slot_id, day_pattern: row.day_pattern, start_min: row.start_min, end_min: row.end_min,
        slot_type: row.slot_type, label: row.label, default_delivery_mode: row.default_delivery_mode
      })
    }
  }
  return templates
}

// teacher_subjects as subject_id -> Set of qualified teacher ids.
const loadQualifications = async (db = pool) => {
  const qualified = new Map()
  for (const row of (await db.query('SELECT teacher_id, subject_id FROM teacher_subjects')).rows) {
    if (!qualified.has(row.subject_id)) qualified.set(row.subject_id, new Set())
    qualified.get(row.subject_id).add(row.teacher_id)
  }
  return qualified
}

// Reads what the checks need for one term. ignoreEntryIds: saved entries that are being replaced.
const loadConflictContext = async ({ termId, ignoreEntryIds = [], db = pool }) => {
  const sections = await db.query(`
    SELECT sec.section_id, sec.section_name, sec.adviser_id, gl.grade_level_id, gl.grade_level_name, gl.department_id
    FROM sections sec JOIN grade_levels gl ON gl.grade_level_id = sec.grade_level_id
  `)
  const entries = await db.query(`
    SELECT e.entry_id, e.term_id, e.section_id, e.subject_id, e.teacher_id, e.room_id, e.activity, e.delivery_mode,
           e.day_of_week, e.start_min, e.end_min, e.status,
           ARRAY(SELECT et.teacher_id FROM entry_teachers et WHERE et.entry_id = e.entry_id
                 ORDER BY et.teacher_id = e.teacher_id DESC, et.teacher_id) AS teacher_ids
    FROM schedule_entries e
    WHERE e.term_id = $1 AND e.status <> 'rejected' AND NOT (e.entry_id = ANY($2::INT[]))
  `, [termId, ignoreEntryIds])
  const teachers = await db.query(`
    SELECT t.teacher_id, COALESCE(u.full_name, t.last_name) AS name, t.max_subject_load,
           t.weekly_load_minutes, t.ancillary_tasks
    FROM teachers t LEFT JOIN users u ON u.user_id = t.user_id
  `)
  const rooms = await db.query(`
    SELECT r.room_id, r.room_number, b.building_name, b.department_id
    FROM rooms r JOIN buildings b ON b.building_id = r.building_id
  `)
  const subjects = await db.query('SELECT subject_id, subject_name, grade_level_id, weekly_minutes, color FROM subjects')

  return {
    termId,
    sections: new Map(sections.rows.map(row => [row.section_id, {
      ...row,
      level: schoolLevelOf(row.grade_level_name),
      label: `${row.grade_level_name} - ${row.section_name}`
    }])),
    templates: await loadTemplates(db),
    qualified: await loadQualifications(db),
    existingEntries: entries.rows,
    teachers: new Map(teachers.rows.map(row => [row.teacher_id, row])),
    rooms: new Map(rooms.rows.map(row => [row.room_id, { ...row, label: `${row.building_name} · Room ${row.room_number}` }])),
    subjects: new Map(subjects.rows.map(row => [row.subject_id, row]))
  }
}

// ---------------------------------------------------------------------------------------------
// API entry points
// ---------------------------------------------------------------------------------------------

// checkConflicts(entry) – all conflicts for one entry. When entry.entry_id is set (an edit),
// the saved version of that entry is ignored.
const checkConflicts = async (entry, { db = pool } = {}) => {
  const context = await loadConflictContext({ termId: entry.term_id, db })
  return detectConflicts(entry, context)
}

// Conflicts for a list of entries in one term (plotter save / live validation).
const checkConflictsForEntries = async (entries, { termId, ignoreEntryIds = [], db = pool }) => {
  const context = await loadConflictContext({ termId, ignoreEntryIds, db })
  return detectConflictsForEntries(entries, context)
}

// When the teacher is busy on a day pattern (null when the teacher does not exist).
const getTeacherAvailability = async (teacherId, termId, dayPattern, { sectionId = null, db = pool } = {}) => {
  const context = await loadConflictContext({ termId, db })
  if (!context.teachers.has(teacherId)) return null
  return teacherAvailability(teacherId, dayPattern, context, { sectionId })
}

// Free rooms for a slot: { term_id, day_of_week | day_pattern, start_min, end_min, section_id?, entry_id? }.
const getAvailableRooms = async (slot, { db = pool } = {}) => {
  const context = await loadConflictContext({ termId: slot.term_id, db })
  return availableRooms(slot, context.existingEntries, context)
}

module.exports = {
  DEFAULT_MAX_SUBJECT_LOAD,
  SHS_GRID_MINUTES,
  PATTERN_DAYS,
  DAY_PATTERNS,
  daysOf,
  timesOverlap,
  weeklyMinutesOf,
  teacherIdsOf,
  usesRoom,
  isHomeroomSubject,
  templateFor,
  daySlotsFor,
  checkTimeSlot,
  availableRooms,
  teacherAvailability,
  detectConflicts,
  detectConflictsForEntries,
  summarizeTeacherLoad,
  loadTemplates,
  loadConflictContext,
  checkConflicts,
  checkConflictsForEntries,
  getTeacherAvailability,
  getAvailableRooms
}
