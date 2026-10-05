// HIPO 3.2 – Schedule Plotter (database test)
// Verifies the JHS class-program tables, triggers and exclusion constraints exist.
require('dotenv').config()
const pool = require('../../src/config/database')

const verify = async () => {
  try {
    const result = await pool.query(`
      SELECT
        to_regclass('public.jhs_class_programs') AS programs_table,
        to_regclass('public.jhs_class_program_entries') AS entries_table,
        to_regclass('public.jhs_class_program_approvals') AS approvals_table,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'teachers' AND column_name = 'ancillary_tasks'
        ) AS ancillary_tasks_column,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'assigned_grade_level_id'
        ) AS chair_grade_assignment_column,
        (SELECT COUNT(*)::INT FROM pg_trigger WHERE tgname IN ('jhs_program_entry_conflict_guard', 'legacy_schedule_conflict_guard')) AS conflict_triggers,
        (SELECT COUNT(*)::INT FROM pg_constraint WHERE conname IN ('jhs_program_teacher_no_overlap', 'jhs_program_room_no_overlap', 'jhs_program_section_no_overlap')) AS exclusion_constraints
    `)
    console.log(JSON.stringify(result.rows[0]))
  } catch (error) {
    console.error('SCHEMA_VERIFICATION_FAILED', error.code || error.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

verify()