// HIPO 3.2 – Schedule Plotter: conflict detection (API level)
//
// checkConflicts(entry) returns EVERY problem with a proposed schedule entry at once:
//   teacher      – the teacher already has a class at an overlapping time
//   room         – the room is already used at an overlapping time
//                  (Senior High School: the conflict also lists free alternative rooms)
//   section      – the section already has something at an overlapping time,
//                  or the subject is already taught by a different teacher in this section
//   subject      – the subject does not belong to the section's grade level
//   teacher_load – more distinct subjects than max_subject_load, or more weekly minutes than weekly_load_minutes
//   time_rule    – wrong day, outside the school day, or not a whole number of periods (department_time_rules)
//   invalid      – a selected teacher, room, subject or section does not exist
//
// How it works: loadConflictContext() reads everything needed for one term in a few queries, then
// detectConflicts() compares the entry against that data in memory. detectConflicts is a pure
// function, so the unit tests can call it without a database, and Auto-Generate reuses it.
//
// The database repeats the overlap rules with exclusion constraints
// (src/db/migrations/scheduleConflictGuards.migration.js) – change both together.
const pool = require('../../config/database')
const { WEEK_DAYS, formatMinutes, schoolLevelOf } = require('./schedules.validation')

const MONDAY_TO_FRIDAY = WEEK_DAYS.slice(0, 5)

// Used when a department has no row in department_time_rules.
const DEFAULT_TIME_RULES = {
  JHS: { period_minutes: 45, day_start_min: 7 * 60, day_end_min: 17 * 60, allowed_days: MONDAY_TO_FRIDAY },
  SHS: { period_minutes: 60, day_start_min: 7 * 60, day_end_min: 17 * 60, allowed_days: MONDAY_TO_FRIDAY }
}
const DEFAULT_MAX_SUBJECT_LOAD = 5
const MAX_ALTERNATIVE_ROOMS = 5
const LEVEL_NAMES = { JHS: 'Junior High School', SHS: 'Senior High School' }

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

// Half-open ranges: 07:30–08:15 and 08:15–09:00 do not overlap (same rule as int4range in PostgreSQL).
const timesOverlap = (a, b) => a.day_of_week === b.day_of_week && a.start_min < b.end_min && b.start_min < a.end_min

const timeLabel = entry => `${entry.day_of_week} ${formatMinutes(entry.start_min)}–${formatMinutes(entry.end_min)}`

// "Math 7" for a class row, "BREAK" for an activity row.
const whatOf = (entry, context) => entry.subject_id ? context.subjects.get(entry.subject_id)?.subject_name || 'a class' : entry.activity

// "Grade 7 - Rizal (Math 7)"
const describeEntry = (entry, context) => {
  const section = context.sections.get(entry.section_id)?.label || `section #${entry.section_id}`
  return `${section} (${whatOf(entry, context)})`
}

const conflictOf = (type, entry, message, extra = {}) => ({
  type,
  message,
  day_of_week: entry.day_of_week,
  start_time: formatMinutes(entry.start_min),
  end_time: formatMinutes(entry.end_min),
  ...extra
})

const timeRuleFor = (section, timeRules) => {
  if (!section) return null
  return timeRules.get(section.department_id) || DEFAULT_TIME_RULES[section.level] || DEFAULT_TIME_RULES.JHS
}

// ---------------------------------------------------------------------------------------------
// The individual checks (pure). Each returns an array of conflicts.
// ---------------------------------------------------------------------------------------------

// Every id on the entry must exist.
const checkReferences = (entry, context) => {
  const missing = []
  if (!context.sections.has(entry.section_id)) missing.push(`Section #${entry.section_id}`)
  if (entry.subject_id && !context.subjects.has(entry.subject_id)) missing.push(`Subject #${entry.subject_id}`)
  if (entry.teacher_id && !context.teachers.has(entry.teacher_id)) missing.push(`Teacher #${entry.teacher_id}`)
  if (entry.room_id && !context.rooms.has(entry.room_id)) missing.push(`Room #${entry.room_id}`)
  return missing.map(name => conflictOf('invalid', entry, `${name} does not exist.`))
}

// Department time rules: allowed days, school-day window, whole periods.
const checkTimeRule = (entry, section, rule) => {
  const who = `${LEVEL_NAMES[section.level] || 'This department'} classes`
  const conflicts = []
  if (!rule.allowed_days.includes(entry.day_of_week)) {
    conflicts.push(conflictOf('time_rule', entry, `${who} are only scheduled on ${rule.allowed_days.join(', ')}.`))
  }
  if (entry.start_min < rule.day_start_min || entry.end_min > rule.day_end_min) {
    conflicts.push(conflictOf('time_rule', entry, `${who} must be between ${formatMinutes(rule.day_start_min)} and ${formatMinutes(rule.day_end_min)}.`))
  }
  const length = entry.end_min - entry.start_min
  if (length % rule.period_minutes !== 0) {
    conflicts.push(conflictOf('time_rule', entry, `${who} use ${rule.period_minutes}-minute periods; this row is ${length} minutes long.`))
  }
  return conflicts
}

