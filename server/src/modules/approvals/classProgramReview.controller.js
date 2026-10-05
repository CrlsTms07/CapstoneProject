// HIPO 5.0 – Approvals (JHS class programs)
// Admin review queue: list pending class programs and approve/reject them. Each decision is
// appended to jhs_class_program_approvals (audit trail with notes).
const pool = require('../../config/database')
const { loadProgram } = require('../schedules/schedules.service')
const { sendDatabaseError } = require('../schedules/classPrograms.errors')

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

module.exports = { getPendingClassPrograms, reviewClassProgram }
