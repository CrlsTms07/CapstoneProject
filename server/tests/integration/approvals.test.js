// HIPO 5.0 – Approvals (integration tests)
// The full status flow on the real API: draft -> pending -> rejected -> revised -> pending -> approved,
// with every step written to approval_logs, and only approved classes visible to teachers.
const { pool, resetTestDatabase, seedFixtures } = require('../helpers/testDatabase')
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, login } = require('../helpers/httpClient')

let server, baseUrl, school, admin, chair7, chair11, master, teacherCruz

before(async () => {
  await resetTestDatabase()
  school = await seedFixtures()
  ;({ server, baseUrl } = await startServer())
  admin = await login(baseUrl, 'admin')
  chair7 = await login(baseUrl, 'chair7')
  chair11 = await login(baseUrl, 'chair11')
  master = await login(baseUrl, 'master')
  teacherCruz = await login(baseUrl, 'cruz')
})

after(async () => {
  server.close()
  await pool.end()
})

const rizal = () => ({ term_id: school.termId, section_id: school.sections.rizal })

// Math 7 on Monday and Tuesday at the given time.
const week = startTime => ({
  term_id: school.termId,
  entries: ['Monday', 'Tuesday'].map(day => ({
    day_of_week: day, start_time: startTime, duration_minutes: 45,
    subject_id: school.subjects.math7, teacher_id: school.teachers.cruz, room_id: school.rooms.r101
  }))
})

// One row per action (all log rows of one action share the same created_at).
const logActions = async () => (await pool.query(`
  SELECT action, from_status, to_status, COUNT(*)::INT AS entries FROM approval_logs
  GROUP BY created_at, action, from_status, to_status ORDER BY MIN(log_id)
`)).rows

describe('schedule status flow', () => {
  it('starts as a draft saved from the plotter', async () => {
    const saved = await chair7.put(`/api/schedules/section/${school.sections.rizal}`, week('07:30'))
    assert.equal(saved.status, 200)
    assert.equal(saved.body.status, 'draft')
  })

  it('cannot be submitted by a teacher or by a chair of another grade', async () => {
    assert.equal((await teacherCruz.post('/api/approvals/submit', rizal())).status, 403)
    assert.equal((await chair11.post('/api/approvals/submit', rizal())).status, 403)
  })

  it('is submitted by the grade level chairperson: draft -> pending', async () => {
    const response = await chair7.post('/api/approvals/submit', { ...rizal(), notes: 'Ready for review' })
    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.deepEqual(response.body, { term_id: school.termId, section_id: school.sections.rizal, status: 'pending', entry_count: 2 })
    assert.equal((await chair7.post('/api/approvals/submit', rizal())).status, 409, 'nothing left to submit')
  })

  it('shows up in the admin review queue with its entries, but not for another grade', async () => {
    const queue = await admin.get('/api/approvals/submissions?status=pending')
    assert.equal(queue.status, 200)
    assert.equal(queue.body.length, 1)
    assert.equal(queue.body[0].section_name, 'Rizal')
    assert.equal(queue.body[0].last_action, 'submitted')
    assert.equal(queue.body[0].entries.length, 2)
    assert.deepEqual((await chair11.get('/api/approvals/submissions?status=pending')).body, [])
  })

  it('stays hidden from the teacher while pending', async () => {
    assert.deepEqual((await teacherCruz.get('/api/schedules')).body, [])
  })

  it('can only be reviewed by the admin, and a rejection needs a reason', async () => {
    assert.equal((await chair7.post('/api/approvals/review', { ...rizal(), decision: 'approved' })).status, 403)
    assert.equal((await master.post('/api/approvals/review', { ...rizal(), decision: 'approved' })).status, 403)
    assert.equal((await admin.post('/api/approvals/review', { ...rizal(), decision: 'rejected' })).status, 400)
  })

  it('is rejected by the admin with notes the planner can read', async () => {
    const response = await admin.post('/api/approvals/review', { ...rizal(), decision: 'rejected', notes: 'Math should be after recess.' })
    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'rejected')
    const plotter = await chair7.get(`/api/schedules/section/${school.sections.rizal}?term_id=${school.termId}`)
    assert.equal(plotter.body.status, 'rejected')
    assert.equal(plotter.body.rejection_notes, 'Math should be after recess.')
    assert.equal(plotter.body.entries.length, 2)
  })

  it('is revised, resubmitted and approved', async () => {
    assert.equal((await chair7.put(`/api/schedules/section/${school.sections.rizal}`, week('10:00'))).status, 200)
    assert.equal((await master.post('/api/approvals/submit', rizal())).status, 200, 'a master teacher of the department may submit too')
    assert.equal((await admin.post('/api/approvals/review', { ...rizal(), decision: 'approved' })).status, 200)
    assert.equal((await admin.post('/api/approvals/review', { ...rizal(), decision: 'approved' })).status, 409, 'nothing pending any more')
  })

  it('records every action in approval_logs', async () => {
    assert.deepEqual(await logActions(), [
      { action: 'submitted', from_status: 'draft', to_status: 'pending', entries: 2 },
      { action: 'rejected', from_status: 'pending', to_status: 'rejected', entries: 2 },
      { action: 'submitted', from_status: 'draft', to_status: 'pending', entries: 2 },
      { action: 'approved', from_status: 'pending', to_status: 'approved', entries: 2 }
    ])
    const logs = await chair7.get(`/api/approvals/logs?section_id=${school.sections.rizal}`)
    assert.equal(logs.status, 200)
    assert.equal(logs.body.length, 8)
    assert.equal(logs.body[0].action, 'approved')
    assert.equal(logs.body[0].performed_by_name, 'admin')
    assert.equal(logs.body.at(-1).notes, 'Ready for review')
  })

  it('shows only the approved classes to the teacher', async () => {
    const response = await teacherCruz.get('/api/schedules')
    assert.deepEqual(response.body.map(entry => [entry.day_of_week, entry.start_time, entry.status]), [['Monday', '10:00', 'approved'], ['Tuesday', '10:00', 'approved']])
  })

  it('keeps the approved week from being overwritten or deleted', async () => {
    assert.equal((await chair7.put(`/api/schedules/section/${school.sections.rizal}`, week('13:00'))).status, 409)
    const approvedId = (await admin.get('/api/schedules?status=approved')).body[0].entry_id
    assert.equal((await admin.delete(`/api/schedules/${approvedId}`)).status, 409)
  })
})
