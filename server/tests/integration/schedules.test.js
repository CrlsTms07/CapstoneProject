// HIPO 3.2 – Schedule Plotter (integration tests)
// The real API + PostgreSQL (a separate *_test database): conflict checks, saving a section's week,
// single-entry CRUD, delete restrictions, the database safety net and Auto-Generate.
const { pool, resetTestDatabase, seedFixtures, insertEntry } = require('../helpers/testDatabase')
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, makeClient, login } = require('../helpers/httpClient')

let server, baseUrl, school, admin, chair7, chair11, master, teacherCruz

// A Monday 07:30–08:15 Math 7 class for Rizal, taught by Cruz in room 101 (override any field).
const mathRow = (overrides = {}) => ({
  day_of_week: 'Monday', start_time: '07:30', duration_minutes: 45,
  subject_id: school.subjects.math7, teacher_id: school.teachers.cruz, room_id: school.rooms.r101,
  ...overrides
})

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

// Each test group starts from an empty timetable.
const clearSchedules = () => pool.query('TRUNCATE approval_logs, schedule_entries, class_program_headers RESTART IDENTITY CASCADE')

describe('access control', () => {
  it('requires a login', async () => {
    const response = await makeClient(baseUrl).get('/api/schedules')
    assert.equal(response.status, 401)
  })

  it('does not let a teacher plot schedules', async () => {
    const response = await teacherCruz.post('/api/schedules/check-conflicts', { term_id: school.termId, section_id: school.sections.rizal, entries: [] })
    assert.equal(response.status, 403)
  })

  it('keeps a grade level chairperson inside the assigned grade', async () => {
    const response = await chair11.get(`/api/schedules/section/${school.sections.rizal}?term_id=${school.termId}`)
    assert.equal(response.status, 403)
    assert.match(response.body.error, /outside the grade level assigned/)
  })

  it('lets a master teacher plot sections of the same department', async () => {
    const response = await master.get(`/api/schedules/section/${school.sections.rizal}?term_id=${school.termId}`)
    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'empty')
  })
})

describe('POST /api/schedules/check-conflicts (live plotter check)', () => {
  before(clearSchedules)

  it('returns every conflict at once with readable messages', async () => {
    await insertEntry({ term_id: school.termId, section_id: school.sections.mabini, subject_id: school.subjects.math7, teacher_id: school.teachers.cruz, room_id: school.rooms.r101, day_of_week: 'Monday', start_min: 450, end_min: 495, status: 'approved' })
    const response = await chair7.post('/api/schedules/check-conflicts', {
      term_id: school.termId,
      section_id: school.sections.rizal,
      entries: [mathRow(), mathRow({ start_time: '07:00', subject_id: school.subjects.english7, teacher_id: school.teachers.santos, room_id: school.rooms.r102 })]
    })
    assert.equal(response.status, 200)
    const types = response.body.conflicts.map(conflict => conflict.type).sort()
    assert.deepEqual(types, ['room', 'section', 'teacher'])
    assert.ok(response.body.conflicts.every(conflict => conflict.message && conflict.day_of_week === 'Monday'))
    assert.ok(response.body.teacher_loads.some(load => load.teacher_name === 'Ana Cruz'))
  })

  it('offers alternative rooms for a Senior High room conflict', async () => {
    await insertEntry({ term_id: school.termId, section_id: school.sections.mabini, subject_id: school.subjects.english7, teacher_id: school.teachers.santos, room_id: school.rooms.r201, day_of_week: 'Tuesday', start_min: 480, end_min: 525, status: 'approved' })
    const response = await chair11.post('/api/schedules/check-conflicts', {
      term_id: school.termId,
      section_id: school.sections.stemA,
      entries: [{ day_of_week: 'Tuesday', start_time: '08:00', duration_minutes: 60, subject_id: school.subjects.genMath, teacher_id: school.teachers.reyes, room_id: school.rooms.r201 }]
    })
    const roomConflict = response.body.conflicts.find(conflict => conflict.type === 'room')
    assert.ok(roomConflict, 'room conflict expected')
    assert.deepEqual(roomConflict.alternative_rooms.slice(0, 2).map(room => room.room_number), ['202', '203'])
  })
})

