// Shared (unit tests)
// PostgreSQL error codes -> readable HTTP errors (src/utils/httpError.js).
require('../helpers/unitTestEnv')
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { HttpError, fromDatabaseError } = require('../../src/utils/httpError')

describe('fromDatabaseError', () => {
  it('turns an exclusion violation into a 409 that names the double-booked resource', () => {
    const error = fromDatabaseError({ code: '23P01', constraint: 'schedule_entries_room_no_overlap' })
    assert.equal(error.status, 409)
    assert.match(error.message, /room is already used/)
  })

  it('turns a blocked DELETE (ON DELETE RESTRICT) into a 409 that says what still uses the record', () => {
    const pgError = { code: '23503', message: 'update or delete on table "teachers" violates foreign key constraint "schedule_entries_teacher_id_fkey" on table "schedule_entries"' }
    const error = fromDatabaseError(pgError)
    assert.equal(error.status, 409)
    assert.equal(error.details.code, 'DELETE_RESTRICTED')
    assert.match(error.message, /still used by schedule entries/)
  })

  it('handles 23001, the code PostgreSQL uses for an explicit ON DELETE RESTRICT', () => {
    const pgError = { code: '23001', message: 'update or delete on table "schedule_entries" violates RESTRICT setting of foreign key constraint "approval_logs_entry_id_fkey" on table "approval_logs"' }
    const error = fromDatabaseError(pgError)
    assert.equal(error.status, 409)
    assert.match(error.message, /still used by approval history/)
  })

  it('turns a missing reference on INSERT into a 400', () => {
    const error = fromDatabaseError({ code: '23503', message: 'insert or update on table "schedule_entries" violates foreign key constraint' })
    assert.equal(error.status, 400)
  })

  it('leaves unknown errors alone (they become a 500)', () => {
    assert.equal(fromDatabaseError(new Error('boom')), null)
    assert.ok(new HttpError(418, 'x') instanceof Error)
  })
})
