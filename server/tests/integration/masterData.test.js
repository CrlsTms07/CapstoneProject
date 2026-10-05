// HIPO 3.3 / 3.4 / 4.1 / 7.0 – class-program master data (integration tests, *_test database)
// Subjects (color, weekly minutes), sections (adviser, co-adviser, strand), teachers' qualified
// subjects and the admin-only document settings, through the real API.
const { pool, resetTestDatabase, seedFixtures } = require('../helpers/testDatabase')
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, makeClient, login } = require('../helpers/httpClient')

let server, baseUrl, school, admin, chair7, master, teacherCruz

before(async () => {
  await resetTestDatabase()
  school = await seedFixtures()
  ;({ server, baseUrl } = await startServer())
  admin = await login(baseUrl, 'admin')
  chair7 = await login(baseUrl, 'chair7')
  master = await login(baseUrl, 'master')
  teacherCruz = await login(baseUrl, 'cruz')
})

after(async () => {
  server.close()
  await pool.end()
})

describe('subjects: color and weekly minutes', () => {
  let subjectId

  it('creates a subject with a color and weekly minutes', async () => {
    const response = await master.post('/api/subjects', { subject_name: 'Enhanced Mathematics', grade_level_id: school.gradeLevels.grade7, color: '#3b82f6', weekly_minutes: 400 })
    assert.equal(response.status, 201, JSON.stringify(response.body))
    assert.deepEqual([response.body.color, response.body.weekly_minutes], ['#3B82F6', 400])
    subjectId = response.body.subject_id
  })

  it('lists color and weekly minutes', async () => {
    const response = await teacherCruz.get('/api/subjects')
    assert.equal(response.status, 200)
    assert.deepEqual(Object.keys(response.body[0]).sort(), ['color', 'grade_level_id', 'subject_id', 'subject_name', 'weekly_minutes'])
  })

  it('keeps color and weekly minutes when an update leaves them out, and clears them when blank', async () => {
    const kept = await admin.put(`/api/subjects/${subjectId}`, { subject_name: 'Enhanced Math', grade_level_id: school.gradeLevels.grade7 })
    assert.deepEqual([kept.body.subject_name, kept.body.color, kept.body.weekly_minutes], ['Enhanced Math', '#3B82F6', 400])
    const cleared = await admin.put(`/api/subjects/${subjectId}`, { subject_name: 'Enhanced Math', grade_level_id: school.gradeLevels.grade7, color: '', weekly_minutes: null })
    assert.deepEqual([cleared.body.color, cleared.body.weekly_minutes], [null, null])
  })

  it('validates input with 400 and readable messages', async () => {
    const base = { subject_name: 'AP', grade_level_id: school.gradeLevels.grade7 }
    const cases = [
      [{ ...base, color: 'red' }, /hex color/],
      [{ ...base, weekly_minutes: -5 }, /1 to 3000/],
      [{ grade_level_id: school.gradeLevels.grade7 }, /subject_name is required/],
      [{ ...base, grade_level_id: 9999 }, /does not exist/]
    ]
    for (const [body, message] of cases) {
      const response = await admin.post('/api/subjects', body)
      assert.equal(response.status, 400, JSON.stringify(body))
      assert.match(response.body.error, message)
    }
    assert.equal((await admin.get('/api/subjects/abc')).status, 400)
    assert.equal((await admin.put('/api/subjects/9999', base)).status, 404)
  })

  it('lets only an admin or master teacher edit subjects', async () => {
    assert.equal((await chair7.post('/api/subjects', { subject_name: 'AP', grade_level_id: school.gradeLevels.grade7 })).status, 403)
    assert.equal((await makeClient(baseUrl).get('/api/subjects')).status, 401)
  })
})

