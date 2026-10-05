// HIPO 10.0 – Guest schedule view (integration tests)
// /api/public works without a login, is read-only, and returns approved entries only.
const { pool, resetTestDatabase, seedFixtures, insertEntry } = require('../helpers/testDatabase')
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, makeClient } = require('../helpers/httpClient')

let server, guest, school

before(async () => {
  await resetTestDatabase()
  school = await seedFixtures()
  const started = await startServer()
  server = started.server
  guest = makeClient(started.baseUrl)
  const base = { term_id: school.termId, subject_id: school.subjects.math7, teacher_id: school.teachers.cruz, room_id: school.rooms.r101, start_min: 450, end_min: 495 }
  await insertEntry({ ...base, section_id: school.sections.rizal, day_of_week: 'Monday', status: 'approved' })
  await insertEntry({ ...base, section_id: school.sections.rizal, day_of_week: 'Tuesday', status: 'pending' })
  await insertEntry({ ...base, section_id: school.sections.rizal, day_of_week: 'Wednesday', status: 'draft' })
  await insertEntry({ ...base, section_id: school.sections.mabini, room_id: school.rooms.r102, day_of_week: 'Thursday', status: 'rejected' })
  await insertEntry({ term_id: school.termId, section_id: school.sections.stemA, subject_id: school.subjects.genMath, teacher_id: school.teachers.reyes, room_id: school.rooms.r201, day_of_week: 'Friday', start_min: 480, end_min: 540, status: 'approved' })
})

after(async () => {
  server.close()
  await pool.end()
})

describe('GET /api/public/schedules', () => {
  it('needs no login and returns only approved entries', async () => {
    const response = await guest.get('/api/public/schedules')
    assert.equal(response.status, 200)
    assert.deepEqual(response.body.map(entry => [entry.section_name, entry.day_of_week]).sort(), [['Rizal', 'Monday'], ['STEM A', 'Friday']])
  })

  it('returns only guest-safe fields', async () => {
    const [entry] = (await guest.get('/api/public/schedules')).body
    assert.equal(entry.status, undefined)
    assert.equal(entry.created_by, undefined)
    assert.equal(entry.teacher_id, undefined)
    assert.ok(entry.teacher_name && entry.start_time && entry.room_number)
  })

  it('filters by department and section', async () => {
    const shs = await guest.get(`/api/public/schedules?department_id=${school.departments.shs}`)
    assert.deepEqual(shs.body.map(entry => entry.section_name), ['STEM A'])
    const rizal = await guest.get(`/api/public/schedules?section_id=${school.sections.rizal}`)
    assert.deepEqual(rizal.body.map(entry => entry.day_of_week), ['Monday'])
    assert.equal((await guest.get('/api/public/schedules?section_id=abc')).status, 400)
  })
})

describe('other guest endpoints', () => {
  it('list terms, departments and sections for the filters', async () => {
    assert.equal((await guest.get('/api/public/terms')).body[0].is_active, true)
    assert.deepEqual((await guest.get('/api/public/departments')).body.map(item => item.department_name), ['Junior High School', 'Senior High School'])
    const sections = await guest.get(`/api/public/sections?department_id=${school.departments.jhs}`)
    assert.deepEqual(sections.body.map(item => item.section_name), ['Mabini', 'Rizal'])
  })

  it('are read-only', async () => {
    for (const path of ['/api/public/schedules', '/api/public/terms']) {
      assert.equal((await guest.post(path, {})).status, 405)
      assert.equal((await guest.delete(path)).status, 405)
    }
  })
})
