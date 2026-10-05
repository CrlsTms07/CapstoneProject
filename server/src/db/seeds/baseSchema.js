// HIPO 2.0 – Login / 4.3 Users & Roles (database schema)
// The base tables (roles, departments, users, sections, subjects, teachers, rooms, ...).
// Used by npm run db:init and by the test database setup (tests/helpers/testDatabase.js).
// Later schema changes live in src/db/migrations/ and run at server startup.

const BASE_TABLES_SQL = `
    -- Roles
    CREATE TABLE IF NOT EXISTS roles (
        role_id SERIAL PRIMARY KEY,
        role_name VARCHAR(50) NOT NULL UNIQUE
    );

    -- Departments
    CREATE TABLE IF NOT EXISTS departments (
        department_id SERIAL PRIMARY KEY,
        department_name VARCHAR(100) NOT NULL UNIQUE
    );

    -- Grade Levels
    CREATE TABLE IF NOT EXISTS grade_levels (
        grade_level_id SERIAL PRIMARY KEY,
        grade_level_name VARCHAR(50) NOT NULL,
        department_id INT NOT NULL,
        CONSTRAINT fk_grade_level_department
            FOREIGN KEY (department_id)
            REFERENCES departments(department_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    );

    -- Buildings
    CREATE TABLE IF NOT EXISTS buildings (
        building_id SERIAL PRIMARY KEY,
        building_name VARCHAR(100) NOT NULL,
        department_id INT NOT NULL,
        CONSTRAINT fk_building_department
            FOREIGN KEY (department_id)
            REFERENCES departments(department_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    );

    -- Users
    CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        full_name VARCHAR(150),
        email VARCHAR(150),
        school_id VARCHAR(50),
        password_hash VARCHAR(255),
        role_id INT NOT NULL,
        department_id INT,
        assigned_grade_level_id INT,
        is_approved BOOLEAN DEFAULT FALSE,
        must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
        temporary_password_expires_at TIMESTAMPTZ,
        CONSTRAINT fk_user_role
            FOREIGN KEY (role_id)
            REFERENCES roles(role_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE,
        CONSTRAINT fk_user_department
            FOREIGN KEY (department_id)
            REFERENCES departments(department_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE,
        CONSTRAINT fk_user_assigned_grade_level
            FOREIGN KEY (assigned_grade_level_id)
            REFERENCES grade_levels(grade_level_id)
            ON UPDATE CASCADE
            ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS password_reset_requests (
        request_id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        employee_id VARCHAR(50) NOT NULL,
        email VARCHAR(150) NOT NULL,
        reason VARCHAR(100) NOT NULL,
        contact_number VARCHAR(40) NOT NULL,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
        reviewed_by INT REFERENCES users(user_id) ON DELETE SET NULL,
        reviewed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS password_reset_requests_pending_idx
        ON password_reset_requests(status, requested_at);

    -- Sections
    CREATE TABLE IF NOT EXISTS sections (
        section_id SERIAL PRIMARY KEY,
        section_name VARCHAR(100) NOT NULL,
        grade_level_id INT NOT NULL,
        CONSTRAINT fk_section_grade_level
            FOREIGN KEY (grade_level_id)
            REFERENCES grade_levels(grade_level_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    );

    -- Subjects
    CREATE TABLE IF NOT EXISTS subjects (
        subject_id SERIAL PRIMARY KEY,
        subject_name VARCHAR(100) NOT NULL,
        grade_level_id INT NOT NULL,
        CONSTRAINT fk_subject_grade_level
            FOREIGN KEY (grade_level_id)
            REFERENCES grade_levels(grade_level_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    );

    -- Teachers
    CREATE TABLE IF NOT EXISTS teachers (
        teacher_id SERIAL PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        last_name VARCHAR(100) NOT NULL,
        max_subject_load INT,
        weekly_load_minutes INT,
        ancillary_tasks TEXT[] NOT NULL DEFAULT '{}',
        CONSTRAINT fk_teacher_user
            FOREIGN KEY (user_id)
            REFERENCES users(user_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    );

    -- Rooms
    CREATE TABLE IF NOT EXISTS rooms (
        room_id SERIAL PRIMARY KEY,
        building_id INT NOT NULL,
        room_number VARCHAR(50) NOT NULL,
        CONSTRAINT fk_room_building
            FOREIGN KEY (building_id)
            REFERENCES buildings(building_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    );

    -- Time Slots
    CREATE TABLE IF NOT EXISTS time_slots (
        time_slot_id SERIAL PRIMARY KEY,
        department_id INT NOT NULL,
        start_time TIME NOT NULL,
        CONSTRAINT fk_time_slot_department
            FOREIGN KEY (department_id)
            REFERENCES departments(department_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    );

    -- Teacher Tasks
    CREATE TABLE IF NOT EXISTS teacher_tasks (
        teacher_task_id SERIAL PRIMARY KEY,
        teacher_id INT NOT NULL,
        CONSTRAINT fk_teacher_task_teacher
            FOREIGN KEY (teacher_id)
            REFERENCES teachers(teacher_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    );

    -- Schedules
    CREATE TABLE IF NOT EXISTS schedules (
        schedule_id SERIAL PRIMARY KEY,
        section_id INT NOT NULL,
        subject_id INT NOT NULL,
        teacher_id INT NOT NULL,
        room_id INT NOT NULL,
        time_slot_id INT NOT NULL,
        day_of_week VARCHAR(20) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
        CONSTRAINT fk_schedule_section
            FOREIGN KEY (section_id)
            REFERENCES sections(section_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE,
        CONSTRAINT fk_schedule_subject
            FOREIGN KEY (subject_id)
            REFERENCES subjects(subject_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE,
        CONSTRAINT fk_schedule_teacher
            FOREIGN KEY (teacher_id)
            REFERENCES teachers(teacher_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE,
        CONSTRAINT fk_schedule_room
            FOREIGN KEY (room_id)
            REFERENCES rooms(room_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE,
        CONSTRAINT fk_schedule_time_slot
            FOREIGN KEY (time_slot_id)
            REFERENCES time_slots(time_slot_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    );

    -- Schedule Approvals
    CREATE TABLE IF NOT EXISTS schedule_approvals (
        approval_id SERIAL PRIMARY KEY,
        schedule_id INT NOT NULL,
        action VARCHAR(30) NOT NULL,
        performed_by INT NOT NULL,
        CONSTRAINT fk_approval_schedule
            FOREIGN KEY (schedule_id)
            REFERENCES schedules(schedule_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE,
        CONSTRAINT fk_approval_user
            FOREIGN KEY (performed_by)
            REFERENCES users(user_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    );

    -- Session table (for express-session)
    CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL COLLATE "default",
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL,
        PRIMARY KEY (sid)
    );
    CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
`;

const USER_COLUMNS_SQL = `
    ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id VARCHAR(50);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMPTZ;
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email) WHERE email IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS users_school_id_unique ON users (school_id) WHERE school_id IS NOT NULL;
`;

// Creates every base table (safe to run more than once).
const createBaseTables = async db => {
    await db.query(BASE_TABLES_SQL);
    await db.query(USER_COLUMNS_SQL);
};

module.exports = { createBaseTables };
