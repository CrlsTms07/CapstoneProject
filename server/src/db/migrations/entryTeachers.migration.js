// HIPO 3.2 – Schedule Plotter (database layer)
// Startup migration: co-teaching and delivery mode on schedule_entries.
//   schedule_entries.delivery_mode – face_to_face (default) | asynchronous
//   schedule_entries_kind          – a class row needs a room only when it is face_to_face
//   entry_teachers                 – the 1–2 teachers of a class row. schedule_entries.teacher_id stays as
//                                    the primary teacher and is always one of them (kept in sync by triggers).
//
// Conflict guards (the API repeats these rules in src/modules/schedules/conflict.service.js):
//   schedule_entries_teacher_no_overlap – now on entry_teachers, so a co-teacher is checked too.
//       entry_teachers carries copies of term, day, start_min, end_min and status from its entry,
//       because an exclusion constraint can only compare columns of its own table.
//   schedule_entries_room_no_overlap    – now ignores asynchronous entries.
//   The constraints keep their old names: scheduleConflictGuards.migration.js only creates a constraint
//   when no constraint of that name exists, so it does not add the old versions back on the next start.
//
// Additive only: every existing teacher_id is copied into entry_teachers; nothing is deleted.
const pool = require('../../config/database')

const ENTRY_TEACHERS_SQL = `
    ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS delivery_mode VARCHAR(13) NOT NULL DEFAULT 'face_to_face';
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_entries_delivery_mode_check') THEN
        ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_delivery_mode_check
          CHECK (delivery_mode IN ('face_to_face', 'asynchronous'));
      END IF;
    END $$;

    -- Class row: subject + teacher (+ room when face_to_face). Activity row (BREAK, ...): only a name.
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'schedule_entries_kind' AND pg_get_constraintdef(oid) LIKE '%delivery_mode%'
      ) THEN
        ALTER TABLE schedule_entries DROP CONSTRAINT IF EXISTS schedule_entries_kind;
        ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_kind CHECK (
          (subject_id IS NOT NULL AND teacher_id IS NOT NULL AND activity IS NULL
            AND (room_id IS NOT NULL OR delivery_mode = 'asynchronous'))
          OR (subject_id IS NULL AND teacher_id IS NULL AND room_id IS NULL
            AND NULLIF(BTRIM(activity), '') IS NOT NULL AND delivery_mode = 'face_to_face')
        );
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS entry_teachers (
        entry_id INT NOT NULL REFERENCES schedule_entries(entry_id) ON UPDATE CASCADE ON DELETE CASCADE,
        teacher_id INT NOT NULL REFERENCES teachers(teacher_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        -- Copies of the entry (filled by entry_teachers_copy_entry), used only by the overlap guard.
        term_id INT NOT NULL,
        day_of_week VARCHAR(10) NOT NULL,
        start_min INT NOT NULL,
        end_min INT NOT NULL,
        status VARCHAR(10) NOT NULL,
        PRIMARY KEY (entry_id, teacher_id)
    );
    CREATE INDEX IF NOT EXISTS entry_teachers_teacher_idx ON entry_teachers (teacher_id, term_id);

    -- Fills the copied columns from the entry and enforces: class rows only, at most two teachers.
    CREATE OR REPLACE FUNCTION entry_teachers_copy_entry() RETURNS TRIGGER AS $$
    DECLARE
      parent schedule_entries%ROWTYPE;
    BEGIN
      -- Locking the entry makes two sessions adding teachers to it wait for each other.
      SELECT * INTO parent FROM schedule_entries WHERE entry_id = NEW.entry_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Schedule entry % does not exist.', NEW.entry_id USING ERRCODE = '23503';
      END IF;
      IF parent.subject_id IS NULL THEN
        RAISE EXCEPTION 'Only a class row can have teachers.' USING ERRCODE = '23514';
      END IF;
      IF (TG_OP = 'INSERT' OR NEW.teacher_id <> OLD.teacher_id) AND (
        SELECT COUNT(*) FROM entry_teachers WHERE entry_id = NEW.entry_id AND teacher_id <> NEW.teacher_id
      ) >= 2 THEN
        RAISE EXCEPTION 'A schedule entry has at most two teachers.' USING ERRCODE = '23514';
      END IF;
      NEW.term_id := parent.term_id;
      NEW.day_of_week := parent.day_of_week;
      NEW.start_min := parent.start_min;
      NEW.end_min := parent.end_min;
      NEW.status := parent.status;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS entry_teachers_copy_entry ON entry_teachers;
    CREATE TRIGGER entry_teachers_copy_entry
      BEFORE INSERT OR UPDATE ON entry_teachers
      FOR EACH ROW EXECUTE FUNCTION entry_teachers_copy_entry();

    -- The primary teacher (schedule_entries.teacher_id) cannot be removed from entry_teachers on its own.
    -- When the entry itself is deleted (ON DELETE CASCADE) the entry is already gone, so this allows it.
    CREATE OR REPLACE FUNCTION entry_teachers_keep_primary() RETURNS TRIGGER AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM schedule_entries WHERE entry_id = OLD.entry_id AND teacher_id = OLD.teacher_id) THEN
        RAISE EXCEPTION 'Change schedule_entries.teacher_id to replace the primary teacher.' USING ERRCODE = '23514';
      END IF;
      RETURN OLD;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS entry_teachers_keep_primary ON entry_teachers;
    CREATE TRIGGER entry_teachers_keep_primary
      BEFORE DELETE ON entry_teachers
      FOR EACH ROW EXECUTE FUNCTION entry_teachers_keep_primary();

    -- Keeps entry_teachers in step with schedule_entries: adds the primary teacher of a new row,
    -- swaps it when teacher_id changes, drops all teachers when a row becomes an activity, and
    -- refreshes the copied time and status columns.
    CREATE OR REPLACE FUNCTION schedule_entries_sync_teachers() RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        IF NEW.teacher_id IS NULL THEN
          DELETE FROM entry_teachers WHERE entry_id = NEW.entry_id;
        ELSIF OLD.teacher_id IS NOT NULL AND OLD.teacher_id <> NEW.teacher_id THEN
          DELETE FROM entry_teachers WHERE entry_id = NEW.entry_id AND teacher_id = OLD.teacher_id;
        END IF;
        IF (NEW.term_id, NEW.day_of_week, NEW.start_min, NEW.end_min, NEW.status)
           IS DISTINCT FROM (OLD.term_id, OLD.day_of_week, OLD.start_min, OLD.end_min, OLD.status) THEN
          UPDATE entry_teachers SET term_id = NEW.term_id WHERE entry_id = NEW.entry_id; -- the BEFORE trigger copies every column
        END IF;
      END IF;
      IF NEW.teacher_id IS NOT NULL THEN
        INSERT INTO entry_teachers (entry_id, teacher_id, term_id, day_of_week, start_min, end_min, status)
        VALUES (NEW.entry_id, NEW.teacher_id, NEW.term_id, NEW.day_of_week, NEW.start_min, NEW.end_min, NEW.status)
        ON CONFLICT (entry_id, teacher_id) DO NOTHING;
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS schedule_entries_sync_teachers ON schedule_entries;
    CREATE TRIGGER schedule_entries_sync_teachers
      AFTER INSERT OR UPDATE ON schedule_entries
      FOR EACH ROW EXECUTE FUNCTION schedule_entries_sync_teachers();

    -- Copy every existing teacher_id (safe to repeat: rows already there are skipped).
    INSERT INTO entry_teachers (entry_id, teacher_id, term_id, day_of_week, start_min, end_min, status)
    SELECT entry_id, teacher_id, term_id, day_of_week, start_min, end_min, status
    FROM schedule_entries WHERE teacher_id IS NOT NULL
    ON CONFLICT (entry_id, teacher_id) DO NOTHING;

    -- Teacher guard moves from schedule_entries.teacher_id to entry_teachers (same constraint name).
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'schedule_entries_teacher_no_overlap' AND conrelid = 'schedule_entries'::regclass
      ) THEN
        ALTER TABLE schedule_entries DROP CONSTRAINT schedule_entries_teacher_no_overlap;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_entries_teacher_no_overlap') THEN
        ALTER TABLE entry_teachers ADD CONSTRAINT schedule_entries_teacher_no_overlap
          EXCLUDE USING GIST (term_id WITH =, teacher_id WITH =, day_of_week WITH =, int4range(start_min, end_min) WITH &&)
          WHERE (status <> 'rejected');
      END IF;
    END $$;

    -- Room guard: asynchronous entries do not use their room (same constraint name).
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'schedule_entries_room_no_overlap' AND pg_get_constraintdef(oid) LIKE '%delivery_mode%'
      ) THEN
        ALTER TABLE schedule_entries DROP CONSTRAINT IF EXISTS schedule_entries_room_no_overlap;
        ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_room_no_overlap
          EXCLUDE USING GIST (term_id WITH =, room_id WITH =, day_of_week WITH =, int4range(start_min, end_min) WITH &&)
          WHERE (status <> 'rejected' AND room_id IS NOT NULL AND delivery_mode = 'face_to_face');
      END IF;
    END $$;
`

const ensureEntryTeachersSchema = async () => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('CREATE EXTENSION IF NOT EXISTS btree_gist')
    await client.query(ENTRY_TEACHERS_SQL)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = { ensureEntryTeachersSchema }
