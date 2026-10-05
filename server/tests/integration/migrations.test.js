// HIPO 3.2 / 3.4 / 4.1 / 7.0 – startup migrations (integration tests, *_test database)
// timeTemplates, entryTeachers, classProgramFields and documentSettings: seeding, repeat runs, the
// triggers and constraints they add, and that existing rows survive.
const { pool, resetTestDatabase, seedFixtures, insertEntry } = require('../helpers/testDatabase')
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { runMigrations } = require('../../src/db/migrations')
const { GRADE_7_SLOTS, GRADE_12_SLOTS } = require('../../src/db/migrations/timeTemplates.migration')

let school

before(async () => {
  await resetTestDatabase()
  school = await seedFixtures()
})

after(async () => {
  await pool.end()
})

const rows = async (sql, params) => (await pool.query(sql, params)).rows
const value = async (sql, params) => Object.values((await pool.query(sql, params)).rows[0])[0]
const clearSchedules = () => pool.query('TRUNCATE approval_logs, schedule_entries, class_program_headers RESTART IDENTITY CASCADE')

// Runs fn in a transaction that is always rolled back, and returns the error it throws (or null).
const errorOf = async fn => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await fn(client)
    return null
  } catch (error) {
    return error
  } finally {
    await client.query('ROLLBACK')
    client.release()
  }
}

const entryValues = (overrides = {}) => ({
  term_id: school.termId, section_id: school.sections.rizal, subject_id: school.subjects.math7,
  teacher_id: school.teachers.cruz, room_id: school.rooms.r101, activity: null, delivery_mode: 'face_to_face',
  day_of_week: 'Monday', start_min: 390, end_min: 435, status: 'draft', ...overrides
})
const insertSql = `
  INSERT INTO schedule_entries (term_id, section_id, subject_id, teacher_id, room_id, activity, delivery_mode, day_of_week, start_min, end_min, status)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING entry_id
`
const insertWith = async (client, overrides) => {
  const e = entryValues(overrides)
  return (await client.query(insertSql, [e.term_id, e.section_id, e.subject_id, e.teacher_id, e.room_id, e.activity, e.delivery_mode, e.day_of_week, e.start_min, e.end_min, e.status])).rows[0].entry_id
}
const addTeacher = (client, entryId, teacherId) => client.query(
  "INSERT INTO entry_teachers (entry_id, teacher_id, term_id, day_of_week, start_min, end_min, status) VALUES ($1, $2, 0, '', 0, 0, '')", [entryId, teacherId])

describe('runMigrations', () => {
  it('can run again on an up-to-date database without errors or changes', async () => {
    const before = await rows("SELECT conname, conrelid::regclass::TEXT AS on_table, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname LIKE 'schedule_entries_%' ORDER BY conname")
    await runMigrations()
    await runMigrations()
    const after = await rows("SELECT conname, conrelid::regclass::TEXT AS on_table, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname LIKE 'schedule_entries_%' ORDER BY conname")
    assert.deepEqual(after, before)
  })

  it('keeps the teacher guard on entry_teachers and the new room guard (the old migration does not re-add them)', async () => {
    const guards = await rows(`
      SELECT conname, conrelid::regclass::TEXT AS on_table, pg_get_constraintdef(oid) AS def
      FROM pg_constraint WHERE conname IN ('schedule_entries_teacher_no_overlap', 'schedule_entries_room_no_overlap', 'schedule_entries_section_no_overlap')
      ORDER BY conname
    `)
    assert.deepEqual(guards.map(row => [row.conname, row.on_table]), [
      ['schedule_entries_room_no_overlap', 'schedule_entries'],
      ['schedule_entries_section_no_overlap', 'schedule_entries'],
      ['schedule_entries_teacher_no_overlap', 'entry_teachers']
    ])
    assert.match(guards[0].def, /delivery_mode\)::text = 'face_to_face'/)
  })
})

