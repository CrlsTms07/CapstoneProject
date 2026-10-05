// HIPO 5.0 – Approvals
// The schedule status flow and its audit trail:
//
//   draft ──submit (chair / master teacher / admin)──> pending ──review (admin)──> approved
//                                                                             └──> rejected
//
// A whole section week moves together. Every change writes one approval_logs row per entry
// (who, when, from which status to which, notes). Only approved entries reach reports,
// teacher views and the guest view.
const pool = require('../../config/database')
const { HttpError } = require('../../utils/httpError')
const { inTransaction, lockTerm, assertTermExists, assertSectionInScope, timetableStatus, listEntries } = require('../schedules/schedules.service')

// Moves the given entries to a new status and writes the audit rows.
const changeStatus = async (client, { entryIds, action, fromStatus, toStatus, userId, notes }) => {
  await client.query('UPDATE schedule_entries SET status = $1, updated_at = NOW() WHERE entry_id = ANY($2::INT[])', [toStatus, entryIds])
  await client.query(`
    INSERT INTO approval_logs (entry_id, action, from_status, to_status, performed_by, notes)
    SELECT UNNEST($1::INT[]), $2::VARCHAR, $3::VARCHAR, $4::VARCHAR, $5::INT, $6::TEXT
  `, [entryIds, action, fromStatus, toStatus, userId, notes || null])
}

const lockedEntries = async (client, { termId, sectionId, status }) => (await client.query(`
  SELECT entry_id, subject_id FROM schedule_entries
  WHERE term_id = $1 AND section_id = $2 AND status = $3
  FOR UPDATE
`, [termId, sectionId, status])).rows

// draft -> pending. The drafts were conflict-checked when they were saved, and the exclusion
// constraints keep protecting them, so they are not checked again here.
const submitSection = ({ termId, sectionId, notes, actor }) => inTransaction(async client => {
  await lockTerm(client, termId)
  await assertTermExists(termId, client)
  await assertSectionInScope(sectionId, actor.scope, client)
  const drafts = await lockedEntries(client, { termId, sectionId, status: 'draft' })
  if (!drafts.length) throw new HttpError(409, 'There is no draft to submit. Save the schedule as a draft first.')
  if (!drafts.some(entry => entry.subject_id)) throw new HttpError(400, 'Add at least one class (not only breaks) before submitting.')
  const entryIds = drafts.map(entry => entry.entry_id)
  await changeStatus(client, { entryIds, action: 'submitted', fromStatus: 'draft', toStatus: 'pending', userId: actor.userId, notes })
  return { term_id: termId, section_id: sectionId, status: 'pending', entry_count: entryIds.length }
})

// pending -> approved / rejected (admin only – enforced by the route). Rejections need a reason.
const reviewSection = ({ termId, sectionId, decision, notes, actor }) => inTransaction(async client => {
  await lockTerm(client, termId)
  await assertTermExists(termId, client)
  const pending = await lockedEntries(client, { termId, sectionId, status: 'pending' })
  if (!pending.length) throw new HttpError(409, 'This section has no schedule waiting for approval.')
  const entryIds = pending.map(entry => entry.entry_id)
  await changeStatus(client, { entryIds, action: decision, fromStatus: 'pending', toStatus: decision, userId: actor.userId, notes })
  return { term_id: termId, section_id: sectionId, status: decision, entry_count: entryIds.length }
})

// Scope as SQL: admin sees all; chairs their grade level; master teachers their department.
const scopeFilter = (scope, params) => {
  if (scope.isAdmin) return ''
  if (scope.gradeLevelId) {
    params.push(scope.gradeLevelId)
    return ` AND gl.grade_level_id = $${params.length}`
  }
  params.push(scope.departmentId)
  return ` AND gl.department_id = $${params.length}`
}

// One row per section and term with its overall status and the last action taken.
// status filter: 'draft' | 'pending' | 'approved' | 'rejected'. withEntries adds the rows to review.
const listSubmissions = async ({ scope, termId = null, status = null, withEntries = false }) => {
  const params = [termId]
  const where = scopeFilter(scope, params)
  const result = await pool.query(`
    WITH section_terms AS (
      SELECT term_id, section_id, ARRAY_AGG(DISTINCT status) AS statuses,
             COUNT(*) FILTER (WHERE status <> 'rejected')::INT AS active_entries
      FROM schedule_entries GROUP BY term_id, section_id
    ), last_action AS (
      SELECT DISTINCT ON (e.term_id, e.section_id) e.term_id, e.section_id,
             l.action, l.notes, l.created_at, COALESCE(u.full_name, u.username) AS performed_by_name
      FROM approval_logs l
      JOIN schedule_entries e ON e.entry_id = l.entry_id
      JOIN users u ON u.user_id = l.performed_by
      ORDER BY e.term_id, e.section_id, l.created_at DESC, l.log_id DESC
    )
    SELECT st.term_id, t.school_year, t.term_name, st.section_id, sec.section_name,
           gl.grade_level_id, gl.grade_level_name, gl.department_id, d.department_name,
           st.statuses, st.active_entries,
           la.action AS last_action, la.notes AS last_notes, la.created_at AS last_action_at, la.performed_by_name
    FROM section_terms st
    JOIN terms t ON t.term_id = st.term_id
    JOIN sections sec ON sec.section_id = st.section_id
    JOIN grade_levels gl ON gl.grade_level_id = sec.grade_level_id
    JOIN departments d ON d.department_id = gl.department_id
    LEFT JOIN last_action la ON la.term_id = st.term_id AND la.section_id = st.section_id
    WHERE ($1::INT IS NULL OR st.term_id = $1)${where}
    ORDER BY t.school_year DESC, gl.grade_level_name, sec.section_name
  `, params)

  const submissions = result.rows
    .map(({ statuses, ...row }) => ({ ...row, status: timetableStatus(statuses) }))
    .filter(row => !status || row.status === status)
  if (withEntries) {
    for (const submission of submissions) {
      submission.entries = await listEntries({ termId: submission.term_id, sectionId: submission.section_id, statuses: [submission.status] })
    }
  }
  return submissions
}

// The audit trail, newest first.
const listLogs = async ({ scope, termId = null, sectionId = null, limit = 200 }) => {
  const params = [termId, sectionId, limit]
  const where = scopeFilter(scope, params)
  const result = await pool.query(`
    SELECT l.log_id, l.entry_id, l.action, l.from_status, l.to_status, l.notes, l.created_at,
           COALESCE(u.full_name, u.username) AS performed_by_name,
           e.term_id, e.section_id, sec.section_name, gl.grade_level_name,
           e.day_of_week, e.start_min, e.end_min, sub.subject_name, e.activity
    FROM approval_logs l
    JOIN users u ON u.user_id = l.performed_by
    JOIN schedule_entries e ON e.entry_id = l.entry_id
    JOIN sections sec ON sec.section_id = e.section_id
    JOIN grade_levels gl ON gl.grade_level_id = sec.grade_level_id
    LEFT JOIN subjects sub ON sub.subject_id = e.subject_id
    WHERE ($1::INT IS NULL OR e.term_id = $1) AND ($2::INT IS NULL OR e.section_id = $2)${where}
    ORDER BY l.created_at DESC, l.log_id DESC
    LIMIT $3
  `, params)
  return result.rows
}

module.exports = { submitSection, reviewSection, listSubmissions, listLogs }