// The subject must belong to the section's grade level.
const checkSubjectGrade = (entry, section, context) => {
  const subject = context.subjects.get(entry.subject_id)
  if (!subject || subject.grade_level_id === section.grade_level_id) return []
  return [conflictOf('subject', entry, `${subject.subject_name} is not a subject of ${section.grade_level_name}.`)]
}

// Free rooms at the same time, same department first (offered for Senior High room conflicts).
const findAlternativeRooms = (entry, others, context) => {
  const section = context.sections.get(entry.section_id)
  const busyRoomIds = new Set(others.filter(other => other.room_id && timesOverlap(entry, other)).map(other => other.room_id))
  busyRoomIds.add(entry.room_id)
  return [...context.rooms.values()]
    .filter(room => !busyRoomIds.has(room.room_id))
    .sort((a, b) => Number(b.department_id === section?.department_id) - Number(a.department_id === section?.department_id) ||
      a.label.localeCompare(b.label))
    .slice(0, MAX_ALTERNATIVE_ROOMS)
    .map(room => ({ room_id: room.room_id, room_number: room.room_number, building_name: room.building_name, label: room.label }))
}

// Teacher, room and section double bookings.
const checkOverlaps = (entry, others, context) => {
  const conflicts = []
  const section = context.sections.get(entry.section_id)
  for (const other of others) {
    if (!timesOverlap(entry, other)) continue
    const when = timeLabel(other)
    const conflictingId = other.entry_id ? { conflicting_entry_id: other.entry_id } : {}
    if (entry.teacher_id && entry.teacher_id === other.teacher_id) {
      const teacher = context.teachers.get(entry.teacher_id)
      conflicts.push(conflictOf('teacher', entry, `${teacher?.name || 'The teacher'} is already teaching ${describeEntry(other, context)} on ${when}.`, conflictingId))
    }
    if (entry.room_id && entry.room_id === other.room_id) {
      const room = context.rooms.get(entry.room_id)
      const extra = { ...conflictingId }
      if (section?.level === 'SHS') extra.alternative_rooms = findAlternativeRooms(entry, others, context)
      conflicts.push(conflictOf('room', entry, `${room?.label || 'The room'} is already used by ${describeEntry(other, context)} on ${when}.`, extra))
    }
    if (entry.section_id === other.section_id) {
      conflicts.push(conflictOf('section', entry, `${section?.label || 'The section'} already has ${whatOf(other, context)} on ${when}.`, conflictingId))
    }
  }
  return conflicts
}

// One teacher per subject per section (a section's Math is always taught by the same teacher).
const checkSubjectTeacher = (entry, others, context) => {
  if (!entry.subject_id) return []
  const other = others.find(item => item.section_id === entry.section_id && item.subject_id === entry.subject_id && item.teacher_id !== entry.teacher_id)
  if (!other) return []
  const subject = context.subjects.get(entry.subject_id)?.subject_name || 'This subject'
  const teacher = context.teachers.get(other.teacher_id)?.name || 'another teacher'
  return [conflictOf('section', entry, `${subject} in this section is already taught by ${teacher}; a subject keeps one teacher per section.`)]
}