describe('timeTemplates.migration', () => {
  before(async () => {
    // The fixture has Grade 7 and Grade 11; add a Grade 12 and run the startup migrations again.
    await pool.query('INSERT INTO grade_levels (grade_level_name, department_id) VALUES ($1, $2)', ['Grade 12', school.departments.shs])
    await runMigrations()
  })

  const slotsOf = async gradeName => rows(`
    SELECT s.day_pattern, s.start_min, s.end_min, s.slot_type, s.label, s.default_delivery_mode
    FROM time_template_slots s
    JOIN time_templates tt ON tt.template_id = s.template_id
    JOIN grade_levels gl ON gl.grade_level_id = tt.grade_level_id
    WHERE gl.grade_level_name = $1
    ORDER BY CASE s.day_pattern WHEN 'MON_THU' THEN 0 WHEN 'MON' THEN 1 WHEN 'TUE' THEN 2 WHEN 'WED' THEN 3 WHEN 'THU' THEN 4 ELSE 5 END, s.start_min
  `, [gradeName])

  it('seeds the Grade 7 template exactly as in CLAUDE.md (MON_THU + FRI, BREAK, LUNCH, HGP)', async () => {
    const slots = await slotsOf('Grade 7')
    assert.deepEqual(slots, GRADE_7_SLOTS)
    assert.equal(slots.length, 25)
    assert.deepEqual(slots.filter(slot => slot.slot_type !== 'class').map(slot => [slot.day_pattern, slot.label, slot.end_min - slot.start_min]),
      [['MON_THU', 'BREAK', 20], ['MON_THU', 'LUNCH', 20], ['FRI', 'BREAK', 20], ['FRI', 'LUNCH', 20]])
    assert.deepEqual(slots.at(-1), { day_pattern: 'FRI', start_min: 950, end_min: 990, slot_type: 'class', label: 'HGP', default_delivery_mode: null })
  })

  it('seeds the Grade 12 template exactly as in CLAUDE.md (each weekday on its own)', async () => {
    const slots = await slotsOf('Grade 12')
    assert.deepEqual(slots, GRADE_12_SLOTS)
    const monday = slots.filter(slot => slot.day_pattern === 'MON').map(slot => [slot.start_min, slot.end_min, slot.slot_type, slot.default_delivery_mode])
    assert.deepEqual(monday, [[570, 690, 'class', 'asynchronous'], [690, 750, 'no_class', null], [750, 870, 'class', null], [870, 900, 'break', null], [900, 1020, 'class', null], [1020, 1140, 'class', null]])
  })

  it('links each template to its grade level and department, and seeds nothing for other grades', async () => {
    const templates = await rows('SELECT gl.grade_level_name, tt.department_id FROM time_templates tt JOIN grade_levels gl ON gl.grade_level_id = tt.grade_level_id ORDER BY gl.grade_level_name')
    assert.deepEqual(templates, [
      { grade_level_name: 'Grade 12', department_id: school.departments.shs },
      { grade_level_name: 'Grade 7', department_id: school.departments.jhs }
    ])
  })

  it('does not bring back a template the admin deleted', async () => {
    await pool.query("DELETE FROM time_templates WHERE grade_level_id = (SELECT grade_level_id FROM grade_levels WHERE grade_level_name = 'Grade 12')")
    await runMigrations()
    assert.equal(await value("SELECT COUNT(*)::INT FROM time_templates tt JOIN grade_levels gl ON gl.grade_level_id = tt.grade_level_id WHERE gl.grade_level_name = 'Grade 12'"), 0)
  })

  it('rejects overlapping slots, unknown patterns or types, and mixing MON_THU with MON', async () => {
    const templateId = await value(`SELECT template_id FROM time_templates WHERE grade_level_id = $1`, [school.gradeLevels.grade7])
    const slot = (client, pattern, start, end, type = 'class') => client.query(
      'INSERT INTO time_template_slots (template_id, day_pattern, start_min, end_min, slot_type) VALUES ($1, $2, $3, $4, $5)', [templateId, pattern, start, end, type])
    assert.equal((await errorOf(client => slot(client, 'MON_THU', 400, 420))).constraint, 'time_template_slots_no_overlap')
    assert.equal((await errorOf(client => slot(client, 'SAT', 400, 420))).code, '23514')
    assert.equal((await errorOf(client => slot(client, 'FRI', 1000, 1020, 'recess'))).code, '23514')
    assert.equal((await errorOf(client => slot(client, 'FRI', 1000, 990))).constraint, 'time_template_slots_time_order')
    assert.match((await errorOf(client => slot(client, 'MON', 1000, 1020))).message, /MON_THU or separate MON\/TUE\/WED\/THU patterns, not both/)
    assert.equal(await errorOf(client => slot(client, 'FRI', 1000, 1020)), null, 'a free Friday time is fine')
  })

  it('rejects a template whose grade level is in another department', async () => {
    const error = await errorOf(client => client.query('INSERT INTO time_templates (department_id, grade_level_id, template_name) VALUES ($1, $2, $3)',
      [school.departments.jhs, school.gradeLevels.grade11, 'Wrong department']))
    assert.equal(error.constraint, 'time_templates_grade_department_fk')
  })
})

