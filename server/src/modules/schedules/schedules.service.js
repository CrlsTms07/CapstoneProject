// HIPO 3.2 – Schedule Plotter
// Data access for schedule_entries: who may edit which section, the section timetable used by the
// plotter, saving a week of draft rows, and single-entry create / update / delete.
// Every write runs checkConflicts first (conflict.service.js) inside a transaction.
const pool = require('../../config/database')
const { HttpError } = require('../../utils/httpError')
const { withTimes } = require('./schedules.validation')
const { checkConflicts, checkConflictsForEntries } = require('./conflict.service')

const ROLE = { ADMIN: 1, CHAIR: 2, MASTER_TEACHER: 3, TEACHER: 4 }
const EDITABLE_STATUSES = ['draft', 'rejected']

// Entry columns plus readable names – shared by the plotter, teacher view, reports and guest view.
const ENTRY_DETAILS_SQL = `
  SELECT e.entry_id, e.term_id, e.section_id, e.subject_id, e.teacher_id, e.room_id, e.activity,
         e.day_of_week, e.start_min, e.end_min, e.status, e.created_by, e.created_at, e.updated_at,
         t.school_year, t.term_name,
         sec.section_name, gl.grade_level_id, gl.grade_level_name, gl.department_id, d.department_name,
         sub.subject_name, COALESCE(u.full_name, tea.last_name) AS teacher_name,
         r.room_number, r.building_id, b.building_name
  FROM schedule_entries e
  JOIN terms t ON t.term_id = e.term_id
  JOIN sections sec ON sec.section_id = e.section_id
  JOIN grade_levels gl ON gl.grade_level_id = sec.grade_level_id
  JOIN departments d ON d.department_id = gl.department_id
  LEFT JOIN subjects sub ON sub.subject_id = e.subject_id
  LEFT JOIN teachers tea ON tea.teacher_id = e.teacher_id
  LEFT JOIN users u ON u.user_id = tea.user_id
  LEFT JOIN rooms r ON r.room_id = e.room_id
  LEFT JOIN buildings b ON b.building_id = r.building_id
`
const DAY_ORDER_SQL = `array_position(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']::TEXT[], e.day_of_week::TEXT)`

// Runs fn(client) inside BEGIN / COMMIT, rolling back on any error.
const inTransaction = async fn => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

// Only one schedule change per term at a time, so two people saving at the same moment cannot
// both pass the conflict check. The lock is released automatically at COMMIT / ROLLBACK.
const lockTerm = (client, termId) => client.query('SELECT pg_advisory_xact_lock(4207, $1)', [termId])

const assertTermExists = async (termId, db = pool) => {
  const result = await db.query('SELECT term_id FROM terms WHERE term_id = $1', [termId])
  if (!result.rows[0]) throw new HttpError(404, 'Term not found.')
}

// Admin: every section. Grade Level Chairperson: sections of the assigned grade level.
// Master Teacher: sections of the same department. Others: none.
const assertSectionInScope = async (sectionId, user, db = pool) => {
  const result = await db.query(`
    SELECT sec.section_id, sec.section_name, gl.grade_level_id, gl.grade_level_name, gl.department_id
    FROM sections sec JOIN grade_levels gl ON gl.grade_level_id = sec.grade_level_id
    WHERE sec.section_id = $1
  `, [sectionId])
  const section = result.rows[0]
  if (!section) throw new HttpError(404, 'Section not found.')

  const role = Number(user.role_id)
  if (role === ROLE.ADMIN) return section
  const account = (await db.query('SELECT assigned_grade_level_id, department_id FROM users WHERE user_id = $1', [user.user_id])).rows[0] || {}
  if (role === ROLE.CHAIR && Number(account.assigned_grade_level_id) === section.grade_level_id) return section
  if (role === ROLE.MASTER_TEACHER && Number(account.department_id) === section.department_id) return section
  throw new HttpError(403, role === ROLE.CHAIR
    ? 'This section is outside the grade level assigned to your account.'
    : 'This section is outside your department.')
}

// draft if anything is still being edited, then pending, then approved; rejected only when nothing else is left.
const timetableStatus = statuses => ['draft', 'pending', 'approved', 'rejected'].find(status => statuses.includes(status)) || 'empty'

// Ids of a section's saved drafts – ignored when the plotter's unsaved rows replace them.
const getDraftIds = async (sectionId, termId, db = pool) => {
  const result = await db.query(`SELECT entry_id FROM schedule_entries WHERE section_id = $1 AND term_id = $2 AND status = 'draft'`, [sectionId, termId])
  return result.rows.map(row => row.entry_id)
}