// Load summary for one teacher over a list of entries (distinct subjects and weekly minutes).
const summarizeTeacherLoad = (teacherId, entries, context) => {
  const teacher = context.teachers.get(teacherId)
  const own = entries.filter(entry => entry.teacher_id === teacherId)
  const subjectCount = new Set(own.map(entry => entry.subject_id)).size
  const weeklyMinutes = own.reduce((total, entry) => total + entry.end_min - entry.start_min, 0)
  const maxSubjects = teacher?.max_subject_load || DEFAULT_MAX_SUBJECT_LOAD
  const maxMinutes = teacher?.weekly_load_minutes || null
  return {
    teacher_id: teacherId,
    teacher_name: teacher?.name || `Teacher #${teacherId}`,
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

// ---------------------------------------------------------------------------------------------
// detectConflicts – all checks for ONE entry against the context (pure, no database).
// context.existingEntries holds the term's other non-rejected entries.
// ---------------------------------------------------------------------------------------------
const detectConflicts = (entry, context, { checkLoad = true } = {}) => {
  const invalid = checkReferences(entry, context)
  if (invalid.length) return invalid

  const section = context.sections.get(entry.section_id)
  const others = context.existingEntries.filter(other => !(entry.entry_id && other.entry_id === entry.entry_id))
  const conflicts = [
    ...checkTimeRule(entry, section, timeRuleFor(section, context.timeRules)),
    ...checkSubjectGrade(entry, section, context),
    ...checkOverlaps(entry, others, context),
    ...checkSubjectTeacher(entry, others, context)
  ]
  if (checkLoad && entry.teacher_id) {
    conflicts.push(...teacherLoadConflicts(summarizeTeacherLoad(entry.teacher_id, [...others, entry], context), entry))
  }
  return conflicts
}

// Checks a list of new entries (e.g. a whole week from the plotter). Each entry is compared with
// the saved entries AND the rows before it, so a clash inside the list is reported once.
// Teacher load is checked once per teacher over the whole list.
const detectConflictsForEntries = (entries, context) => {
  const conflicts = []
  entries.forEach((entry, index) => {
    const earlierRows = entries.slice(0, index)
    const rowContext = { ...context, existingEntries: [...context.existingEntries, ...earlierRows] }
    detectConflicts(entry, rowContext, { checkLoad: false }).forEach(conflict => conflicts.push({ ...conflict, entry_index: index }))
  })

  const changedIds = new Set(entries.map(entry => entry.entry_id).filter(Boolean))
  const allEntries = [...context.existingEntries.filter(entry => !changedIds.has(entry.entry_id)), ...entries]
  const teacherIds = [...new Set(entries.map(entry => entry.teacher_id).filter(id => id && context.teachers.has(id)))]
  const teacherLoads = teacherIds.map(teacherId => summarizeTeacherLoad(teacherId, allEntries, context))
  for (const load of teacherLoads) {
    const index = entries.findIndex(entry => entry.teacher_id === load.teacher_id)
    teacherLoadConflicts(load, entries[index]).forEach(conflict => conflicts.push({ ...conflict, entry_index: index }))
  }
  return { conflicts, teacherLoads }
}

// ---------------------------------------------------------------------------------------------
// Loading the context from PostgreSQL
// ---------------------------------------------------------------------------------------------

// Reads what the checks need for one term. ignoreEntryIds: saved entries that are being replaced.
const loadConflictContext = async ({ termId, ignoreEntryIds = [], db = pool }) => {
  const sections = await db.query(`
    SELECT sec.section_id, sec.section_name, gl.grade_level_id, gl.grade_level_name, gl.department_id
    FROM sections sec JOIN grade_levels gl ON gl.grade_level_id = sec.grade_level_id
  `)
  const timeRules = await db.query('SELECT * FROM department_time_rules')
  const entries = await db.query(`
    SELECT entry_id, term_id, section_id, subject_id, teacher_id, room_id, activity,
           day_of_week, start_min, end_min, status
    FROM schedule_entries
    WHERE term_id = $1 AND status <> 'rejected' AND NOT (entry_id = ANY($2::INT[]))
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
  const subjects = await db.query('SELECT subject_id, subject_name, grade_level_id, weekly_periods FROM subjects')

  return {
    termId,
    sections: new Map(sections.rows.map(row => [row.section_id, {
      ...row,
      level: schoolLevelOf(row.grade_level_name),
      label: `${row.grade_level_name} - ${row.section_name}`
    }])),
    timeRules: new Map(timeRules.rows.map(row => [row.department_id, row])),
    existingEntries: entries.rows,
    teachers: new Map(teachers.rows.map(row => [row.teacher_id, row])),
    rooms: new Map(rooms.rows.map(row => [row.room_id, { ...row, label: `${row.building_name} · Room ${row.room_number}` }])),
    subjects: new Map(subjects.rows.map(row => [row.subject_id, row]))
  }
}

// checkConflicts(entry) – all conflicts for one entry, read straight from the database.
// When entry.entry_id is set (an update), the saved version of that entry is ignored.
const checkConflicts = async (entry, { db = pool } = {}) => {
  const context = await loadConflictContext({ termId: entry.term_id, db })
  return detectConflicts(entry, context)
}

// Conflicts for a list of entries in one term (plotter save / live validation).
const checkConflictsForEntries = async (entries, { termId, ignoreEntryIds = [], db = pool }) => {
  const context = await loadConflictContext({ termId, ignoreEntryIds, db })
  return detectConflictsForEntries(entries, context)
}

module.exports = {
  DEFAULT_TIME_RULES,
  DEFAULT_MAX_SUBJECT_LOAD,
  timesOverlap,
  timeRuleFor,
  detectConflicts,
  detectConflictsForEntries,
  summarizeTeacherLoad,
  loadConflictContext,
  checkConflicts,
  checkConflictsForEntries
}
