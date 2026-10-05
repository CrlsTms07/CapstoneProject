// HIPO 6.0 – Reports
// One data function per report type. Each returns the same shape:
//   { type, title, subtitle, columns: [{ key, label }], rows: [{ ...values }] }
// The JSON view, the CSV exporter and the PDF exporter all use that object, so a report's
// numbers are computed in exactly one place. Only APPROVED schedule entries are counted.
const pool = require('../../config/database')
const { HttpError } = require('../../utils/httpError')
const { ROLES } = require('../../middleware/authMiddleware')
const { listEntries } = require('../schedules/schedules.service')
const { DEFAULT_MAX_SUBJECT_LOAD } = require('../schedules/conflict.service')

const APPROVED = ['approved']

const timeRange = entry => `${entry.start_time}–${entry.end_time}`
const roomLabel = entry => entry.delivery_mode === 'asynchronous' ? 'Asynchronous' : entry.room_number ? `${entry.building_name} · ${entry.room_number}` : '—'
const teachersLabel = entry => entry.teacher_names?.length ? entry.teacher_names.join(' / ') : entry.teacher_name || '—'

const termLabel = async termId => {
  const term = (await pool.query('SELECT school_year, term_name FROM terms WHERE term_id = $1', [termId])).rows[0]
  if (!term) throw new HttpError(404, 'Term not found.')
  return `S.Y. ${term.school_year} · ${term.term_name}`
}

// Non-admins only see their department (req.scope from scopeToDepartment).
const assertInScope = (scope, departmentId) => {
  if (!scope.isAdmin && departmentId !== scope.departmentId) throw new HttpError(403, 'This report is outside your department.')
}

const nameOf = async (sql, id, notFound) => {
  const row = (await pool.query(sql, [id])).rows[0]
  if (!row) throw new HttpError(404, notFound)
  return row
}

// ---------------------------------------------------------------------------------------------
// Detail reports: one section / teacher / room, every approved class in the term
// ---------------------------------------------------------------------------------------------

const sectionSchedule = async ({ termId, sectionId, scope }) => {
  const section = await nameOf(`
    SELECT sec.section_name, gl.grade_level_name, gl.department_id
    FROM sections sec JOIN grade_levels gl ON gl.grade_level_id = sec.grade_level_id WHERE sec.section_id = $1
  `, sectionId, 'Section not found.')
  assertInScope(scope, section.department_id)
  const entries = await listEntries({ termId, sectionId, statuses: APPROVED })
  return {
    type: 'section',
    title: `Class Program – ${section.grade_level_name} - ${section.section_name}`,
    subtitle: await termLabel(termId),
    columns: [
      { key: 'day', label: 'Day' }, { key: 'time', label: 'Time' }, { key: 'subject', label: 'Subject / Activity' },
      { key: 'teacher', label: 'Teacher' }, { key: 'room', label: 'Room' }
    ],
    rows: entries.map(entry => ({ day: entry.day_of_week, time: timeRange(entry), subject: entry.subject_name || entry.activity, teacher: entry.subject_id ? teachersLabel(entry) : '—', room: roomLabel(entry) }))
  }
}

const teacherSchedule = async ({ termId, teacherId, scope }) => {
  const teacher = await nameOf(`
    SELECT COALESCE(u.full_name, t.last_name) AS name, u.department_id
    FROM teachers t JOIN users u ON u.user_id = t.user_id WHERE t.teacher_id = $1
  `, teacherId, 'Teacher not found.')
  // A teacher may only print their own schedule; staff stay within their department.
  if (scope.role === ROLES.TEACHER) {
    if (scope.teacherId !== teacherId) throw new HttpError(403, 'You can only print your own schedule.')
  } else {
    assertInScope(scope, teacher.department_id)
  }
  const entries = await listEntries({ termId, teacherId, statuses: APPROVED })
  const minutes = entries.reduce((total, entry) => total + entry.end_min - entry.start_min, 0)
  return {
    type: 'teacher',
    title: `Teaching Schedule – ${teacher.name}`,
    subtitle: `${await termLabel(termId)} · ${entries.length} classes · ${minutes} minutes a week`,
    columns: [
      { key: 'day', label: 'Day' }, { key: 'time', label: 'Time' }, { key: 'section', label: 'Grade / Section' },
      { key: 'subject', label: 'Subject' }, { key: 'room', label: 'Room' }
    ],
    rows: entries.map(entry => ({ day: entry.day_of_week, time: timeRange(entry), section: `${entry.grade_level_name} - ${entry.section_name}`, subject: entry.subject_name, room: roomLabel(entry) }))
  }
}

const roomSchedule = async ({ termId, roomId, scope }) => {
  const room = await nameOf(`
    SELECT r.room_number, b.building_name, b.department_id
    FROM rooms r JOIN buildings b ON b.building_id = r.building_id WHERE r.room_id = $1
  `, roomId, 'Room not found.')
  assertInScope(scope, room.department_id)
  const entries = await listEntries({ termId, roomId, statuses: APPROVED })
  return {
    type: 'room',
    title: `Room Schedule – ${room.building_name} · Room ${room.room_number}`,
    subtitle: await termLabel(termId),
    columns: [
      { key: 'day', label: 'Day' }, { key: 'time', label: 'Time' }, { key: 'section', label: 'Grade / Section' },
      { key: 'subject', label: 'Subject' }, { key: 'teacher', label: 'Teacher' }
    ],
    rows: entries.map(entry => ({ day: entry.day_of_week, time: timeRange(entry), section: `${entry.grade_level_name} - ${entry.section_name}`, subject: entry.subject_name, teacher: teachersLabel(entry) }))
  }
}