const getTeacherIdForUser = async userId => {
  const result = await pool.query('SELECT teacher_id FROM teachers WHERE user_id = $1', [userId])
  return result.rows[0]?.teacher_id || null
}

// ---------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------

// filters: termId, sectionId, teacherId, roomId, departmentId, statuses (array)
const listEntries = async (filters = {}, db = pool) => {
  const result = await db.query(`
    ${ENTRY_DETAILS_SQL}
    WHERE ($1::INT IS NULL OR e.term_id = $1)
      AND ($2::INT IS NULL OR e.section_id = $2)
      AND ($3::INT IS NULL OR e.teacher_id = $3)
      AND ($4::INT IS NULL OR e.room_id = $4)
      AND ($5::INT IS NULL OR gl.department_id = $5)
      AND ($6::TEXT[] IS NULL OR e.status = ANY($6::TEXT[]))
    ORDER BY t.school_year, t.term_name, gl.grade_level_name, sec.section_name, ${DAY_ORDER_SQL}, e.start_min
  `, [filters.termId ?? null, filters.sectionId ?? null, filters.teacherId ?? null, filters.roomId ?? null,
    filters.departmentId ?? null, filters.statuses ?? null])
  return result.rows.map(withTimes)
}

const getEntry = async (entryId, db = pool) => {
  const result = await db.query(`${ENTRY_DETAILS_SQL} WHERE e.entry_id = $1`, [entryId])
  return result.rows[0] ? withTimes(result.rows[0]) : null
}

// The section's week for the plotter. Shows the active (not rejected) rows; when everything was
// rejected, shows the rows from the latest rejection so they can be revised.
const getSectionTimetable = async (sectionId, termId, db = pool) => {
  const all = await listEntries({ sectionId, termId }, db)
  const active = all.filter(entry => entry.status !== 'rejected')
  let entries = active
  let rejection = null
  if (!active.length) {
    // One rejection is one transaction, so its log rows share the same created_at.
    // (Compared inside SQL: JavaScript dates would drop the microseconds.)
    const latest = await db.query(`
      WITH section_logs AS (
        SELECT l.entry_id, l.notes, l.created_at FROM approval_logs l
        JOIN schedule_entries e ON e.entry_id = l.entry_id
        WHERE e.section_id = $1 AND e.term_id = $2 AND l.action = 'rejected'
      )
      SELECT entry_id, notes FROM section_logs
      WHERE created_at = (SELECT MAX(created_at) FROM section_logs)
    `, [sectionId, termId])
    if (latest.rows.length) {
      rejection = { notes: latest.rows[0].notes }
      const ids = new Set(latest.rows.map(row => row.entry_id))
      entries = all.filter(entry => ids.has(entry.entry_id))
    }
  }
  const header = await db.query('SELECT header FROM class_program_headers WHERE section_id = $1 AND term_id = $2', [sectionId, termId])
  return {
    term_id: termId,
    section_id: sectionId,
    status: timetableStatus(entries.map(entry => entry.status)),
    rejection_notes: rejection?.notes || null,
    header: header.rows[0]?.header || {},
    entries
  }
}

// ---------------------------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------------------------

const insertEntry = async (client, entry, userId) => {
  const result = await client.query(`
    INSERT INTO schedule_entries
      (term_id, section_id, subject_id, teacher_id, room_id, activity, day_of_week, start_min, end_min, status, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10)
    RETURNING entry_id
  `, [entry.term_id, entry.section_id, entry.subject_id, entry.teacher_id, entry.room_id, entry.activity,
    entry.day_of_week, entry.start_min, entry.end_min, userId])
  return result.rows[0].entry_id
}

const conflictError = (conflicts, teacherLoads) => new HttpError(409,
  `The schedule has ${conflicts.length} conflict(s). Fix them before saving.`,
  { code: 'SCHEDULE_CONFLICT', conflicts, ...(teacherLoads ? { teacher_loads: teacherLoads } : {}) })

