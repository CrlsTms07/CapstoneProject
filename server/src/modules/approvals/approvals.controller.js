// HIPO 5.0 – Approvals
// HTTP handlers for /api/approvals: submit a section week, admin review, submissions list and audit log.
const { handle } = require('../../utils/httpError')
const { positiveIdOrNull } = require('../schedules/schedules.validation')
const { readSubmission, readReview, readSubmissionFilters } = require('./approvals.validation')
const { submitSection, reviewSection, listSubmissions, listLogs } = require('./approvals.service')

const actorOf = req => ({ userId: req.session.user.user_id, scope: req.scope })

// POST /api/approvals/submit – draft -> pending
const submit = handle(async (req, res) => {
  res.json(await submitSection({ ...readSubmission(req.body), actor: actorOf(req) }))
})

// POST /api/approvals/review – pending -> approved / rejected (admin)
const review = handle(async (req, res) => {
  res.json(await reviewSection({ ...readReview(req.body), actor: actorOf(req) }))
})

// GET /api/approvals/submissions?term_id=&status= – pending ones include their entries for review
const getSubmissions = handle(async (req, res) => {
  const filters = readSubmissionFilters(req.query)
  res.json(await listSubmissions({ ...filters, scope: req.scope, withEntries: filters.status === 'pending' }))
})

// GET /api/approvals/logs?term_id=&section_id=
const getLogs = handle(async (req, res) => {
  res.json(await listLogs({ scope: req.scope, termId: positiveIdOrNull(req.query.term_id), sectionId: positiveIdOrNull(req.query.section_id) }))
})

module.exports = { submit, review, getSubmissions, getLogs }