describe('sections: adviser, co-adviser and strand', () => {
  it('sets an adviser and co-adviser and returns their names', async () => {
    const response = await chair7.put(`/api/sections/${school.sections.rizal}`, {
      section_name: 'Rizal', grade_level_id: school.gradeLevels.grade7, adviser_id: school.teachers.cruz, co_adviser_id: school.teachers.santos
    })
    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.deepEqual([response.body.adviser_name, response.body.co_adviser_name, response.body.strand], ['Ana Cruz', 'Ben Santos', null])
  })

  it('keeps the advisers when an update leaves them out', async () => {
    const response = await chair7.put(`/api/sections/${school.sections.rizal}`, { section_name: 'Rizal (renamed)', grade_level_id: school.gradeLevels.grade7 })
    assert.deepEqual([response.body.section_name, response.body.adviser_id, response.body.co_adviser_id], ['Rizal (renamed)', school.teachers.cruz, school.teachers.santos])
  })

  it('creates a Senior High section with a strand', async () => {
    const response = await admin.post('/api/sections', { section_name: 'ABM 11-1', grade_level_id: school.gradeLevels.grade11, adviser_id: school.teachers.reyes, strand: 'abm' })
    assert.equal(response.status, 201, JSON.stringify(response.body))
    assert.deepEqual([response.body.strand, response.body.adviser_name], ['ABM', 'Carla Reyes'])
    const listed = (await teacherCruz.get('/api/sections')).body.find(section => section.section_id === response.body.section_id)
    assert.equal(listed.strand, 'ABM')
  })

  it('validates input with 400 and readable messages', async () => {
    const base = { section_name: 'Mabini', grade_level_id: school.gradeLevels.grade7 }
    const cases = [
      [{ ...base, strand: 'STEM' }, /only set for Senior High School sections/],
      [{ ...base, adviser_id: school.teachers.cruz, co_adviser_id: school.teachers.cruz }, /must be different teachers/],
      [{ ...base, adviser_id: 9999 }, /not a registered teacher/],
      [{ ...base, grade_level_id: 9999 }, /grade level does not exist/],
      [{ ...base, co_adviser_id: 'x' }, /co_adviser_id must be a teacher id/]
    ]
    for (const [body, message] of cases) {
      const response = await admin.put(`/api/sections/${school.sections.mabini}`, body)
      assert.equal(response.status, 400, JSON.stringify(body))
      assert.match(response.body.error, message)
    }
  })

  it('compares the new co-adviser with the saved adviser', async () => {
    const response = await chair7.put(`/api/sections/${school.sections.rizal}`, { section_name: 'Rizal', grade_level_id: school.gradeLevels.grade7, co_adviser_id: school.teachers.cruz })
    assert.equal(response.status, 400)
    assert.match(response.body.error, /must be different teachers/)
  })

  it('blocks deleting a teacher who is still a class adviser (409)', async () => {
    const response = await admin.delete(`/api/teachers/${school.teachers.reyes}`)
    assert.equal(response.status, 409)
    assert.match(response.body.error, /still used by sections/)
  })

  it('lets only an admin or chairperson edit sections', async () => {
    assert.equal((await master.put(`/api/sections/${school.sections.rizal}`, { section_name: 'Rizal', grade_level_id: school.gradeLevels.grade7 })).status, 403)
  })
})

describe('teachers: qualified subjects', () => {
  it('replaces and lists a teacher\'s qualified subjects', async () => {
    const response = await master.put(`/api/teachers/${school.teachers.santos}/subjects`, { subject_ids: [school.subjects.math7, school.subjects.english7] })
    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.deepEqual(response.body.map(subject => subject.subject_name), ['English 7', 'Math 7'])
    const listed = await teacherCruz.get(`/api/teachers/${school.teachers.santos}/subjects`)
    assert.deepEqual(listed.body.map(subject => subject.subject_id).sort(), [school.subjects.math7, school.subjects.english7].sort())
  })

  it('shows subject_ids on the teacher list (Science 7 was removed)', async () => {
    const santos = (await admin.get('/api/teachers')).body.find(teacher => teacher.teacher_id === school.teachers.santos)
    assert.deepEqual(santos.subject_ids, [school.subjects.math7, school.subjects.english7].sort((a, b) => a - b))
  })

  it('clears the list with an empty array', async () => {
    const response = await admin.put(`/api/teachers/${school.teachers.santos}/subjects`, { subject_ids: [] })
    assert.deepEqual(response.body, [])
  })

  it('validates input and checks that the teacher and subjects exist', async () => {
    const cases = [
      [`/api/teachers/${school.teachers.cruz}/subjects`, { subject_ids: 'all' }, 400, /must be a list/],
      [`/api/teachers/${school.teachers.cruz}/subjects`, { subject_ids: [school.subjects.math7, school.subjects.math7] }, 400, /listed twice/],
      [`/api/teachers/${school.teachers.cruz}/subjects`, { subject_ids: [9999] }, 400, /do not exist/],
      ['/api/teachers/9999/subjects', { subject_ids: [] }, 404, /Teacher not found/],
      ['/api/teachers/abc/subjects', { subject_ids: [] }, 400, /positive whole number/]
    ]
    for (const [path, body, status, message] of cases) {
      const response = await admin.put(path, body)
      assert.equal(response.status, status, path)
      assert.match(response.body.error, message)
    }
    assert.deepEqual((await admin.get(`/api/teachers/${school.teachers.cruz}/subjects`)).body.map(subject => subject.subject_id), [school.subjects.math7], 'a refused save changes nothing')
  })

  it('does not let a teacher change qualifications', async () => {
    assert.equal((await teacherCruz.put(`/api/teachers/${school.teachers.cruz}/subjects`, { subject_ids: [] })).status, 403)
  })
})

