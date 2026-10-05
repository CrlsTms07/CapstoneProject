// HIPO 3.2 – Schedule Plotter (database layer)
// Startup migration for the unified schedule model:
//   terms                  – school year + term (e.g. 2026-2027 · Full Year / 1st Semester)
//   department_time_rules  – allowed days, school-day window and period length per department
//   schedule_entries       – one class meeting: section, subject, teacher, room, day, start_min–end_min
//   approval_logs          – every submit / approve / reject action on an entry (audit trail)
//   class_program_headers  – printed class-program details (adviser, signatories) per section and term
//   teacher_subjects       – which subjects a teacher is qualified to teach (used by Auto-Generate)
//   subjects.weekly_periods – how many periods a subject needs per week (used by Auto-Generate)
//
// Everything here is additive: no table, column or row is dropped. Rows in the older
// jhs_class_program_* and schedules tables are copied over once and the old tables are left as they are.
const pool = require("../../config/database");
const { SCHEDULE_ENTRY_GUARDS_SQL } = require("./scheduleConflictGuards.migration");

const SCHEDULE_ENTRY_TABLES_SQL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS terms (
        term_id SERIAL PRIMARY KEY,
        school_year VARCHAR(9) NOT NULL CHECK (school_year ~ '^[0-9]{4}-[0-9]{4}$'),
        term_name VARCHAR(40) NOT NULL DEFAULT 'Full Year',
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        CONSTRAINT terms_year_name_unique UNIQUE (school_year, term_name)
    );
    -- At most one active term at a time.
    CREATE UNIQUE INDEX IF NOT EXISTS terms_single_active ON terms (is_active) WHERE is_active;

    CREATE TABLE IF NOT EXISTS department_time_rules (
        department_id INT PRIMARY KEY REFERENCES departments(department_id) ON UPDATE CASCADE ON DELETE CASCADE,
        period_minutes SMALLINT NOT NULL CHECK (period_minutes BETWEEN 15 AND 240),
        day_start_min SMALLINT NOT NULL,
        day_end_min SMALLINT NOT NULL,
        allowed_days TEXT[] NOT NULL DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        CONSTRAINT department_time_rules_window CHECK (0 <= day_start_min AND day_start_min < day_end_min AND day_end_min <= 1440)
    );

    ALTER TABLE subjects ADD COLUMN IF NOT EXISTS weekly_periods SMALLINT
        CHECK (weekly_periods BETWEEN 1 AND 20);

    CREATE TABLE IF NOT EXISTS teacher_subjects (
        teacher_id INT NOT NULL REFERENCES teachers(teacher_id) ON UPDATE CASCADE ON DELETE CASCADE,
        subject_id INT NOT NULL REFERENCES subjects(subject_id) ON UPDATE CASCADE ON DELETE CASCADE,
        PRIMARY KEY (teacher_id, subject_id)
    );

    -- start_min / end_min are minutes after midnight (07:30 = 450). A row is either a class
    -- (subject + teacher + room) or a non-class activity such as BREAK or LUNCH.
    CREATE TABLE IF NOT EXISTS schedule_entries (
        entry_id SERIAL PRIMARY KEY,
        term_id INT NOT NULL REFERENCES terms(term_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        section_id INT NOT NULL REFERENCES sections(section_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        subject_id INT REFERENCES subjects(subject_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        teacher_id INT REFERENCES teachers(teacher_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        room_id INT REFERENCES rooms(room_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        activity VARCHAR(100),
        day_of_week VARCHAR(10) NOT NULL
            CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')),
        start_min INT NOT NULL,
        end_min INT NOT NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
        created_by INT REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT schedule_entries_time_order CHECK (0 <= start_min AND start_min < end_min AND end_min <= 1440),
        CONSTRAINT schedule_entries_kind CHECK (
            (subject_id IS NOT NULL AND teacher_id IS NOT NULL AND room_id IS NOT NULL AND activity IS NULL)
            OR (subject_id IS NULL AND teacher_id IS NULL AND room_id IS NULL AND NULLIF(BTRIM(activity), '') IS NOT NULL)
        )
    );
    CREATE INDEX IF NOT EXISTS schedule_entries_section_idx ON schedule_entries (term_id, section_id, status);
    CREATE INDEX IF NOT EXISTS schedule_entries_day_idx ON schedule_entries (term_id, day_of_week);

    CREATE TABLE IF NOT EXISTS approval_logs (
        log_id SERIAL PRIMARY KEY,
        entry_id INT NOT NULL REFERENCES schedule_entries(entry_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        action VARCHAR(20) NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected')),
        from_status VARCHAR(10) NOT NULL,
        to_status VARCHAR(10) NOT NULL,
        performed_by INT NOT NULL REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS approval_logs_entry_idx ON approval_logs (entry_id, created_at);

    CREATE TABLE IF NOT EXISTS class_program_headers (
        term_id INT NOT NULL REFERENCES terms(term_id) ON UPDATE CASCADE ON DELETE RESTRICT,
        section_id INT NOT NULL REFERENCES sections(section_id) ON UPDATE CASCADE ON DELETE CASCADE,
        header JSONB NOT NULL DEFAULT '{}'::JSONB,
        updated_by INT REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (term_id, section_id)
    );
`;

// The school year that contains today (a new school year starts in June).
const currentSchoolYear = (today = new Date()) => {
    const startYear = today.getMonth() >= 5 ? today.getFullYear() : today.getFullYear() - 1;
    return `${startYear}-${startYear + 1}`;
};

// Makes sure there is at least one term, so the plotter always has something to select.
const DEFAULT_TERM_SQL = `
    INSERT INTO terms (school_year, term_name, is_active)
    SELECT $1, 'Full Year', TRUE
    WHERE NOT EXISTS (SELECT 1 FROM terms)
`;

// One-time copy of rows saved by the earlier JHS class-program tables and the legacy schedules table.
const COPY_OLD_SCHEDULES_SQL = `
    INSERT INTO terms (school_year, term_name)
    SELECT DISTINCT school_year, 'Full Year' FROM jhs_class_programs
    ON CONFLICT (school_year, term_name) DO NOTHING;

    INSERT INTO schedule_entries
        (term_id, section_id, subject_id, teacher_id, room_id, activity, day_of_week,
         start_min, end_min, status, created_by, created_at, updated_at)
    SELECT t.term_id, e.section_id, e.subject_id, e.teacher_id, e.room_id, e.activity, e.day_of_week,
           EXTRACT(HOUR FROM e.start_time)::INT * 60 + EXTRACT(MINUTE FROM e.start_time)::INT,
           EXTRACT(HOUR FROM e.start_time)::INT * 60 + EXTRACT(MINUTE FROM e.start_time)::INT + e.duration_minutes,
           e.status, p.created_by, p.created_at, p.updated_at
    FROM jhs_class_program_entries e
    JOIN jhs_class_programs p ON p.program_id = e.program_id
    JOIN terms t ON t.school_year = p.school_year AND t.term_name = 'Full Year';

    INSERT INTO class_program_headers (term_id, section_id, header, updated_by, updated_at)
    SELECT t.term_id, p.section_id, p.header, p.created_by, p.updated_at
    FROM jhs_class_programs p
    JOIN terms t ON t.school_year = p.school_year AND t.term_name = 'Full Year'
    ON CONFLICT (term_id, section_id) DO NOTHING;

    -- Old approvals were per program; record them against every copied entry of that program.
    INSERT INTO approval_logs (entry_id, action, from_status, to_status, performed_by, notes, created_at)
    SELECT se.entry_id, a.action,
           CASE a.action WHEN 'submitted' THEN 'draft' ELSE 'pending' END,
           CASE a.action WHEN 'submitted' THEN 'pending' ELSE a.action END,
           a.performed_by, a.notes, a.created_at
    FROM jhs_class_program_approvals a
    JOIN jhs_class_programs p ON p.program_id = a.program_id
    JOIN terms t ON t.school_year = p.school_year AND t.term_name = 'Full Year'
    JOIN schedule_entries se ON se.term_id = t.term_id AND se.section_id = p.section_id;

    -- Legacy schedules have no school year: they go into the active term as 45-minute periods.
    INSERT INTO schedule_entries
        (term_id, section_id, subject_id, teacher_id, room_id, day_of_week, start_min, end_min, status)
    SELECT (SELECT term_id FROM terms WHERE is_active LIMIT 1),
           s.section_id, s.subject_id, s.teacher_id, s.room_id, s.day_of_week,
           EXTRACT(HOUR FROM ts.start_time)::INT * 60 + EXTRACT(MINUTE FROM ts.start_time)::INT,
           EXTRACT(HOUR FROM ts.start_time)::INT * 60 + EXTRACT(MINUTE FROM ts.start_time)::INT + 45,
           CASE s.status WHEN 'scheduled' THEN 'approved' WHEN 'approved' THEN 'approved'
                         WHEN 'pending' THEN 'pending' WHEN 'rejected' THEN 'rejected' ELSE 'draft' END
    FROM schedules s
    JOIN time_slots ts ON ts.time_slot_id = s.time_slot_id
    WHERE EXISTS (SELECT 1 FROM terms WHERE is_active);
`;

const COPY_MIGRATION_NAME = "copy-old-schedules-into-schedule-entries";

const copyOldSchedulesOnce = async client => {
    const done = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [COPY_MIGRATION_NAME]);
    if (done.rowCount) return;
    // A savepoint lets the server still start if old data cannot be copied (e.g. it overlaps);
    // the old tables stay untouched and the copy is retried on the next start.
    await client.query("SAVEPOINT copy_old_schedules");
    try {
        await client.query(COPY_OLD_SCHEDULES_SQL);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [COPY_MIGRATION_NAME]);
        await client.query("RELEASE SAVEPOINT copy_old_schedules");
    } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT copy_old_schedules");
        console.warn(`Old schedule rows were not copied into schedule_entries: ${error.message}`);
    }
};

const ensureScheduleEntriesSchema = async () => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("CREATE EXTENSION IF NOT EXISTS btree_gist");
        await client.query(SCHEDULE_ENTRY_TABLES_SQL);
        await client.query(SCHEDULE_ENTRY_GUARDS_SQL);
        await client.query(DEFAULT_TERM_SQL, [currentSchoolYear()]);
        await copyOldSchedulesOnce(client);
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

module.exports = { ensureScheduleEntriesSchema, currentSchoolYear };