// Saves the plotter's week for one section as drafts. Replaces the section's current drafts;
// refused while the section has pending or approved rows. Rejected rows stay as history.
const saveSectionDraft = ({ sectionId, termId, header, entries, user }) => inTransaction(async client => {
  await lockTerm(client, termId)
  await assertTermExists(termId, client)
  await assertSectionInScope(sectionId, user, client)

  const locked = await client.query(`
    SELECT status FROM schedule_entries
    WHERE section_id = $1 AND term_id = $2 AND status IN ('pending', 'approved') LIMIT 1
  `, [sectionId, termId])
  if (locked.rows[0]) {
    throw new HttpError(409, locked.rows[0].status === 'pending'
      ? 'This section\'s schedule is waiting for admin approval and cannot be changed now.'
      : 'This section already has an approved schedule. Edit single entries instead of replacing the week.')
  }

  await client.query(`DELETE FROM schedule_entries WHERE section_id = $1 AND term_id = $2 AND status = 'draft'`, [sectionId, termId])
  const { conflicts, teacherLoads } = await checkConflictsForEntries(entries, { termId, db: client })
  if (conflicts.length) throw conflictError(conflicts, teacherLoads)

  for (const entry of entries) await insertEntry(client, entry, user.user_id)
  await client.query(`
    INSERT INTO class_program_headers (term_id, section_id, header, updated_by, updated_at)
    VALUES ($1, $2, $3::JSONB, $4, NOW())
    ON CONFLICT (term_id, section_id) DO UPDATE SET header = EXCLUDED.header, updated_by = EXCLUDED.updated_by, updated_at = NOW()
  `, [termId, sectionId, JSON.stringify(header || {}), user.user_id])

  return { timetable: await getSectionTimetable(sectionId, termId, client), teacherLoads }
})

const createEntry = (entry, user) => inTransaction(async client => {
  await lockTerm(client, entry.term_id)
  await assertTermExists(entry.term_id, client)
  await assertSectionInScope(entry.section_id, user, client)
  const conflicts = await checkConflicts(entry, { db: client })
  if (conflicts.length) throw conflictError(conflicts)
  const entryId = await insertEntry(client, entry, user.user_id)
  return getEntry(entryId, client)
})

// Draft and rejected entries can be edited; the result is a draft again.
const updateEntry = (entryId, entry, user) => inTransaction(async client => {
  const current = (await client.query('SELECT * FROM schedule_entries WHERE entry_id = $1 FOR UPDATE', [entryId])).rows[0]
  if (!current) throw new HttpError(404, 'Schedule entry not found.')
  if (!EDITABLE_STATUSES.includes(current.status)) {
    throw new HttpError(409, `This entry is ${current.status}; only draft or rejected entries can be edited.`)
  }
  await lockTerm(client, entry.term_id)
  await assertTermExists(entry.term_id, client)
  await assertSectionInScope(current.section_id, user, client)
  await assertSectionInScope(entry.section_id, user, client)

  const conflicts = await checkConflicts({ ...entry, entry_id: entryId }, { db: client })
  if (conflicts.length) throw conflictError(conflicts)
  await client.query(`
    UPDATE schedule_entries
    SET term_id = $1, section_id = $2, subject_id = $3, teacher_id = $4, room_id = $5, activity = $6,
        day_of_week = $7, start_min = $8, end_min = $9, status = 'draft', updated_at = NOW()
    WHERE entry_id = $10
  `, [entry.term_id, entry.section_id, entry.subject_id, entry.teacher_id, entry.room_id, entry.activity,
    entry.day_of_week, entry.start_min, entry.end_min, entryId])
  return getEntry(entryId, client)
})

// Pending and approved entries cannot be deleted. Entries with approval history are protected by
// the approval_logs foreign key (ON DELETE RESTRICT) – the API turns that into a 409.
const deleteEntry = (entryId, user) => inTransaction(async client => {
  const current = (await client.query('SELECT entry_id, section_id, status FROM schedule_entries WHERE entry_id = $1 FOR UPDATE', [entryId])).rows[0]
  if (!current) throw new HttpError(404, 'Schedule entry not found.')
  await assertSectionInScope(current.section_id, user, client)
  if (!EDITABLE_STATUSES.includes(current.status)) {
    throw new HttpError(409, `This entry is ${current.status} and cannot be deleted.`, { code: 'DELETE_RESTRICTED' })
  }
  await client.query('DELETE FROM schedule_entries WHERE entry_id = $1', [entryId])
  return current
})

module.exports = {
  ROLE,
  ENTRY_DETAILS_SQL,
  inTransaction,
  lockTerm,
  assertTermExists,
  assertSectionInScope,
  timetableStatus,
  getDraftIds,
  getTeacherIdForUser,
  listEntries,
  getEntry,
  getSectionTimetable,
  saveSectionDraft,
  createEntry,
  updateEntry,
  deleteEntry
}
