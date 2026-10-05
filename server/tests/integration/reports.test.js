// HIPO 6.0 / 7.0 – Reports and exports (integration tests)
// Each report has one data query; JSON, CSV and PDF must show the same approved data.
const { pool, resetTestDatabase, seedFixtures, insertEntry, seedTemplates } = require('../helpers/testDatabase')
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, login } = require('../helpers/httpClient')

let server, baseUrl, school, admin, master, chair11, teacherCruz, teacherSantos

before(async () => {
  await resetTestDatabase()
  school = await seedFixtures()
  await seedTemplates() // Grade 7 template; the SHS department has none
  ;({ server, baseUrl } = await startServer())
  admin = await login(baseUrl, 'admin')
  master = await login(baseUrl, 'master')
  chair11 = await login(baseUrl, 'chair11')
  teacherCruz = await login(baseUrl, 'cruz')
  teacherSantos = await login(baseUrl, 'santos')
  const base = { term_id: school.termId, section_id: school.sections.rizal, subject_id: school.subjects.math7, teacher_id: school.teachers.cruz, room_id: school.rooms.r101, start_min: 450, end_min: 495 }
  await insertEntry({ ...base, day_of_week: 'Monday', status: 'approved' })
  await insertEntry({ ...base, day_of_week: 'Tuesday', status: 'approved', subject_id: school.subjects.english7 })
  await insertEntry({ ...base, day_of_week: 'Wednesday', status: 'pending' })
  await insertEntry({ ...base, day_of_week: 'Thursday', status: 'draft' })
})

after(async () => {
  server.close()
  await pool.end()
})

describe('GET /api/reports/:type', () => {
  it('lists the available report types', async () => {
    const response = await admin.get('/api/reports')
    assert.deepEqual(response.body.map(item => item.type), ['section', 'teacher', 'room', 'teacher-load', 'room-utilization'])
  })

  it('section report: approved entries only', async () => {
    const response = await admin.get(`/api/reports/section?term_id=${school.termId}&section_id=${school.sections.rizal}`)
    assert.equal(response.status, 200)
    assert.equal(response.body.title, 'Class Program – Grade 7 - Rizal')
    assert.deepEqual(response.body.rows.map(row => [row.day, row.time, row.subject]), [['Monday', '07:30–08:15', 'Math 7'], ['Tuesday', '07:30–08:15', 'English 7']])
  })

  it('CSV and PDF are the same report in another format', async () => {
    const path = `/api/reports/section?term_id=${school.termId}&section_id=${school.sections.rizal}`
    const csv = await admin.get(`${path}&format=csv`)
    assert.equal(csv.status, 200)
    assert.deepEqual(String(csv.body).replace('﻿', '').trim().split('\r\n'), [
      'Day,Time,Subject / Activity,Teacher,Room',
      'Monday,07:30–08:15,Math 7,Ana Cruz,JHS Building · 101',
      'Tuesday,07:30–08:15,English 7,Ana Cruz,JHS Building · 101'
    ])
    const pdf = await fetch(`${baseUrl}${path}&format=pdf`, { headers: { Cookie: admin.cookie } })
    assert.equal(pdf.headers.get('content-type'), 'application/pdf')
    assert.match(pdf.headers.get('content-disposition'), /Class-Program-Grade-7-Rizal\.pdf/)
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-')
  })

  it('teacher-load and room-utilization summaries count approved minutes only', async () => {
    const load = await admin.get(`/api/reports/teacher-load?term_id=${school.termId}`)
    const cruz = load.body.rows.find(row => row.teacher === 'Ana Cruz')
    assert.deepEqual([cruz.subjects, cruz.classes, cruz.minutes, cruz.status], [2, 2, 90, 'OK'])
    const rooms = await admin.get(`/api/reports/room-utilization?term_id=${school.termId}`)
    const room101 = rooms.body.rows.find(row => row.room === 'JHS Building · 101')
    // Grade 7 template: Mon–Thu 555 class minutes × 4 + Friday 560 = 2780 minutes a week.
    assert.deepEqual([room101.classes, room101.minutes, room101.available, room101.usage], [2, 90, 2780, '3%'])
    const room201 = rooms.body.rows.find(row => row.room === 'SHS Building · 201')
    assert.deepEqual([room201.available, room201.usage], ['—', '—'], 'no time template in the SHS department')
  })

  it('keeps staff inside their department', async () => {
    assert.equal((await master.get(`/api/reports/section?term_id=${school.termId}&section_id=${school.sections.rizal}`)).status, 200)
    assert.equal((await chair11.get(`/api/reports/section?term_id=${school.termId}&section_id=${school.sections.rizal}`)).status, 403)
    const shsLoad = await chair11.get(`/api/reports/teacher-load?term_id=${school.termId}`)
    assert.deepEqual(shsLoad.body.rows.map(row => row.teacher), ['Carla Reyes'])
  })

  it('lets a teacher print only their own schedule', async () => {
    const own = await teacherCruz.get(`/api/reports/teacher?term_id=${school.termId}&teacher_id=${school.teachers.cruz}`)
    assert.equal(own.status, 200)
    assert.equal(own.body.rows.length, 2)
    assert.equal((await teacherSantos.get(`/api/reports/teacher?term_id=${school.termId}&teacher_id=${school.teachers.cruz}`)).status, 403)
    assert.equal((await teacherCruz.get(`/api/reports/teacher-load?term_id=${school.termId}`)).status, 403)
  })

  it('answers 400 for bad requests and 404 for unknown records', async () => {
    assert.equal((await admin.get('/api/reports/grades?term_id=1')).status, 400)
    assert.equal((await admin.get(`/api/reports/section?term_id=${school.termId}`)).status, 400)
    assert.equal((await admin.get(`/api/reports/room?term_id=${school.termId}&room_id=9999`)).status, 404)
  })
})
