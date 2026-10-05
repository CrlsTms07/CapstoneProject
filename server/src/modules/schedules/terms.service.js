// HIPO 3.2 – Schedule Plotter (terms)
// Data access for terms: a school year plus a term name (Full Year for JHS, semesters for SHS).
const { inTransaction } = require('./schedules.service')
const pool = require('../../config/database')

const listTerms = async () => {
  const result = await pool.query('SELECT * FROM terms ORDER BY school_year DESC, term_name')
  return result.rows
}

const getActiveTerm = async () => {
  const result = await pool.query('SELECT * FROM terms WHERE is_active LIMIT 1')
  return result.rows[0] || null
}

// Saving a term as active makes every other term inactive.
const saveTerm = ({ termId = null, schoolYear, termName, isActive }) => inTransaction(async client => {
  if (isActive) await client.query('UPDATE terms SET is_active = FALSE WHERE is_active AND term_id IS DISTINCT FROM $1', [termId])
  const result = termId
    ? await client.query('UPDATE terms SET school_year = $1, term_name = $2, is_active = $3 WHERE term_id = $4 RETURNING *', [schoolYear, termName, isActive, termId])
    : await client.query('INSERT INTO terms (school_year, term_name, is_active) VALUES ($1, $2, $3) RETURNING *', [schoolYear, termName, isActive])
  return result.rows[0] || null
})

// Blocked by ON DELETE RESTRICT while schedule entries use the term.
const deleteTerm = async termId => {
  const result = await pool.query('DELETE FROM terms WHERE term_id = $1 RETURNING *', [termId])
  return result.rows[0] || null
}

module.exports = { listTerms, getActiveTerm, saveTerm, deleteTerm }