describe('PUT /api/schedules/section/:id (save the week as drafts)', () => {
  before(clearSchedules)

  it('saves a conflict-free week as drafts with the class-program header', async () => {
    const response = await chair7.put(`/api/schedules/section/${school.sections.rizal}`, {
      term_id: school.termId,
      header: { adviser: 'Ms. Dela Cruz' },
      entries: [mathRow(), mathRow({ day_of_week: 'Tuesday' }), { day_of_week: 'Monday', start_time: '08:15', duration_minutes: 45, activity: 'BREAK' }]
    })
    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.equal(response.body.status, 'draft')
    assert.equal(response.body.entries.length, 3)
    assert.equal(response.body.header.adviser, 'Ms. Dela Cruz')
    assert.equal(response.body.entries[0].start_time, '07:30')
  })

  it('replaces the previous drafts when saved again (no conflict with itself)', async () => {
    const response = await chair7.put(`/api/schedules/section/${school.sections.rizal}`, { term_id: school.termId, entries: [mathRow()] })
    assert.equal(response.status, 200)
    const count = await pool.query('SELECT COUNT(*)::INT AS n FROM schedule_entries WHERE section_id = $1', [school.sections.rizal])
    assert.equal(count.rows[0].n, 1)
  })

  it('refuses a week with conflicts (409 + full list) and saves nothing', async () => {
    const response = await chair7.put(`/api/schedules/section/${school.sections.mabini}`, {
      term_id: school.termId,
      entries: [mathRow({ room_id: school.rooms.r102 }), mathRow({ start_time: '13:00', subject_id: school.subjects.english7, teacher_id: school.teachers.santos, room_id: school.rooms.r102, duration_minutes: 50 })]
    })
    assert.equal(response.status, 409)
    assert.deepEqual(response.body.conflicts.map(conflict => conflict.type).sort(), ['teacher', 'time_rule'])
    const count = await pool.query('SELECT COUNT(*)::INT AS n FROM schedule_entries WHERE section_id = $1', [school.sections.mabini])
    assert.equal(count.rows[0].n, 0)
  })

  it('refuses to overwrite a week that is pending approval', async () => {
    await pool.query(`UPDATE schedule_entries SET status = 'pending' WHERE section_id = $1`, [school.sections.rizal])
    const response = await chair7.put(`/api/schedules/section/${school.sections.rizal}`, { term_id: school.termId, entries: [] })
    assert.equal(response.status, 409)
    assert.match(response.body.error, /waiting for admin approval/)
  })
})

describe('single-entry CRUD', () => {
  before(clearSchedules)
  let entryId

  it('creates a draft entry (201)', async () => {
    const response = await master.post('/api/schedules', { term_id: school.termId, section_id: school.sections.rizal, ...mathRow() })
    assert.equal(response.status, 201, JSON.stringify(response.body))
    assert.equal(response.body.status, 'draft')
    assert.equal(response.body.teacher_name, 'Ana Cruz')
    entryId = response.body.entry_id
  })

  it('refuses a conflicting entry with 409 and the conflict list', async () => {
    const response = await master.post('/api/schedules', { term_id: school.termId, section_id: school.sections.mabini, ...mathRow() })
    assert.equal(response.status, 409)
    assert.deepEqual(response.body.conflicts.map(conflict => conflict.type).sort(), ['room', 'teacher'])
  })

  it('updates a draft without conflicting with itself', async () => {
    const response = await master.put(`/api/schedules/${entryId}`, { term_id: school.termId, section_id: school.sections.rizal, ...mathRow({ start_time: '08:15' }) })
    assert.equal(response.status, 200)
    assert.equal(response.body.start_time, '08:15')
  })

  it('does not edit or delete approved entries', async () => {
    await pool.query(`UPDATE schedule_entries SET status = 'approved' WHERE entry_id = $1`, [entryId])
    const update = await master.put(`/api/schedules/${entryId}`, { term_id: school.termId, section_id: school.sections.rizal, ...mathRow() })
    const remove = await admin.delete(`/api/schedules/${entryId}`)
    assert.equal(update.status, 409)
    assert.equal(remove.status, 409)
    assert.match(remove.body.error, /approved and cannot be deleted/)
  })

  it('blocks deleting a rejected entry that has approval history (ON DELETE RESTRICT -> 409)', async () => {
    await pool.query(`UPDATE schedule_entries SET status = 'rejected' WHERE entry_id = $1`, [entryId])
    await pool.query(`INSERT INTO approval_logs (entry_id, action, from_status, to_status, performed_by) VALUES ($1, 'rejected', 'pending', 'rejected', $2)`, [entryId, school.users.admin])
    const response = await admin.delete(`/api/schedules/${entryId}`)
    assert.equal(response.status, 409)
    assert.equal(response.body.code, 'DELETE_RESTRICTED')
    assert.match(response.body.error, /still used by approval history/)
  })

  it('shows the latest rejected rows (with the admin notes) when a section has nothing else', async () => {
    await pool.query('UPDATE approval_logs SET notes = $1', ['Move Math to the afternoon.'])
    const response = await master.get(`/api/schedules/section/${school.sections.rizal}?term_id=${school.termId}`)
    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'rejected')
    assert.equal(response.body.rejection_notes, 'Move Math to the afternoon.')
    assert.deepEqual(response.body.entries.map(entry => entry.entry_id), [entryId])
  })

  it('deletes a draft entry', async () => {
    const created = await master.post('/api/schedules', { term_id: school.termId, section_id: school.sections.rizal, ...mathRow({ day_of_week: 'Friday' }) })
    const response = await master.delete(`/api/schedules/${created.body.entry_id}`)
    assert.equal(response.status, 200)
    assert.equal((await admin.get(`/api/schedules/${created.body.entry_id}`)).status, 404)
  })
})

