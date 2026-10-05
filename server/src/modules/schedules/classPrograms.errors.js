// HIPO 3.2 – Schedule Plotter / HIPO 5.0 – Approvals
// Maps PostgreSQL errors from class-program queries to HTTP responses
// (23P01/23505 conflict -> 409, 23503 missing resource -> 400, 23514 invalid entry -> 400).
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

module.exports = { sendDatabaseError }
