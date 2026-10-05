// HIPO 5.0 – Approvals
// Pure request checks for submitting and reviewing a section's schedule.
const { HttpError } = require('../../utils/httpError')
const { requireId, positiveIdOrNull, ENTRY_STATUSES } = require('../schedules/schedules.validation')

const DECISIONS = ['approved', 'rejected']
const MAX_NOTES_LENGTH = 1000

const readNotes = value => String(value || '').trim().slice(0, MAX_NOTES_LENGTH) || null

// { term_id, section_id, notes? }
const readSubmission = body => ({
  termId: requireId(body.term_id, 'term_id'),
  sectionId: requireId(body.section_id, 'section_id'),
  notes: readNotes(body.notes)
})

// { term_id, section_id, decision: 'approved' | 'rejected', notes } – a rejection must say why.
const readReview = body => {
  const decision = String(body.decision || '').toLowerCase()
  if (!DECISIONS.includes(decision)) throw new HttpError(400, 'decision must be "approved" or "rejected".')
  const notes = readNotes(body.notes)
  if (decision === 'rejected' && !notes) throw new HttpError(400, 'Write a short reason when rejecting, so the planner knows what to fix.')
  return { ...readSubmission(body), decision, notes }
}

// ?term_id=&status=
const readSubmissionFilters = query => {
  const status = query.status ? String(query.status) : null
  if (status && !ENTRY_STATUSES.includes(status)) throw new HttpError(400, `status must be one of: ${ENTRY_STATUSES.join(', ')}.`)
  return { termId: positiveIdOrNull(query.term_id), status }
}

module.exports = { readSubmission, readReview, readSubmissionFilters }
