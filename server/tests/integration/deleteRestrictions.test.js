// Shared – deletion restrictions (integration tests)
// Records used by schedule entries are protected by ON DELETE RESTRICT. Through the API, deleting
// them must answer 409 with a readable message (not 500), and nothing may be deleted.
const { pool, resetTestDatabase, seedFixtures, insertEntry } = require('../helpers/testDatabase')
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, login } = require('../helpers/httpClient')

let server, school, admin

const idOf = async (sql, params) => Object.values((await pool.query(sql, params)).rows[0])[0]
const countOf = async table => idOf(`SELECT COUNT(*)::INT FROM ${table}`)

before(async () => {
  await resetTestDatabase()
  school = await seedFixtures()
  const started = await startServer()
  server = started.server
  admin = await login(started.baseUrl, 'admin')
  await insertEntry({ term_id: school.termId, section_id: school.sections.rizal, subject_id: school.subjects.math7, teacher_id: school.teachers.cruz, room_id: school.rooms.r101, day_of_week: 'Monday', start_min: 450, end_min: 495, status: 'approved' })
})

after(async () => {
  server.close()
  await pool.end()
})

describe('DELETE on records that a schedule still uses', () => {
  it('answers 409 DELETE_RESTRICTED with a readable message for every kind of record', async () => {
    const cruzUserId = await idOf('SELECT user_id FROM teachers WHERE teacher_id = $1', [school.teachers.cruz])
    const jhsBuildingId = await idOf('SELECT building_id FROM rooms WHERE room_id = $1', [school.rooms.r101])
    const blocked = [
      `/api/teachers/${school.teachers.cruz}`,
      `/api/users/${cruzUserId}`, // the teacher row would cascade, but it is still scheduled
      `/api/rooms/${school.rooms.r101}`,
      `/api/buildings/${jhsBuildingId}`, // its rooms would cascade
      `/api/subjects/${school.subjects.math7}`,
      `/api/sections/${school.sections.rizal}`,
      `/api/departments/${school.departments.jhs}`,
      `/api/terms/${school.termId}`
    ]
    for (const path of blocked) {
      const response = await admin.delete(path)
      assert.equal(response.status, 409, `${path} -> ${JSON.stringify(response.body)}`)
      assert.equal(response.body.code, 'DELETE_RESTRICTED', path)
      assert.match(response.body.error, /cannot be deleted because it is still used by schedule entries/, path)
    }
  })

  it('also protects a grade level that a chairperson is assigned to', async () => {
    // Grade 7 has scheduled sections AND chair7 assigned to it; whichever RESTRICT key PostgreSQL checks
    // first is named in the message.
    const response = await admin.delete(`/api/grade-levels/${school.gradeLevels.grade7}`)
    assert.equal(response.status, 409)
    assert.match(response.body.error, /still used by (schedule entries|user accounts)/)
  })

  it('left every record and the schedule in place', async () => {
    assert.equal(await countOf('schedule_entries'), 1)
    assert.equal(await countOf('teachers'), 3)
    assert.equal(await countOf('rooms'), 5)
    assert.equal(await countOf('sections'), 3)
  })

  it('still deletes records that nothing uses', async () => {
    const response = await admin.delete(`/api/rooms/${school.rooms.r203}`)
    assert.equal(response.status, 200)
    assert.equal(await countOf('rooms'), 4)
  })
})
