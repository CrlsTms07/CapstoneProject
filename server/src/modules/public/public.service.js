// HIPO 10.0 – Guest schedule view
// Read-only data for guests. Only APPROVED schedule entries are ever returned, and only the
// columns a guest needs (no user ids, no draft or audit information).
const pool = require('../../config/database')
const { listEntries } = require('../schedules/schedules.service')

const listTerms = async () => (await pool.query('SELECT term_id, school_year, term_name, is_active FROM terms ORDER BY is_active DESC, school_year DESC, term_name')).rows

const getActiveTermId = async () => (await pool.query('SELECT term_id FROM terms WHERE is_active LIMIT 1')).rows[0]?.term_id || null

const listDepartments = async () => (await pool.query('SELECT department_id, department_name FROM departments ORDER BY department_name')).rows

const listSections = async departmentId => (await pool.query(`
  SELECT sec.section_id, sec.section_name, gl.grade_level_id, gl.grade_level_name, gl.department_id
  FROM sections sec JOIN grade_levels gl ON gl.grade_level_id = sec.grade_level_id
  WHERE ($1::INT IS NULL OR gl.department_id = $1)
  ORDER BY gl.grade_level_name, sec.section_name
`, [departmentId])).rows

const PUBLIC_FIELDS = ['entry_id', 'term_id', 'school_year', 'term_name', 'day_of_week', 'start_time', 'end_time',
  'section_id', 'section_name', 'grade_level_id', 'grade_level_name', 'department_id', 'department_name',
  'subject_name', 'activity', 'teacher_name', 'room_number', 'building_name']

const pick = (row, fields) => Object.fromEntries(fields.map(field => [field, row[field] ?? null]))

// Approved entries of one term (the active term when none is given).
const listApprovedSchedules = async ({ termId, departmentId, sectionId }) => {
  const term = termId || await getActiveTermId()
  if (!term) return []
  const entries = await listEntries({ termId: term, departmentId, sectionId, statuses: ['approved'] })
  return entries.map(entry => pick(entry, PUBLIC_FIELDS))
}

module.exports = { listTerms, listDepartments, listSections, listApprovedSchedules }
