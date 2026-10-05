const pool = require('../config/database')

const ensureClassProgramSchema = async () => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('CREATE EXTENSION IF NOT EXISTS btree_gist')
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS assigned_grade_level_id INT REFERENCES grade_levels(grade_level_id) ON UPDATE CASCADE ON DELETE RESTRICT;

      ALTER TABLE teachers
        ADD COLUMN IF NOT EXISTS ancillary_tasks TEXT[] NOT NULL DEFAULT '{}';

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teachers_ancillary_tasks_allowed') THEN
          ALTER TABLE teachers ADD CONSTRAINT teachers_ancillary_tasks_allowed
            CHECK (ancillary_tasks <@ ARRAY['ICT Coordinator', 'SSG Coordinator', 'Lab Manager']::TEXT[]);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS jhs_class_programs (
        program_id SERIAL PRIMARY KEY,
        section_id INT NOT NULL REFERENCES sections(section_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        school_year VARCHAR(20) NOT NULL,
        header JSONB NOT NULL DEFAULT '{}'::JSONB,
        status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
        created_by INT NOT NULL REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        reviewed_by INT REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_at TIMESTAMPTZ,
        CONSTRAINT jhs_class_program_section_year_unique UNIQUE (section_id, school_year)
      );

      CREATE INDEX IF NOT EXISTS jhs_class_programs_status_idx
        ON jhs_class_programs(status, updated_at DESC);

      CREATE TABLE IF NOT EXISTS jhs_class_program_entries (
        entry_id SERIAL PRIMARY KEY,
        program_id INT NOT NULL REFERENCES jhs_class_programs(program_id) ON UPDATE CASCADE ON DELETE CASCADE,
        section_id INT NOT NULL REFERENCES sections(section_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        day_of_week VARCHAR(10) NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
        start_time TIME NOT NULL,
        duration_minutes SMALLINT NOT NULL DEFAULT 45 CHECK (duration_minutes = 45),
        period_range INT4RANGE GENERATED ALWAYS AS (
          int4range(
            EXTRACT(HOUR FROM start_time)::INT * 60 + EXTRACT(MINUTE FROM start_time)::INT,
            EXTRACT(HOUR FROM start_time)::INT * 60 + EXTRACT(MINUTE FROM start_time)::INT + duration_minutes,
            '[)'
          )
        ) STORED,
        subject_id INT REFERENCES subjects(subject_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        activity VARCHAR(100),
        teacher_id INT REFERENCES teachers(teacher_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        room_id INT REFERENCES rooms(room_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
        CONSTRAINT jhs_class_program_entry_kind_check CHECK (
          (subject_id IS NOT NULL AND teacher_id IS NOT NULL AND room_id IS NOT NULL AND activity IS NULL)
          OR (subject_id IS NULL AND teacher_id IS NULL AND room_id IS NULL AND NULLIF(BTRIM(activity), '') IS NOT NULL)
        ),
        CONSTRAINT jhs_class_program_period_within_day CHECK (
          EXTRACT(HOUR FROM start_time)::INT * 60 + EXTRACT(MINUTE FROM start_time)::INT + duration_minutes <= 1440
        )
      );

      CREATE INDEX IF NOT EXISTS jhs_class_program_entries_program_idx
        ON jhs_class_program_entries(program_id, day_of_week, start_time);

      CREATE TABLE IF NOT EXISTS jhs_class_program_approvals (
        approval_id SERIAL PRIMARY KEY,
        program_id INT NOT NULL REFERENCES jhs_class_programs(program_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        action VARCHAR(20) NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected')),
        performed_by INT NOT NULL REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jhs_program_teacher_no_overlap') THEN
          ALTER TABLE jhs_class_program_entries ADD CONSTRAINT jhs_program_teacher_no_overlap
            EXCLUDE USING GIST (day_of_week WITH =, teacher_id WITH =, period_range WITH &&)
            WHERE (teacher_id IS NOT NULL AND status <> 'rejected');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jhs_program_room_no_overlap') THEN
          ALTER TABLE jhs_class_program_entries ADD CONSTRAINT jhs_program_room_no_overlap
            EXCLUDE USING GIST (day_of_week WITH =, room_id WITH =, period_range WITH &&)
            WHERE (room_id IS NOT NULL AND status <> 'rejected');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jhs_program_section_no_overlap') THEN
          ALTER TABLE jhs_class_program_entries ADD CONSTRAINT jhs_program_section_no_overlap
            EXCLUDE USING GIST (day_of_week WITH =, section_id WITH =, period_range WITH &&)
            WHERE (status <> 'rejected');
        END IF;
      END $$;

      CREATE OR REPLACE FUNCTION guard_jhs_program_entry_conflicts() RETURNS TRIGGER AS $$
      DECLARE
        entry_start INT;
      BEGIN
        IF NEW.status = 'rejected' THEN RETURN NEW; END IF;
        PERFORM pg_advisory_xact_lock(914207, 1);
        entry_start := EXTRACT(HOUR FROM NEW.start_time)::INT * 60 + EXTRACT(MINUTE FROM NEW.start_time)::INT;
        IF EXISTS (
          SELECT 1
          FROM schedules s
          JOIN time_slots ts ON ts.time_slot_id = s.time_slot_id
          WHERE s.day_of_week = NEW.day_of_week
            AND s.status <> 'rejected'
            AND (s.teacher_id = NEW.teacher_id OR s.room_id = NEW.room_id OR s.section_id = NEW.section_id)
            AND int4range(
              EXTRACT(HOUR FROM ts.start_time)::INT * 60 + EXTRACT(MINUTE FROM ts.start_time)::INT,
              EXTRACT(HOUR FROM ts.start_time)::INT * 60 + EXTRACT(MINUTE FROM ts.start_time)::INT + 45,
              '[)'
            ) && NEW.period_range
        ) THEN
          RAISE EXCEPTION 'JHS program conflicts with an existing schedule.' USING ERRCODE = '23P01';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION guard_legacy_schedule_conflicts() RETURNS TRIGGER AS $$
      DECLARE
        schedule_start INT;
      BEGIN
        IF NEW.status = 'rejected' THEN RETURN NEW; END IF;
        PERFORM pg_advisory_xact_lock(914207, 1);
        SELECT EXTRACT(HOUR FROM start_time)::INT * 60 + EXTRACT(MINUTE FROM start_time)::INT
          INTO schedule_start FROM time_slots WHERE time_slot_id = NEW.time_slot_id;
        IF EXISTS (
          SELECT 1 FROM schedules s
          JOIN time_slots ts ON ts.time_slot_id = s.time_slot_id
          WHERE s.schedule_id IS DISTINCT FROM NEW.schedule_id
            AND s.day_of_week = NEW.day_of_week AND s.status <> 'rejected'
            AND (s.teacher_id = NEW.teacher_id OR s.room_id = NEW.room_id OR s.section_id = NEW.section_id)
            AND int4range(
              EXTRACT(HOUR FROM ts.start_time)::INT * 60 + EXTRACT(MINUTE FROM ts.start_time)::INT,
              EXTRACT(HOUR FROM ts.start_time)::INT * 60 + EXTRACT(MINUTE FROM ts.start_time)::INT + 45,
              '[)'
            ) && int4range(schedule_start, schedule_start + 45, '[)')
        ) THEN
          RAISE EXCEPTION 'Schedule conflicts with another schedule.' USING ERRCODE = '23P01';
        END IF;
        IF EXISTS (
          SELECT 1 FROM jhs_class_program_entries e
          WHERE e.day_of_week = NEW.day_of_week AND e.status <> 'rejected'
            AND (e.teacher_id = NEW.teacher_id OR e.room_id = NEW.room_id OR e.section_id = NEW.section_id)
            AND e.period_range && int4range(schedule_start, schedule_start + 45, '[)')
        ) THEN
          RAISE EXCEPTION 'Schedule conflicts with a JHS class program.' USING ERRCODE = '23P01';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS jhs_program_entry_conflict_guard ON jhs_class_program_entries;
      CREATE TRIGGER jhs_program_entry_conflict_guard
        BEFORE INSERT OR UPDATE ON jhs_class_program_entries
        FOR EACH ROW EXECUTE FUNCTION guard_jhs_program_entry_conflicts();
      DROP TRIGGER IF EXISTS legacy_schedule_conflict_guard ON schedules;
      CREATE TRIGGER legacy_schedule_conflict_guard
        BEFORE INSERT OR UPDATE ON schedules
        FOR EACH ROW EXECUTE FUNCTION guard_legacy_schedule_conflicts();

      ALTER TABLE schedules DROP CONSTRAINT IF EXISTS fk_schedule_section;
      ALTER TABLE schedules ADD CONSTRAINT fk_schedule_section FOREIGN KEY (section_id)
        REFERENCES sections(section_id) ON UPDATE CASCADE ON DELETE RESTRICT;
      ALTER TABLE schedules DROP CONSTRAINT IF EXISTS fk_schedule_subject;
      ALTER TABLE schedules ADD CONSTRAINT fk_schedule_subject FOREIGN KEY (subject_id)
        REFERENCES subjects(subject_id) ON UPDATE CASCADE ON DELETE RESTRICT;
      ALTER TABLE schedules DROP CONSTRAINT IF EXISTS fk_schedule_teacher;
      ALTER TABLE schedules ADD CONSTRAINT fk_schedule_teacher FOREIGN KEY (teacher_id)
        REFERENCES teachers(teacher_id) ON UPDATE CASCADE ON DELETE RESTRICT;
      ALTER TABLE schedules DROP CONSTRAINT IF EXISTS fk_schedule_room;
      ALTER TABLE schedules ADD CONSTRAINT fk_schedule_room FOREIGN KEY (room_id)
        REFERENCES rooms(room_id) ON UPDATE CASCADE ON DELETE RESTRICT;
      ALTER TABLE schedules DROP CONSTRAINT IF EXISTS fk_schedule_time_slot;
      ALTER TABLE schedules ADD CONSTRAINT fk_schedule_time_slot FOREIGN KEY (time_slot_id)
        REFERENCES time_slots(time_slot_id) ON UPDATE CASCADE ON DELETE RESTRICT;
      ALTER TABLE schedule_approvals DROP CONSTRAINT IF EXISTS fk_approval_schedule;
      ALTER TABLE schedule_approvals ADD CONSTRAINT fk_approval_schedule FOREIGN KEY (schedule_id)
        REFERENCES schedules(schedule_id) ON UPDATE CASCADE ON DELETE RESTRICT;
    `)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = { ensureClassProgramSchema }