describe('entryTeachers.migration', () => {
  before(clearSchedules)

  it('copies every existing teacher_id into entry_teachers and keeps every row', async () => {
    // A row written before the migration existed: insert it with the triggers switched off.
    await pool.query('SET session_replication_role = replica')
    try {
      await insertEntry(entryValues({ status: 'approved' }))
      await insertEntry(entryValues({ subject_id: null, teacher_id: null, room_id: null, activity: 'BREAK', day_of_week: 'Tuesday' }))
    } finally {
      await pool.query('SET session_replication_role = DEFAULT')
    }
    assert.equal(await value('SELECT COUNT(*)::INT FROM entry_teachers'), 0)
    const before = await rows('SELECT * FROM schedule_entries ORDER BY entry_id')

    await runMigrations()

    assert.deepEqual(await rows('SELECT * FROM schedule_entries ORDER BY entry_id'), before, 'no entry was changed or deleted')
    assert.deepEqual(await rows('SELECT entry_id, teacher_id, term_id, day_of_week, start_min, end_min, status FROM entry_teachers'), [{
      entry_id: before[0].entry_id, teacher_id: school.teachers.cruz, term_id: school.termId, day_of_week: 'Monday', start_min: 390, end_min: 435, status: 'approved'
    }])
  })

  it('defaults delivery_mode to face_to_face', async () => {
    assert.deepEqual(await rows('SELECT DISTINCT delivery_mode FROM schedule_entries'), [{ delivery_mode: 'face_to_face' }])
  })

  it('adds the primary teacher automatically and accepts one co-teacher, not a third', async () => {
    const error = await errorOf(async client => {
      const entryId = await insertWith(client, { day_of_week: 'Wednesday' })
      assert.deepEqual((await client.query('SELECT teacher_id FROM entry_teachers WHERE entry_id = $1', [entryId])).rows, [{ teacher_id: school.teachers.cruz }])
      await addTeacher(client, entryId, school.teachers.santos)
      await addTeacher(client, entryId, school.teachers.reyes)
    })
    assert.equal(error.code, '23514')
    assert.match(error.message, /at most two teachers/)
  })

  it('rejects an overlapping class of a co-teacher (exclusion constraint) but not a rejected one', async () => {
    const error = await errorOf(async client => {
      const entryId = await insertWith(client, { day_of_week: 'Thursday' })
      await addTeacher(client, entryId, school.teachers.santos)
      await insertWith(client, { section_id: school.sections.mabini, teacher_id: school.teachers.santos, subject_id: school.subjects.english7, room_id: school.rooms.r102, day_of_week: 'Thursday', start_min: 400, end_min: 445, status: 'rejected' })
      await insertWith(client, { section_id: school.sections.mabini, teacher_id: school.teachers.santos, subject_id: school.subjects.english7, room_id: school.rooms.r102, day_of_week: 'Thursday', start_min: 400, end_min: 445 })
    })
    assert.equal(error.code, '23P01')
    assert.equal(error.constraint, 'schedule_entries_teacher_no_overlap')
  })

  it('keeps the copied times and status in step with the entry', async () => {
    const error = await errorOf(async client => {
      const entryId = await insertWith(client, { day_of_week: 'Friday' })
      await addTeacher(client, entryId, school.teachers.santos)
      await client.query("UPDATE schedule_entries SET start_min = 600, end_min = 640, status = 'pending' WHERE entry_id = $1", [entryId])
      const copies = (await client.query('SELECT DISTINCT start_min, end_min, status FROM entry_teachers WHERE entry_id = $1', [entryId])).rows
      assert.deepEqual(copies, [{ start_min: 600, end_min: 640, status: 'pending' }])
      // A rejected entry no longer blocks its teachers.
      await client.query("UPDATE schedule_entries SET status = 'rejected' WHERE entry_id = $1", [entryId])
      await insertWith(client, { section_id: school.sections.mabini, teacher_id: school.teachers.santos, subject_id: school.subjects.english7, room_id: school.rooms.r102, day_of_week: 'Friday', start_min: 600, end_min: 640 })
    })
    assert.equal(error, null)
  })

  it('swaps the primary teacher when teacher_id changes and protects it from a direct delete', async () => {
    const error = await errorOf(async client => {
      const entryId = await insertWith(client, { day_of_week: 'Friday', start_min: 700, end_min: 740 })
      await client.query('UPDATE schedule_entries SET teacher_id = $1 WHERE entry_id = $2', [school.teachers.santos, entryId])
      const teachers = (await client.query('SELECT teacher_id FROM entry_teachers WHERE entry_id = $1', [entryId])).rows
      assert.deepEqual(teachers, [{ teacher_id: school.teachers.santos }])
      await client.query('DELETE FROM entry_teachers WHERE entry_id = $1', [entryId])
    })
    assert.match(error.message, /Change schedule_entries.teacher_id to replace the primary teacher/)
  })

  it('removes the teachers with their entry, and refuses teachers on an activity row', async () => {
    const deleteError = await errorOf(async client => {
      const entryId = await insertWith(client, { day_of_week: 'Friday', start_min: 800, end_min: 840 })
      await addTeacher(client, entryId, school.teachers.santos)
      await client.query('DELETE FROM schedule_entries WHERE entry_id = $1', [entryId])
      assert.equal((await client.query('SELECT COUNT(*)::INT AS n FROM entry_teachers WHERE entry_id = $1', [entryId])).rows[0].n, 0)
    })
    assert.equal(deleteError, null)
    const activityError = await errorOf(async client => {
      const entryId = await insertWith(client, { subject_id: null, teacher_id: null, room_id: null, activity: 'LUNCH', day_of_week: 'Friday', start_min: 900, end_min: 920 })
      await addTeacher(client, entryId, school.teachers.santos)
    })
    assert.match(activityError.message, /Only a class row can have teachers/)
  })

  it('requires a room only for face-to-face classes', async () => {
    assert.equal(await errorOf(client => insertWith(client, { room_id: null, delivery_mode: 'asynchronous', day_of_week: 'Friday', start_min: 1000, end_min: 1040 })), null)
    assert.equal((await errorOf(client => insertWith(client, { room_id: null, day_of_week: 'Friday', start_min: 1000, end_min: 1040 }))).constraint, 'schedule_entries_kind')
    assert.equal((await errorOf(client => insertWith(client, { subject_id: null, teacher_id: null, room_id: null, activity: 'BREAK', delivery_mode: 'asynchronous', day_of_week: 'Friday', start_min: 1000, end_min: 1040 }))).constraint, 'schedule_entries_kind')
    assert.equal((await errorOf(client => insertWith(client, { delivery_mode: 'online', day_of_week: 'Friday', start_min: 1000, end_min: 1040 }))).constraint, 'schedule_entries_delivery_mode_check')
  })

  it('ignores asynchronous entries in the room guard', async () => {
    const asyncFirst = await errorOf(async client => {
      await insertWith(client, { delivery_mode: 'asynchronous', day_of_week: 'Friday', start_min: 1000, end_min: 1040 })
      await insertWith(client, { section_id: school.sections.mabini, teacher_id: school.teachers.santos, subject_id: school.subjects.english7, day_of_week: 'Friday', start_min: 1000, end_min: 1040 })
    })
    assert.equal(asyncFirst, null, 'same room 101 at the same time, but the first class is asynchronous')
    const bothFaceToFace = await errorOf(async client => {
      await insertWith(client, { day_of_week: 'Friday', start_min: 1000, end_min: 1040 })
      await insertWith(client, { section_id: school.sections.mabini, teacher_id: school.teachers.santos, subject_id: school.subjects.english7, day_of_week: 'Friday', start_min: 1000, end_min: 1040 })
    })
    assert.equal(bothFaceToFace.constraint, 'schedule_entries_room_no_overlap')
  })
})

