// HIPO 3.4 / 4.1 / 3.3 – Sections, Subjects, Teachers (database layer)
// Startup migration: the master-data fields the class programs need (CLAUDE.md "Scheduling Rules").
//   sections.adviser_id, co_adviser_id – class adviser and co-adviser (teachers); never the same teacher
//   sections.strand                    – Senior High strand, e.g. ABM
//   subjects.color                     – display color, "#RRGGBB"
//   subjects.weekly_minutes            – minutes a section needs per week (replaces weekly_periods for planning)
//   teacher_subjects                   – qualified teachers per subject (created earlier; ensured here)
//
// Additive only: new nullable columns, no row is changed. subjects.weekly_periods is kept.
const pool = require('../../config/database')

const CLASS_PROGRAM_FIELDS_SQL = `
    ALTER TABLE sections
      ADD COLUMN IF NOT EXISTS adviser_id INT REFERENCES teachers(teacher_id) ON UPDATE CASCADE ON DELETE RESTRICT,
      ADD COLUMN IF NOT EXISTS co_adviser_id INT REFERENCES teachers(teacher_id) ON UPDATE CASCADE ON DELETE RESTRICT,
      ADD COLUMN IF NOT EXISTS strand VARCHAR(30);

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sections_advisers_differ') THEN
        ALTER TABLE sections ADD CONSTRAINT sections_advisers_differ CHECK (adviser_id IS DISTINCT FROM co_adviser_id OR adviser_id IS NULL);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sections_strand_not_blank') THEN
        ALTER TABLE sections ADD CONSTRAINT sections_strand_not_blank CHECK (strand IS NULL OR BTRIM(strand) <> '');
      END IF;
    END $$;

    ALTER TABLE subjects
      ADD COLUMN IF NOT EXISTS color CHAR(7),
      ADD COLUMN IF NOT EXISTS weekly_minutes SMALLINT;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subjects_color_hex') THEN
        ALTER TABLE subjects ADD CONSTRAINT subjects_color_hex CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subjects_weekly_minutes_range') THEN
        ALTER TABLE subjects ADD CONSTRAINT subjects_weekly_minutes_range CHECK (weekly_minutes IS NULL OR weekly_minutes BETWEEN 1 AND 3000);
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS teacher_subjects (
        teacher_id INT NOT NULL REFERENCES teachers(teacher_id) ON UPDATE CASCADE ON DELETE CASCADE,
        subject_id INT NOT NULL REFERENCES subjects(subject_id) ON UPDATE CASCADE ON DELETE CASCADE,
        PRIMARY KEY (teacher_id, subject_id)
    );
    CREATE INDEX IF NOT EXISTS teacher_subjects_subject_idx ON teacher_subjects (subject_id);
`

const ensureClassProgramFields = async () => {
  await pool.query(CLASS_PROGRAM_FIELDS_SQL)
}

module.exports = { ensureClassProgramFields }
