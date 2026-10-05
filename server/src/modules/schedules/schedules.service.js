// HIPO 3.2 – Schedule Plotter
// Data access for JHS class programs: section scope (grade chairperson limits), subject/grade
// checks and loading a saved program with its entries.
const pool = require('../../config/database')
const { gradeNumber } = require('./schedules.validation')

const getSectionScope = async (sectionId, user) => {
  const result = await pool.query(`
    SELECT sec.section_id, sec.section_name, gl.grade_level_id, gl.grade_level_name,
           gl.department_id, d.department_name
    FROM sections sec
    JOIN grade_levels gl ON gl.grade_level_id = sec.grade_level_id
    JOIN departments d ON d.department_id = gl.department_id
    WHERE sec.section_id = $1
  `, [sectionId])
  const section = result.rows[0]
  if (!section || !gradeNumber(section.grade_level_name)) return null
  if (Number(user.role_id) === 2) {
    const assignment = await pool.query('SELECT assigned_grade_level_id, department_id FROM users WHERE user_id = $1', [user.user_id])
    const chair = assignment.rows[0]
    if (!chair?.assigned_grade_level_id || Number(chair.assigned_grade_level_id) !== Number(section.grade_level_id) || Number(chair.department_id) !== Number(section.department_id)) return false
  }
  return section
}

const validateSubjectGrade = async (client, entries, section) => {
  const subjectIds = [...new Set(entries.map(entry => entry.subject_id).filter(Boolean))]
  if (!subjectIds.length) return
  const result = await client.query(
    'SELECT subject_id FROM subjects WHERE subject_id = ANY($1::INT[]) AND grade_level_id = $2',
    [subjectIds, section.grade_level_id]
  )
  if (result.rows.length !== subjectIds.length) {
    throw Object.assign(new Error('One or more subjects are not assigned to the selected grade level.'), { statusCode: 400 })
  }
}

const loadProgram = async (programId, client = pool) => {
  const programResult = await client.query(`
    SELECT p.*, sec.section_name, gl.grade_level_name, gl.grade_level_id,
           d.department_id, d.department_name
    FROM jhs_class_programs p
    JOIN sections sec ON sec.section_id = p.section_id
    JOIN grade_levels gl ON gl.grade_level_id = sec.grade_level_id
    JOIN departments d ON d.department_id = gl.department_id
    WHERE p.program_id = $1
  `, [programId])
  if (!programResult.rows[0]) return null
  const entriesResult = await client.query(`
    SELECT e.entry_id, e.program_id, e.section_id, e.day_of_week, e.start_time,
           e.duration_minutes, e.subject_id, e.activity, e.teacher_id, e.room_id, e.status,
           sub.subject_name, t.last_name AS teacher_last_name, u.full_name AS teacher_name,
           r.room_number, r.building_id, b.building_name
    FROM jhs_class_program_entries e
    LEFT JOIN subjects sub ON sub.subject_id = e.subject_id
    LEFT JOIN teachers t ON t.teacher_id = e.teacher_id
    LEFT JOIN users u ON u.user_id = t.user_id
    LEFT JOIN rooms r ON r.room_id = e.room_id
    LEFT JOIN buildings b ON b.building_id = r.building_id
    WHERE e.program_id = $1
    ORDER BY e.day_of_week, e.start_time, e.entry_id
  `, [programId])
  return { ...programResult.rows[0], entries: entriesResult.rows }
}

module.exports = { getSectionScope, validateSubjectGrade, loadProgram }