// ---------------------------------------------------------------------------------------------
// Summary reports: every teacher / room in scope
// ---------------------------------------------------------------------------------------------

const teacherLoad = async ({ termId, scope }) => {
  const result = await pool.query(`
    SELECT COALESCE(u.full_name, t.last_name) AS teacher, COUNT(DISTINCT e.subject_id)::INT AS subjects,
           COUNT(e.entry_id)::INT AS classes, COALESCE(SUM(e.end_min - e.start_min), 0)::INT AS minutes,
           COALESCE(t.max_subject_load, $3)::INT AS max_subjects, t.weekly_load_minutes AS max_minutes
    FROM teachers t
    JOIN users u ON u.user_id = t.user_id
    LEFT JOIN entry_teachers et ON et.teacher_id = t.teacher_id AND et.term_id = $1 AND et.status = 'approved'
    LEFT JOIN schedule_entries e ON e.entry_id = et.entry_id
    WHERE ($2::INT IS NULL OR u.department_id = $2)
    GROUP BY t.teacher_id, u.full_name, t.last_name, t.max_subject_load, t.weekly_load_minutes
    ORDER BY teacher
  `, [termId, scope.isAdmin ? null : scope.departmentId, DEFAULT_MAX_SUBJECT_LOAD])
  return {
    type: 'teacher-load',
    title: 'Teacher Workload',
    subtitle: await termLabel(termId),
    columns: [
      { key: 'teacher', label: 'Teacher' }, { key: 'subjects', label: 'Subjects' }, { key: 'classes', label: 'Classes / week' },
      { key: 'minutes', label: 'Minutes / week' }, { key: 'limit', label: 'Limit' }, { key: 'status', label: 'Status' }
    ],
    rows: result.rows.map(row => {
      const overloaded = row.subjects > row.max_subjects || (row.max_minutes !== null && row.minutes > row.max_minutes)
      return {
        teacher: row.teacher,
        subjects: row.subjects,
        classes: row.classes,
        minutes: row.minutes,
        limit: `${row.max_subjects} subjects${row.max_minutes ? ` / ${row.max_minutes} min` : ''}`,
        status: overloaded ? 'Overloaded' : row.classes === 0 ? 'No classes' : 'OK'
      }
    })
  }
}

// Face-to-face minutes used compared with the class minutes of a school week in the room's department:
// the longest weekly class time among the department's time templates (MON_THU counts four days).
// No template in the department: "Minutes available" and "Usage" show "—".
const roomUtilization = async ({ termId, scope }) => {
  const result = await pool.query(`
    WITH template_week AS (
      SELECT tt.department_id, tt.template_id,
             SUM((s.end_min - s.start_min) * CASE s.day_pattern WHEN 'MON_THU' THEN 4 ELSE 1 END)::INT AS minutes
      FROM time_templates tt JOIN time_template_slots s ON s.template_id = tt.template_id
      WHERE s.slot_type = 'class'
      GROUP BY tt.department_id, tt.template_id
    ), department_week AS (
      SELECT department_id, MAX(minutes) AS minutes FROM template_week GROUP BY department_id
    )
    SELECT b.building_name, r.room_number, COUNT(e.entry_id)::INT AS classes,
           COALESCE(SUM(e.end_min - e.start_min), 0)::INT AS minutes, week.minutes AS available
    FROM rooms r
    JOIN buildings b ON b.building_id = r.building_id
    LEFT JOIN department_week week ON week.department_id = b.department_id
    LEFT JOIN schedule_entries e ON e.room_id = r.room_id AND e.term_id = $1 AND e.status = 'approved'
      AND e.delivery_mode = 'face_to_face'
    WHERE ($2::INT IS NULL OR b.department_id = $2)
    GROUP BY r.room_id, b.building_name, r.room_number, week.minutes
    ORDER BY b.building_name, r.room_number
  `, [termId, scope.isAdmin ? null : scope.departmentId])
  return {
    type: 'room-utilization',
    title: 'Room Utilization',
    subtitle: await termLabel(termId),
    columns: [
      { key: 'room', label: 'Room' }, { key: 'classes', label: 'Classes / week' }, { key: 'minutes', label: 'Minutes used' },
      { key: 'available', label: 'Minutes available' }, { key: 'usage', label: 'Usage' }
    ],
    rows: result.rows.map(row => ({
      room: `${row.building_name} · ${row.room_number}`,
      classes: row.classes,
      minutes: row.minutes,
      available: row.available ?? '—',
      usage: row.available ? `${Math.round((row.minutes / row.available) * 100)}%` : '—'
    }))
  }
}

// type -> { load, needs }. "needs" is the id the report requires (besides term_id).
const REPORT_TYPES = {
  section: { load: sectionSchedule, needs: 'section_id' },
  teacher: { load: teacherSchedule, needs: 'teacher_id' },
  room: { load: roomSchedule, needs: 'room_id' },
  'teacher-load': { load: teacherLoad, needs: null },
  'room-utilization': { load: roomUtilization, needs: null }
}

const buildReport = (type, params) => REPORT_TYPES[type].load(params)

module.exports = { REPORT_TYPES, buildReport }
