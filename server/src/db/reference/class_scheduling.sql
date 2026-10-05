-- REFERENCE ONLY – original ERD schema from the paper. OUTDATED: the live schema is created by
-- src/db/seeds/init_database.js and src/db/migrations/*. Do NOT run this file: it drops all tables.


/*CLASS SCHEDULING SYSTEM
DATABASE: class_scheduling
PostgreSQL*/


DROP TABLE IF EXISTS schedule_approvals, schedules, teacher_tasks, teachers, users, time_slots, rooms, buildings, subjects, sections, grade_levels, departments, roles;





/*2. ROLES*/

CREATE TABLE roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);



/*3. DEPARTMENTS*/


CREATE TABLE departments (
    department_id SERIAL PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL UNIQUE
);



/*4. GRADE LEVELS*/


CREATE TABLE grade_levels (
    grade_level_id SERIAL PRIMARY KEY,
    grade_level_name VARCHAR(50) NOT NULL,
    department_id INT NOT NULL,

    CONSTRAINT fk_grade_level_department
        FOREIGN KEY (department_id)
        REFERENCES departments(department_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);



/*5. BUILDINGS*/    


CREATE TABLE buildings (
    building_id SERIAL PRIMARY KEY,
    building_name VARCHAR(100) NOT NULL,
    department_id INT NOT NULL,

    CONSTRAINT fk_building_department
        FOREIGN KEY (department_id)
        REFERENCES departments(department_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);



/*6. USERS*/

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(150),
    email VARCHAR(150) UNIQUE,
    school_id VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),
    role_id INT NOT NULL,
    department_id INT,
    is_approved BOOLEAN DEFAULT FALSE,

    CONSTRAINT fk_user_role
        FOREIGN KEY (role_id)
        REFERENCES roles(role_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_user_department
        FOREIGN KEY (department_id)
        REFERENCES departments(department_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);



/*7. SECTIONS*/

CREATE TABLE sections (
    section_id SERIAL PRIMARY KEY,
    section_name VARCHAR(100) NOT NULL,
    grade_level_id INT NOT NULL,

    CONSTRAINT fk_section_grade_level
        FOREIGN KEY (grade_level_id)
        REFERENCES grade_levels(grade_level_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);



/*8. SUBJECTS*/

CREATE TABLE subjects (
    subject_id SERIAL PRIMARY KEY,
    subject_name VARCHAR(100) NOT NULL,
    grade_level_id INT NOT NULL,

    CONSTRAINT fk_subject_grade_level
        FOREIGN KEY (grade_level_id)
        REFERENCES grade_levels(grade_level_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);



/*9. TEACHERS*/

CREATE TABLE teachers (
    teacher_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    last_name VARCHAR(100) NOT NULL,
    max_subject_load INT,
    weekly_load_minutes INT,

    CONSTRAINT fk_teacher_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);



/*10. ROOMS*/


CREATE TABLE rooms (
    room_id SERIAL PRIMARY KEY,
    building_id INT NOT NULL,
    room_number VARCHAR(50) NOT NULL,

    CONSTRAINT fk_room_building
        FOREIGN KEY (building_id)
        REFERENCES buildings(building_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);


/*11. TIME SLOTS*/

CREATE TABLE time_slots (
    time_slot_id SERIAL PRIMARY KEY,
    department_id INT NOT NULL,
    start_time TIME NOT NULL,

    CONSTRAINT fk_time_slot_department
        FOREIGN KEY (department_id)
        REFERENCES departments(department_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);



/*12. TEACHER TASKS*/

/*NOTE:
    The ERD shows TEACHER_TASKS but does not show its columns.
    We will add its actual fields later once finalized.*/


CREATE TABLE teacher_tasks (
    teacher_task_id SERIAL PRIMARY KEY,
    teacher_id INT NOT NULL,

    CONSTRAINT fk_teacher_task_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES teachers(teacher_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);



/*13. SCHEDULES*/


CREATE TABLE schedules (
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



/*14. SCHEDULE APPROVALS*/

CREATE TABLE schedule_approvals (
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



/*15. VERIFY TABLES*/


SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;



/*16. VERIFY COLUMNS*/

SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;


-- ============================================================
-- END OF CLASS SCHEDULING DATABASE
-- ============================================================