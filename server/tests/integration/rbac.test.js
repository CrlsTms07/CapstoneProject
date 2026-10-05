// Shared – RBAC (integration tests)
// authenticate / authorize / scopeToDepartment on real routes.
const { pool, resetTestDatabase, seedFixtures, insertEntry } = require('../helpers/testDatabase')
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, makeClient, login } = require('../helpers/httpClient')

let server, baseUrl, school, guest, admin, chair7, chairNone, master, teacherCruz

before(async () => {
  await resetTestDatabase()
  school = await seedFixtures()
  ;({ server, baseUrl } = await startServer())
  guest = makeClient(baseUrl)
  admin = await login(baseUrl, 'admin')
  chair7 = await login(baseUrl, 'chair7')
  chairNone = await login(baseUrl, 'chairnone')
  master = await login(baseUrl, 'master')
  teacherCruz = await login(baseUrl, 'cruz')
})

after(async () => {
  server.close()
  await pool.end()
})

describe('master data routes (were open to everyone before)', () => {
  const routes = ['/api/rooms', '/api/buildings', '/api/departments', '/api/grade-levels', '/api/sections', '/api/subjects', '/api/time-slots']

  it('require a login, even for reading', async () => {
    for (const route of routes) {
      assert.equal((await guest.get(route)).status, 401, route)
      assert.equal((await guest.post(route, {})).status, 401, route)
    }
  })

  it('can be read by any signed-in user', async () => {
    for (const route of routes) assert.equal((await teacherCruz.get(route)).status, 200, route)
  })

  it('can only be changed by the roles that manage them', async () => {
    assert.equal((await teacherCruz.delete(`/api/rooms/${school.rooms.r101}`)).status, 403)
    assert.equal((await chair7.post('/api/rooms', { building_id: 1, room_number: 'X' })).status, 403)
    assert.equal((await master.post('/api/sections', { section_name: 'X', grade_level_id: school.gradeLevels.grade7 })).status, 403)
    assert.equal((await chair7.post('/api/subjects', { subject_name: 'X', grade_level_id: school.gradeLevels.grade7 })).status, 403)
    const created = await admin.post('/api/time-slots', { department_id: school.departments.jhs, start_time: '07:00' })
    assert.equal(created.status, 201)
  })
})

describe('scopeToDepartment', () => {
  before(async () => {
    const base = { term_id: school.termId, subject_id: school.subjects.math7, teacher_id: school.teachers.cruz, room_id: school.rooms.r101, day_of_week: 'Monday', status: 'approved' }
    await insertEntry({ ...base, section_id: school.sections.rizal, start_min: 450, end_min: 495 })
    await insertEntry({ ...base, section_id: school.sections.stemA, subject_id: school.subjects.genMath, teacher_id: school.teachers.reyes, room_id: school.rooms.r201, start_min: 480, end_min: 540 })
  })

  it('stops a chairperson without an assigned grade level, with a clear message', async () => {
    const response = await chairNone.get('/api/schedules')
    assert.equal(response.status, 403)
    assert.match(response.body.error, /assign your grade level/)
  })

  it('limits a master teacher to their own department', async () => {
    const response = await master.get('/api/schedules')
    assert.equal(response.status, 200)
    assert.deepEqual(response.body.map(entry => entry.section_name), ['Rizal'])
    const stemEntry = (await admin.get('/api/schedules')).body.find(entry => entry.section_name === 'STEM A')
    assert.equal((await master.get(`/api/schedules/${stemEntry.entry_id}`)).status, 404)
  })

  it('lets the admin see every department', async () => {
    const response = await admin.get('/api/schedules')
    assert.deepEqual(response.body.map(entry => entry.section_name).sort(), ['Rizal', 'STEM A'])
  })
})