describe('classProgramFields.migration', () => {
  it('adds adviser, co-adviser and strand to sections, and color and weekly minutes to subjects', async () => {
    const columns = await rows(`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE (table_name = 'sections' AND column_name IN ('adviser_id', 'co_adviser_id', 'strand'))
         OR (table_name = 'subjects' AND column_name IN ('color', 'weekly_minutes', 'weekly_periods'))
      ORDER BY table_name, column_name
    `)
    assert.deepEqual(columns.map(row => `${row.table_name}.${row.column_name}`), [
      'sections.adviser_id', 'sections.co_adviser_id', 'sections.strand',
      'subjects.color', 'subjects.weekly_minutes', 'subjects.weekly_periods'
    ])
  })

  it('enforces the new rules in the database', async () => {
    const update = (sql, params) => errorOf(client => client.query(sql, params))
    assert.equal((await update('UPDATE sections SET adviser_id = $1, co_adviser_id = $1 WHERE section_id = $2', [school.teachers.cruz, school.sections.rizal])).constraint, 'sections_advisers_differ')
    assert.equal((await update("UPDATE sections SET strand = '  ' WHERE section_id = $1", [school.sections.stemA])).constraint, 'sections_strand_not_blank')
    assert.equal((await update('UPDATE sections SET adviser_id = 9999 WHERE section_id = $1', [school.sections.rizal])).code, '23503')
    assert.equal((await update("UPDATE subjects SET color = 'blue' WHERE subject_id = $1", [school.subjects.math7])).constraint, 'subjects_color_hex')
    assert.equal((await update('UPDATE subjects SET weekly_minutes = 0 WHERE subject_id = $1', [school.subjects.math7])).constraint, 'subjects_weekly_minutes_range')
    assert.equal(await update("UPDATE subjects SET color = '#3B82F6', weekly_minutes = 400 WHERE subject_id = $1", [school.subjects.math7]), null)
  })

  it('blocks deleting a teacher who is still a class adviser', async () => {
    const error = await errorOf(async client => {
      await client.query('UPDATE sections SET adviser_id = $1 WHERE section_id = $2', [school.teachers.reyes, school.sections.stemA])
      await client.query('DELETE FROM teachers WHERE teacher_id = $1', [school.teachers.reyes])
    })
    assert.equal(error.code, '23001')
  })
})

describe('documentSettings.migration', () => {
  it('creates one settings row per department with limits on the lists', async () => {
    const insert = (signatories, headerLines = []) => errorOf(client => client.query(
      'INSERT INTO document_settings (department_id, header_lines, signatories) VALUES ($1, $2, $3::JSONB)', [school.departments.jhs, headerLines, signatories]))
    assert.equal(await insert('[{"label": "Prepared by", "name": "", "position": ""}]'), null)
    assert.equal((await insert('{"label": "Prepared by"}')).constraint, 'document_settings_signatories_array')
    assert.equal((await insert(JSON.stringify(Array(9).fill({ label: 'x' })))).constraint, 'document_settings_signatory_limit')
    assert.equal((await insert('[]', Array(11).fill('line'))).constraint, 'document_settings_header_limit')
  })
})
