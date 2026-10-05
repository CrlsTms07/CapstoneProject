// HIPO 3.2 – Schedule Plotter (terms)
// HTTP handlers for /api/terms.
const { HttpError, handle } = require('../../utils/httpError')
const { requireId } = require('./schedules.validation')
const { listTerms, getActiveTerm, saveTerm, deleteTerm } = require('./terms.service')

const readTermBody = body => {
  const schoolYear = String(body.school_year || '').trim()
  const [start, end] = schoolYear.split('-').map(Number)
  if (!/^\d{4}-\d{4}$/.test(schoolYear) || end !== start + 1) throw new HttpError(400, 'School year must look like 2026-2027.')
  const termName = String(body.term_name || 'Full Year').trim().slice(0, 40)
  return { schoolYear, termName, isActive: Boolean(body.is_active) }
}

const getTerms = handle(async (req, res) => {
  res.json({ terms: await listTerms(), active_term: await getActiveTerm() })
})

const createTerm = handle(async (req, res) => {
  res.status(201).json(await saveTerm(readTermBody(req.body)))
})

const updateTerm = handle(async (req, res) => {
  const term = await saveTerm({ termId: requireId(req.params.id, 'Term id'), ...readTermBody(req.body) })
  if (!term) throw new HttpError(404, 'Term not found.')
  res.json(term)
})

const removeTerm = handle(async (req, res) => {
  const term = await deleteTerm(requireId(req.params.id, 'Term id'))
  if (!term) throw new HttpError(404, 'Term not found.')
  res.json({ message: 'Term deleted.', term })
}, { action: 'delete' })

module.exports = { getTerms, createTerm, updateTerm, removeTerm }
