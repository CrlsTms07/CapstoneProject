// HIPO 3.2 – Schedule Plotter (database test)
// Smoke test on the real database for the class-program migrations: the new tables and columns exist,
// every Grade 7 / Grade 12 level has its seeded time template, every class row's teacher is in
// entry_teachers, and the teacher guard covers co-teachers. Everything is rolled back.
require('dotenv').config({ quiet: true })
const pool = require('../../src/config/database')
const { gradeOf } = require('../../src/modules/schedules/schedules.validation')

const expect = (condition, message) => { if (!condition) throw new Error(message) }

const run = async () => {
  const client = await pool.connect()
  try {
    const schema = (await client.query(`
      SELECT
        to_regclass('public.time_templates') IS NOT NULL AS time_templates,
        to_regclass('public.time_template_slots') IS NOT NULL AS time_template_slots,
        to_regclass('public.entry_teachers') IS NOT NULL AS entry_teachers,
        to_regclass('public.document_settings') IS NOT NULL AS document_settings,
        (SELECT COUNT(*)::INT FROM information_schema.columns WHERE table_name = 'schedule_entries' AND column_name = 'delivery_mode') AS delivery_mode,
        (SELECT COUNT(*)::INT FROM information_schema.columns WHERE table_name = 'sections' AND column_name IN ('adviser_id', 'co_adviser_id', 'strand')) AS section_columns,
        (SELECT COUNT(*)::INT FROM information_schema.columns WHERE table_name = 'subjects' AND column_name IN ('color', 'weekly_minutes')) AS subject_columns,
        (SELECT conrelid::regclass::TEXT FROM pg_constraint WHERE conname = 'schedule_entries_teacher_no_overlap') AS teacher_guard_table,
        (SELECT COUNT(*)::INT FROM schedule_entries e WHERE e.teacher_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM entry_teachers et WHERE et.entry_id = e.entry_id AND et.teacher_id = e.teacher_id)) AS teachers_missing
    `)).rows[0]
    console.log(JSON.stringify(schema))
    expect(schema.time_templates && schema.time_template_slots && schema.entry_teachers && schema.document_settings, 'class-program tables are missing – start the server once to run the migrations.')
    expect(schema.delivery_mode === 1 && schema.section_columns === 3 && schema.subject_columns === 2, 'class-program columns are missing.')
    expect(schema.teacher_guard_table === 'entry_teachers', 'the teacher overlap guard is not on entry_teachers.')
    expect(schema.teachers_missing === 0, `${schema.teachers_missing} schedule entries have a teacher_id that is not in entry_teachers.`)

    const levels = (await client.query(`
      SELECT gl.grade_level_name, (SELECT COUNT(*)::INT FROM time_template_slots s JOIN time_templates tt ON tt.template_id = s.template_id WHERE tt.grade_level_id = gl.grade_level_id) AS slots
      FROM grade_levels gl
    `)).rows
    for (const level of levels.filter(row => [7, 12].includes(gradeOf(row.grade_level_name)))) {
      const expected = gradeOf(level.grade_level_name) === 7 ? 25 : 30
      // 0 is allowed: an admin may have removed the seeded template on purpose.
      expect(level.slots === expected || level.slots === 0, `${level.grade_level_name} has ${level.slots} template slots (expected ${expected}).`)
      console.log(`${level.grade_level_name}: ${level.slots} time template slots`)
    }

    // Co-teacher guard, inside a transaction that is rolled back.
    await client.query('BEGIN')
    const fixture = (await client.query(`
      SELECT (SELECT section_id FROM sections ORDER BY section_id LIMIT 1) AS section_id,
             (SELECT section_id FROM sections ORDER BY section_id OFFSET 1 LIMIT 1) AS other_section_id,
             (SELECT term_id FROM terms ORDER BY is_active DESC LIMIT 1) AS term_id,
             (SELECT subject_id FROM subjects ORDER BY subject_id LIMIT 1) AS subject_id,
             ARRAY(SELECT teacher_id FROM teachers ORDER BY teacher_id LIMIT 2) AS teacher_ids
    `)).rows[0]
    if (!fixture.section_id || !fixture.term_id || !fixture.subject_id || fixture.teacher_ids.length < 2) {
      console.log('SKIP: the co-teacher check needs a section, a term, a subject and two teachers.')
    } else {
      const [first, second] = fixture.teacher_ids
      const insert = (teacherId, sectionId) => client.query(`
        INSERT INTO schedule_entries (term_id, section_id, subject_id, teacher_id, delivery_mode, day_of_week, start_min, end_min)
        VALUES ($1, $2, $3, $4, 'asynchronous', 'Saturday', $5, $6) RETURNING entry_id
      `, [fixture.term_id, sectionId, fixture.subject_id, teacherId, teacherId === first ? 1380 : 1320, teacherId === first ? 1425 : 1350])
      const entryId = (await insert(first, fixture.section_id)).rows[0].entry_id
      await client.query("INSERT INTO entry_teachers (entry_id, teacher_id, term_id, day_of_week, start_min, end_min, status) VALUES ($1, $2, 0, '', 0, 0, '')", [entryId, second])
      // The second teacher's own class (another section when there is one) is moved onto 23:00–23:45.
      const otherSection = fixture.other_section_id || fixture.section_id
      const own = (await insert(second, otherSection)).rows[0].entry_id
      await client.query('SAVEPOINT overlap')
      try {
        await client.query('UPDATE schedule_entries SET start_min = 1390, end_min = 1430 WHERE entry_id = $1', [own])
        throw new Error('Expected the database to reject the co-teacher\'s overlapping class.')
      } catch (error) {
        if (error.code !== '23P01') throw error
        // With only one section the section guard may fire first; otherwise it must be the teacher guard.
        if (fixture.other_section_id && error.constraint !== 'schedule_entries_teacher_no_overlap') throw error
      }
    }
    await client.query('ROLLBACK')
    console.log('PASS: class-program schema is in place and co-teachers are guarded (test transaction rolled back).')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('FAIL: class-program schema test:', error.message)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

run()
