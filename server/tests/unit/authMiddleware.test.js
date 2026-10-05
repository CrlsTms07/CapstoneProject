// Shared (unit tests)
// authenticate and authorize from src/middleware/authMiddleware.js, with fake req / res objects.
require('../helpers/unitTestEnv')
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { ROLES, authenticate, authorize } = require('../../src/middleware/authMiddleware')

// Runs a middleware and reports whether it called next() or answered with a status.
const run = (middleware, sessionUser) => {
  const result = { nextCalled: false, status: null, body: null }
  const req = { session: sessionUser === undefined ? {} : { user: sessionUser } }
  const res = {
    status (code) { result.status = code; return this },
    json (body) { result.body = body; return this }
  }
  middleware(req, res, () => { result.nextCalled = true })
  return result
}

describe('authenticate', () => {
  it('answers 401 without a signed-in user', () => {
    assert.equal(run(authenticate).status, 401)
  })

  it('lets a signed-in user through', () => {
    assert.equal(run(authenticate, { user_id: 1, role_id: ROLES.TEACHER }).nextCalled, true)
  })

  it('blocks users who must change their temporary password first', () => {
    const result = run(authenticate, { user_id: 1, role_id: ROLES.TEACHER, must_change_password: true })
    assert.equal(result.status, 403)
    assert.equal(result.body.code, 'PASSWORD_CHANGE_REQUIRED')
  })
})

describe('authorize', () => {
  const adminsAndChairs = authorize(ROLES.ADMIN, ROLES.CHAIR)

  it('allows the listed roles', () => {
    assert.equal(run(adminsAndChairs, { role_id: ROLES.CHAIR }).nextCalled, true)
    assert.equal(run(adminsAndChairs, { role_id: String(ROLES.ADMIN) }).nextCalled, true, 'role ids stored as text still work')
  })

  it('answers 403 for other roles and 401 without a user', () => {
    assert.equal(run(adminsAndChairs, { role_id: ROLES.TEACHER }).status, 403)
    assert.equal(run(adminsAndChairs).status, 401)
  })
})
