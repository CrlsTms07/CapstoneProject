const pool = require('../config/database')

const gradeNumber = name => String(name || '').match(/\b(?:grade\s*)?(7|8|9|10)\b/i)?.[1] || null

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

const getTeacherWarnings = async programId => {
  const result = await pool.query(`
    WITH assigned AS (
      SELECT DISTINCT teacher_id FROM jhs_class_program_entries
      WHERE program_id = $1 AND teacher_id IS NOT NULL
    ), subject_load AS (
      SELECT teacher_id, COUNT(DISTINCT subject_id)::INT AS subject_count
      FROM (
        SELECT teacher_id, subject_id
        FROM schedules
        WHERE status NOT IN ('rejected', 'draft')
        UNION
        SELECT teacher_id, subject_id
        FROM jhs_class_program_entries
        WHERE status <> 'rejected'
      ) loads
      GROUP BY teacher_id
    )
    SELECT t.teacher_id, COALESCE(u.full_name, t.last_name) AS teacher_name,
           COALESCE(load.subject_count, 0)::INT AS subject_count,
           COALESCE(t.max_subject_load, 5)::INT AS max_subject_load,
           t.ancillary_tasks
    FROM assigned a
    JOIN teachers t ON t.teacher_id = a.teacher_id
    JOIN users u ON u.user_id = t.user_id
    LEFT JOIN subject_load load ON load.teacher_id = t.teacher_id
  `, [programId])
  return result.rows.map(teacher => ({
    ...teacher,
    overloaded: teacher.subject_count > teacher.max_subject_load,
    ancillary_tasks: teacher.ancillary_tasks || []
  }))
}

const sendDatabaseError = (res, error) => {
  if (error.code === '23P01' || error.code === '23505') {
    return res.status(409).json({ error: 'Schedule conflict', message: error.message })
  }
  if (error.code === '23503') {
    return res.status(400).json({ error: 'Invalid resource', message: 'A selected section, subject, teacher, or room no longer exists.' })
  }
  if (error.code === '23514') {
    return res.status(400).json({ error: 'Invalid schedule entry', message: error.message })
  }
  console.error('JHS class program error:', error)
  return res.status(500).json({ error: 'Failed to process class program' })
}

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
    const days = [...new Set(entries.map(entry => entry.day_of_week))]
    const existingResult = days.length ? await pool.query(`
      SELECT s.day_of_week, ts.start_time::TEXT AS start_time, s.section_id, s.teacher_id, s.room_id,
             s.subject_id, 'schedule'::TEXT AS source
      FROM schedules s JOIN time_slots ts ON ts.time_slot_id = s.time_slot_id
      WHERE s.day_of_week = ANY($1::TEXT[]) AND s.status <> 'rejected'
      UNION ALL
      SELECT e.day_of_week, e.start_time::TEXT AS start_time, e.section_id, e.teacher_id, e.room_id,
             e.subject_id, 'class-program'::TEXT AS source
      FROM jhs_class_program_entries e
      WHERE e.day_of_week = ANY($1::TEXT[]) AND e.status <> 'rejected'
        AND ($2::INT IS NULL OR e.program_id <> $2)
    `, [days, programId]) : { rows: [] }
    const toMinutes = value => {
      const [hour, minute] = String(value).split(':').map(Number)
      return hour * 60 + minute
    }
    const conflicts = []
    entries.forEach((candidate, index) => {
      const candidateStart = toMinutes(candidate.start_time)
      const candidateEnd = candidateStart + 45
      existingResult.rows.forEach(existing => {
        if (candidate.day_of_week !== existing.day_of_week) return
        const existingStart = toMinutes(existing.start_time)
        if (candidateStart >= existingStart + 45 || existingStart >= candidateEnd) return
        const resource = candidate.teacher_id && candidate.teacher_id === Number(existing.teacher_id) ? 'teacher'
          : candidate.room_id && candidate.room_id === Number(existing.room_id) ? 'room'
            : candidate.section_id === Number(existing.section_id) ? 'section' : null
        if (resource) conflicts.push({ resource, day_of_week: candidate.day_of_week, start_time: candidate.start_time, message: `Conflicts with an existing ${resource} schedule at ${existing.start_time}.` })
      })
      entries.slice(index + 1).forEach(other => {
        if (candidate.day_of_week !== other.day_of_week) return
        const otherStart = toMinutes(other.start_time)
        if (candidateStart >= otherStart + 45 || otherStart >= candidateEnd) return
        const resource = candidate.teacher_id && candidate.teacher_id === other.teacher_id ? 'teacher'
          : candidate.room_id && candidate.room_id === other.room_id ? 'room'
            : candidate.section_id === other.section_id ? 'section' : null
        if (resource) conflicts.push({ resource, day_of_week: candidate.day_of_week, start_time: candidate.start_time, message: `Two rows overlap for this ${resource} at ${other.start_time}.` })
      })
    })

    const teacherIds = [...new Set(entries.map(entry => entry.teacher_id).filter(Boolean))]
    let warnings = []
    if (teacherIds.length) {
      const currentLoads = await pool.query(`
        SELECT DISTINCT teacher_id, subject_id
        FROM (
          SELECT teacher_id, subject_id FROM schedules WHERE status NOT IN ('rejected', 'draft')
          UNION
          SELECT teacher_id, subject_id FROM jhs_class_program_entries
          WHERE status <> 'rejected' AND ($2::INT IS NULL OR program_id <> $2)
        ) loads
        WHERE teacher_id = ANY($1::INT[])
      `, [teacherIds, programId])
      const candidateSubjects = new Map()
      currentLoads.rows.forEach(row => {
        const ids = candidateSubjects.get(Number(row.teacher_id)) || new Set()
        ids.add(Number(row.subject_id))
        candidateSubjects.set(Number(row.teacher_id), ids)
      })
      entries.forEach(entry => {
        if (!entry.teacher_id || !entry.subject_id) return
        const ids = candidateSubjects.get(Number(entry.teacher_id)) || new Set()
        ids.add(entry.subject_id)
        candidateSubjects.set(Number(entry.teacher_id), ids)
      })
      const teachersResult = await pool.query(`
        SELECT t.teacher_id, COALESCE(u.full_name, t.last_name) AS teacher_name,
               COALESCE(t.max_subject_load, 5)::INT AS max_subject_load, t.ancillary_tasks
        FROM teachers t JOIN users u ON u.user_id = t.user_id
        WHERE t.teacher_id = ANY($1::INT[])
      `, [teacherIds])
      warnings = teachersResult.rows.map(teacher => {
        const subjectCount = candidateSubjects.get(Number(teacher.teacher_id))?.size || 0
        return {
          teacher_id: teacher.teacher_id,
          teacher_name: teacher.teacher_name,
          subject_count: subjectCount,
          max_subject_load: teacher.max_subject_load,
          ancillary_tasks: teacher.ancillary_tasks || [],
          overloaded: subjectCount > teacher.max_subject_load
        }
      })
    }
    return res.status(200).json({ conflicts, warnings })
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message })
    return sendDatabaseError(res, error)
  }
}

