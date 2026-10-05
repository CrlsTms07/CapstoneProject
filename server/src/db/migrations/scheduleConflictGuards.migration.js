// HIPO 3.2 – Schedule Plotter (database layer)
// Conflict detection enforced by PostgreSQL itself: GiST exclusion constraints that block
// teacher / room / section overlaps for JHS class-program entries, and triggers that check
// legacy `schedules` rows against each other and against class-program entries.
// API-level checks live in src/modules/schedules/conflict.service.js.

const SCHEDULE_CONFLICT_GUARDS_SQL = `
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
`

module.exports = { SCHEDULE_CONFLICT_GUARDS_SQL }
