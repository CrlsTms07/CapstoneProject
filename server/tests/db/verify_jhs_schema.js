// HIPO 3.2 – Schedule Plotter (database test)
// Verifies the schedule tables, triggers and exclusion constraints exist (old JHS tables and schedule_entries).
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
        (SELECT COUNT(*)::INT FROM pg_constraint WHERE conname IN ('jhs_program_teacher_no_overlap', 'jhs_program_room_no_overlap', 'jhs_program_section_no_overlap')) AS exclusion_constraints,
        to_regclass('public.schedule_entries') AS schedule_entries_table,
        to_regclass('public.approval_logs') AS approval_logs_table,
        to_regclass('public.terms') AS terms_table,
        (SELECT COUNT(*)::INT FROM pg_constraint WHERE conname IN ('schedule_entries_teacher_no_overlap', 'schedule_entries_room_no_overlap', 'schedule_entries_section_no_overlap')) AS schedule_entry_exclusion_constraints
    `)
    const row = result.rows[0]
    console.log(JSON.stringify(row))
    if (!row.schedule_entries_table || !row.approval_logs_table || !row.terms_table || row.schedule_entry_exclusion_constraints !== 3) {
      throw new Error('schedule_entries schema is incomplete – start the server once to run the migrations.')
    }
  } catch (error) {
    console.error('SCHEMA_VERIFICATION_FAILED', error.code || error.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

verify()