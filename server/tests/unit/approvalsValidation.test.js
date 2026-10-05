// HIPO 5.0 – Approvals (unit tests)
// Request checks in approvals.validation.js.
require('../helpers/unitTestEnv')
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { readSubmission, readReview, readSubmissionFilters } = require('../../src/modules/approvals/approvals.validation')

describe('approvals validation', () => {
  it('reads a submission', () => {
    assert.deepEqual(readSubmission({ term_id: '2', section_id: 5, notes: '  ready  ' }), { termId: 2, sectionId: 5, notes: 'ready' })
    assert.throws(() => readSubmission({ section_id: 5 }), /term_id is required/)
  })

  it('accepts only approved / rejected as a decision', () => {
    assert.equal(readReview({ term_id: 1, section_id: 1, decision: 'APPROVED' }).decision, 'approved')
    assert.throws(() => readReview({ term_id: 1, section_id: 1, decision: 'maybe' }), /must be "approved" or "rejected"/)
  })

  it('requires a reason when rejecting', () => {
    assert.throws(() => readReview({ term_id: 1, section_id: 1, decision: 'rejected', notes: '   ' }), error => error.status === 400 && /short reason/.test(error.message))
    assert.equal(readReview({ term_id: 1, section_id: 1, decision: 'rejected', notes: 'Room clash with assembly' }).notes, 'Room clash with assembly')
  })

  it('checks the status filter', () => {
    assert.deepEqual(readSubmissionFilters({ status: 'pending' }), { termId: null, status: 'pending' })
    assert.throws(() => readSubmissionFilters({ status: 'done' }), /status must be one of/)
  })
})
