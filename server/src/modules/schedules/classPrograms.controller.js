// HIPO 3.2 – Schedule Plotter (JHS class programs, Grades 7–10)
// Load, validate (real-time conflict detection) and save a section's weekly class program.
const pool = require('../../config/database')
const { getSectionScope, validateSubjectGrade, loadProgram } = require('./schedules.service')
const { gradeNumber, normalizeEntries } = require('./schedules.validation')
const { findClassProgramConflicts, getTeacherLoadWarnings, getTeacherWarnings } = require('./conflict.service')
const { sendDatabaseError } = require('./classPrograms.errors')

const getProgramForSection = async (req, res) => {
  try {
    const section = await getSectionScope(req.params.sectionId, req.session.user)
    if (section === false) return res.status(403).json({ error: 'Section is outside your assigned grade level.' })
    if (!section) return res.status(404).json({ error: 'JHS section not found.' })
    const schoolYear = String(req.query.school_year || '').trim()
    if (!schoolYear) return res.status(400).json({ error: 'school_year is required.' })
    const programResult = await pool.query(
      'SELECT program_id FROM jhs_class_programs WHERE section_id = $1 AND school_year = $2',
      [section.section_id, schoolYear]
    )
    if (!programResult.rows[0]) return res.status(200).json({ program: null, warnings: [] })
    const program = await loadProgram(programResult.rows[0].program_id)
    const warnings = await getTeacherWarnings(program.program_id)
    return res.status(200).json({ program, warnings })
  } catch (error) {
    return sendDatabaseError(res, error)
  }
}

const validateClassProgram = async (req, res) => {
  try {
    const user = req.session.user
    const section = await getSectionScope(req.body.section_id, user)
    if (section === false) return res.status(403).json({ error: 'Section is outside your assigned grade level.' })
    if (!section) return res.status(404).json({ error: 'JHS section not found.' })
    const entries = normalizeEntries(req.body.entries, section, 'draft')
    await validateSubjectGrade(pool, entries, section)
    const programId = Number(req.body.program_id) || null
    const conflicts = await findClassProgramConflicts(entries, programId)
    const warnings = await getTeacherLoadWarnings(entries, programId)
    return res.status(200).json({ conflicts, warnings })
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message })
    return sendDatabaseError(res, error)
  }
}

const saveClassProgram = async (req, res) => {
  const user = req.session.user
  if (![1, 2].includes(Number(user.role_id))) return res.status(403).json({ error: 'Only an administrator or grade chairperson can save JHS programs.' })
  const status = req.body.status === 'pending' ? 'pending' : 'draft'
  const schoolYear = String(req.body.school_year || '').trim()
  if (!/^\d{4}-\d{4}$/.test(schoolYear)) return res.status(400).json({ error: 'School year must use YYYY-YYYY format.' })
  const client = await pool.connect()
  let programId
  try {
    await client.query('BEGIN')
    const sectionResult = await client.query(`
      SELECT sec.section_id, gl.grade_level_id, gl.grade_level_name, gl.department_id
      FROM sections sec JOIN grade_levels gl ON gl.grade_level_id = sec.grade_level_id
      WHERE sec.section_id = $1 FOR SHARE OF sec, gl
    `, [Number(req.body.section_id)])
    const section = sectionResult.rows[0]
    if (!section || !gradeNumber(section.grade_level_name)) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Select a registered JHS Grade 7–10 section.' })
    }
    if (Number(user.role_id) === 2) {
      const assignmentResult = await client.query('SELECT assigned_grade_level_id, department_id FROM users WHERE user_id = $1 FOR SHARE', [user.user_id])
      const assignment = assignmentResult.rows[0]
      if (!assignment?.assigned_grade_level_id || Number(assignment.assigned_grade_level_id) !== Number(section.grade_level_id) || Number(assignment.department_id) !== Number(section.department_id)) {
        await client.query('ROLLBACK')
        return res.status(403).json({ error: 'Assign a Grade 7–10 level to your account or select a section within your assigned grade.' })
      }
    }
    const header = req.body.header && typeof req.body.header === 'object' && !Array.isArray(req.body.header) ? req.body.header : {}
    const entries = normalizeEntries(req.body.entries, section, status)
    await validateSubjectGrade(client, entries, section)
    if (status === 'pending' && !entries.some(entry => entry.subject_id)) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Add at least one assigned subject before submitting for approval.' })
    }

    const existingResult = await client.query(
      'SELECT program_id, status, created_by FROM jhs_class_programs WHERE section_id = $1 AND school_year = $2 FOR UPDATE',
      [section.section_id, schoolYear]
    )
    const existing = existingResult.rows[0]
    if (existing && existing.status === 'approved') {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: 'Approved programs cannot be overwritten.' })
    }
    if (existing && existing.status === 'pending') {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: 'This program is already pending admin approval.' })
    }
    if (existing && Number(user.role_id) === 2 && Number(existing.created_by) !== Number(user.user_id)) {
      await client.query('ROLLBACK')
      return res.status(403).json({ error: 'Only the chairperson who created this draft can update it.' })
    }

    if (existing) {
      programId = existing.program_id
      await client.query(`
        UPDATE jhs_class_programs
        SET header = $1::JSONB, status = $2, updated_at = NOW(), reviewed_by = NULL, reviewed_at = NULL
        WHERE program_id = $3
      `, [JSON.stringify(header), status, programId])
      await client.query('DELETE FROM jhs_class_program_entries WHERE program_id = $1', [programId])
    } else {
      const inserted = await client.query(`
        INSERT INTO jhs_class_programs (section_id, school_year, header, status, created_by)
        VALUES ($1, $2, $3::JSONB, $4, $5)
        RETURNING program_id
      `, [section.section_id, schoolYear, JSON.stringify(header), status, user.user_id])
      programId = inserted.rows[0].program_id
    }

    for (const entry of entries) {
      await client.query(`
        INSERT INTO jhs_class_program_entries
          (program_id, section_id, day_of_week, start_time, duration_minutes, subject_id, activity, teacher_id, room_id, status)
        VALUES ($1, $2, $3, $4, 45, $5, $6, $7, $8, $9)
      `, [programId, entry.section_id, entry.day_of_week, entry.start_time, entry.subject_id, entry.activity, entry.teacher_id, entry.room_id, status])
    }
    if (status === 'pending') {
      await client.query(`INSERT INTO jhs_class_program_approvals (program_id, action, performed_by) VALUES ($1, 'submitted', $2)`, [programId, user.user_id])
    }
    await client.query('COMMIT')
    const program = await loadProgram(programId)
    const warnings = await getTeacherWarnings(programId)
    return res.status(existing ? 200 : 201).json({ program, warnings })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message })
    return sendDatabaseError(res, error)
  } finally {
    client.release()
  }
}

module.exports = { getProgramForSection, validateClassProgram, saveClassProgram }