describe('document settings (admin only)', () => {
  const settings = {
    header_lines: ['Republic of the Philippines', 'Department of Education', 'Region IV-A CALABARZON'],
    signatories: [
      { label: 'Prepared by', name: 'PAULINA C. CAS', position: 'Head Teacher III' },
      { label: 'Recommending Approval', name: 'IVY JOY D. PELAYO', position: 'School Principal II' },
      { label: 'Conforme', name: '', position: 'Class Adviser' },
      { label: 'Approved by', name: 'MARK JAYSON G. ESPINOSA', position: 'PSDS Cluster IV' }
    ],
    deped_orders: ['DO 10, s. 2024', 'DO 09, s. 2026', 'DO 12, s. 2024'],
    doc_ref_code: 'SCH-OSH-F002',
    revision: '00'
  }

  it('returns empty settings for a department nobody has set up', async () => {
    const response = await chair7.get(`/api/document-settings/${school.departments.jhs}`)
    assert.equal(response.status, 200)
    assert.deepEqual([response.body.header_lines, response.body.signatories, response.body.deped_orders, response.body.doc_ref_code], [[], [], [], null])
  })

  it('lets the admin save them, and everyone signed in read them', async () => {
    const saved = await admin.put(`/api/document-settings/${school.departments.jhs}`, settings)
    assert.equal(saved.status, 200, JSON.stringify(saved.body))
    assert.deepEqual(saved.body.signatories, settings.signatories)
    assert.equal(saved.body.updated_by_name, 'admin')
    const read = await teacherCruz.get(`/api/document-settings/${school.departments.jhs}`)
    assert.deepEqual([read.body.header_lines, read.body.deped_orders, read.body.doc_ref_code, read.body.revision], [settings.header_lines, settings.deped_orders, 'SCH-OSH-F002', '00'])
    const all = await master.get('/api/document-settings')
    assert.deepEqual(all.body.map(row => row.department_name), ['Junior High School', 'Senior High School'])
  })

  it('saves again over the previous settings', async () => {
    const response = await admin.put(`/api/document-settings/${school.departments.jhs}`, { ...settings, revision: '01', deped_orders: [] })
    assert.deepEqual([response.body.revision, response.body.deped_orders], ['01', []])
    assert.equal((await pool.query('SELECT COUNT(*)::INT AS n FROM document_settings')).rows[0].n, 1)
  })

  it('refuses everyone but the admin', async () => {
    for (const client of [chair7, master, teacherCruz]) {
      assert.equal((await client.put(`/api/document-settings/${school.departments.jhs}`, settings)).status, 403)
    }
    assert.equal((await makeClient(baseUrl).get(`/api/document-settings/${school.departments.jhs}`)).status, 401)
  })

  it('validates input with 400 and answers 404 for an unknown department', async () => {
    const cases = [
      [{ ...settings, signatories: [{ name: 'No label' }] }, /needs a label/],
      [{ ...settings, header_lines: 'one line' }, /must be a list/],
      [{ ...settings, doc_ref_code: 'x'.repeat(41) }, /at most 40/],
      [[], /must be an object/]
    ]
    for (const [body, message] of cases) {
      const response = await admin.put(`/api/document-settings/${school.departments.jhs}`, body)
      assert.equal(response.status, 400)
      assert.match(response.body.error, message)
    }
    assert.equal((await admin.put('/api/document-settings/9999', settings)).status, 404)
    assert.equal((await admin.get('/api/document-settings/abc')).status, 400)
  })
})