const normalizeEntries = (entries, section, status) => {
  if (!Array.isArray(entries) || entries.length > 600) throw Object.assign(new Error('Entries must be an array of at most 600 rows.'), { statusCode: 400 })
  const subjectTeachers = new Map()
  const normalized = []
  for (const entry of entries) {
    const day = String(entry.day_of_week || '')
    const time = String(entry.start_time || '')
    const minutes = Number(entry.duration_minutes ?? 45)
    if (!['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day)) throw Object.assign(new Error('Each row needs a weekday from Monday to Friday.'), { statusCode: 400 })
    if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) throw Object.assign(new Error('Use a valid 24-hour start time.'), { statusCode: 400 })
    if (minutes !== 45) throw Object.assign(new Error('JHS class periods must be exactly 45 minutes.'), { statusCode: 400 })
    const subjectId = entry.subject_id ? Number(entry.subject_id) : null
    const teacherId = entry.teacher_id ? Number(entry.teacher_id) : null
    const roomId = entry.room_id ? Number(entry.room_id) : null
    const activity = String(entry.activity || '').trim().slice(0, 100) || null
    if (subjectId) {
      if (!teacherId || !roomId || activity) throw Object.assign(new Error('Instruction rows require one subject, teacher, and room.'), { statusCode: 400 })
      const assignedTeacher = subjectTeachers.get(subjectId)
      if (assignedTeacher && assignedTeacher !== teacherId) throw Object.assign(new Error('Each subject must use the same assigned teacher for this section.'), { statusCode: 400 })
      subjectTeachers.set(subjectId, teacherId)
    } else if (teacherId || roomId || !activity) {
      throw Object.assign(new Error('Break/lunch rows need an activity name and no teacher or room.'), { statusCode: 400 })
    }
    normalized.push({
      section_id: section.section_id,
      day_of_week: day,
      start_time: time,
      duration_minutes: 45,
      subject_id: subjectId,
      activity,
      teacher_id: teacherId,
      room_id: roomId,
      status
    })
  }
  return normalized
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

const getPendingClassPrograms = async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.program_id FROM jhs_class_programs p
      WHERE p.status = 'pending' ORDER BY p.updated_at
    `)
    const programs = await Promise.all(result.rows.map(row => loadProgram(row.program_id)))
    return res.status(200).json(programs)
  } catch (error) {
    return sendDatabaseError(res, error)
  }
}

const reviewClassProgram = async (req, res) => {
  const decision = String(req.body.decision || '').toLowerCase()
  if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'Decision must be approved or rejected.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query('SELECT program_id, status FROM jhs_class_programs WHERE program_id = $1 FOR UPDATE', [req.params.programId])
    if (!current.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Class program not found.' })
    }
    if (current.rows[0].status !== 'pending') {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: 'Only pending programs can be reviewed.' })
    }
    await client.query(`UPDATE jhs_class_programs SET status = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW() WHERE program_id = $3`, [decision, req.session.user.user_id, req.params.programId])
    await client.query('UPDATE jhs_class_program_entries SET status = $1 WHERE program_id = $2', [decision, req.params.programId])
    await client.query(`INSERT INTO jhs_class_program_approvals (program_id, action, performed_by, notes) VALUES ($1, $2, $3, $4)`, [req.params.programId, decision, req.session.user.user_id, String(req.body.notes || '').slice(0, 1000) || null])
    await client.query('COMMIT')
    return res.status(200).json({ program: await loadProgram(req.params.programId) })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    return sendDatabaseError(res, error)
  } finally {
    client.release()
  }
}

module.exports = { getProgramForSection, validateClassProgram, saveClassProgram, getPendingClassPrograms, reviewClassProgram }