describe('teacher view (HIPO 8.0)', () => {
  before(clearSchedules)

  it('shows a teacher only their own approved classes', async () => {
    const base = { term_id: school.termId, section_id: school.sections.rizal, subject_id: school.subjects.math7, teacher_id: school.teachers.cruz, room_id: school.rooms.r101 }
    await insertEntry({ ...base, day_of_week: 'Monday', start_min: 450, end_min: 495, status: 'approved' })
    await insertEntry({ ...base, day_of_week: 'Tuesday', start_min: 450, end_min: 495, status: 'draft' })
    await insertEntry({ ...base, teacher_id: school.teachers.santos, subject_id: school.subjects.english7, day_of_week: 'Wednesday', start_min: 450, end_min: 495, status: 'approved' })
    const response = await teacherCruz.get('/api/schedules')
    assert.equal(response.status, 200)
    assert.deepEqual(response.body.map(entry => [entry.day_of_week, entry.status, entry.teacher_name]), [['Monday', 'approved', 'Ana Cruz']])
  })
})

describe('database safety net (exclusion constraints)', () => {
  before(clearSchedules)
  const row = overrides => ({ term_id: school.termId, section_id: school.sections.rizal, subject_id: school.subjects.math7, teacher_id: school.teachers.cruz, room_id: school.rooms.r101, day_of_week: 'Monday', start_min: 450, end_min: 495, ...overrides })

  it('rejects an overlapping row even when the API is bypassed', async () => {
    await insertEntry(row())
    await assert.rejects(insertEntry(row({ section_id: school.sections.mabini, room_id: school.rooms.r102, start_min: 480, end_min: 525 })),
      error => error.code === '23P01' && error.constraint === 'schedule_entries_teacher_no_overlap')
  })

  it('ignores rejected rows', async () => {
    await insertEntry(row({ section_id: school.sections.mabini, room_id: school.rooms.r102, status: 'rejected' }))
  })

  it('lets back-to-back periods share a teacher', async () => {
    await insertEntry(row({ start_min: 495, end_min: 540 }))
  })

  it('lets only one of two simultaneous saves win', async () => {
    const save = (client, sectionId, roomId) => client.put(`/api/schedules/section/${sectionId}`, {
      term_id: school.termId,
      entries: [{ day_of_week: 'Thursday', start_time: '10:00', duration_minutes: 45, subject_id: school.subjects.science7, teacher_id: school.teachers.santos, room_id: roomId }]
    })
    await pool.query('DELETE FROM schedule_entries WHERE section_id = $1', [school.sections.mabini])
    const results = await Promise.all([save(chair7, school.sections.rizal, school.rooms.r101), save(master, school.sections.mabini, school.rooms.r102)])
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409])
  })
})

describe('deletion restrictions (ON DELETE RESTRICT)', () => {
  before(clearSchedules)

  it('blocks deleting a teacher, room, section, subject or term that schedule entries still use', async () => {
    await insertEntry({ term_id: school.termId, section_id: school.sections.rizal, subject_id: school.subjects.math7, teacher_id: school.teachers.cruz, room_id: school.rooms.r101, day_of_week: 'Monday', start_min: 450, end_min: 495 })
    const attempts = [
      ['teachers', 'teacher_id', school.teachers.cruz],
      ['rooms', 'room_id', school.rooms.r101],
      ['sections', 'section_id', school.sections.rizal],
      ['subjects', 'subject_id', school.subjects.math7]
    ]
    for (const [table, column, id] of attempts) {
      await assert.rejects(pool.query(`DELETE FROM ${table} WHERE ${column} = $1`, [id]), error => error.code === '23001', table)
    }
    const response = await admin.delete(`/api/terms/${school.termId}`)
    assert.equal(response.status, 409)
    assert.match(response.body.error, /still used by schedule entries/)
  })
})

describe('POST /api/schedules/auto-generate', () => {
  before(clearSchedules)

  it('proposes a conflict-free week that can be saved as it is', async () => {
    // Santos already teaches Mabini on Monday morning; the generator must work around it.
    await insertEntry({ term_id: school.termId, section_id: school.sections.mabini, subject_id: school.subjects.english7, teacher_id: school.teachers.santos, room_id: school.rooms.r102, day_of_week: 'Monday', start_min: 420, end_min: 465, status: 'approved' })
    const breakRow = { day_of_week: 'Monday', start_time: '09:15', duration_minutes: 45, activity: 'BREAK' }
    const proposal = await chair7.post('/api/schedules/auto-generate', { term_id: school.termId, section_id: school.sections.rizal, entries: [breakRow] })
    assert.equal(proposal.status, 200, JSON.stringify(proposal.body))
    assert.deepEqual(proposal.body.unfilled, [])
    assert.equal(proposal.body.generated.length, 12) // Math, English, Science × 4 periods
    assert.ok(!proposal.body.generated.some(entry => entry.day_of_week === 'Monday' && entry.start_min === 555), 'the BREAK period stays free')

    const saved = await chair7.put(`/api/schedules/section/${school.sections.rizal}`, { term_id: school.termId, entries: [breakRow, ...proposal.body.generated] })
    assert.equal(saved.status, 200, JSON.stringify(saved.body))
    assert.equal(saved.body.entries.length, 13)
  })
})
