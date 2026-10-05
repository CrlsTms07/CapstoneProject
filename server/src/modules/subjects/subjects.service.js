// HIPO 4.1 – Subjects
// Data access for subjects: name, grade level, display color and weekly minutes.
const pool = require("../../config/database");

const SUBJECT_COLUMNS = "subject_id, subject_name, grade_level_id, color, weekly_minutes";

const listSubjects = async () => (await pool.query(`SELECT ${SUBJECT_COLUMNS} FROM subjects ORDER BY subject_id`)).rows;

const getSubject = async id => (await pool.query(`SELECT ${SUBJECT_COLUMNS} FROM subjects WHERE subject_id = $1`, [id])).rows[0] || null;

const createSubject = async subject => (await pool.query(`
    INSERT INTO subjects (subject_name, grade_level_id, color, weekly_minutes)
    VALUES ($1, $2, $3, $4)
    RETURNING ${SUBJECT_COLUMNS}
`, [subject.subject_name, subject.grade_level_id, subject.color ?? null, subject.weekly_minutes ?? null])).rows[0];

// color / weekly_minutes that are undefined keep their saved value.
const updateSubject = async (id, subject) => (await pool.query(`
    UPDATE subjects
    SET subject_name = $1,
        grade_level_id = $2,
        color = CASE WHEN $3 THEN $4 ELSE color END,
        weekly_minutes = CASE WHEN $5 THEN $6::SMALLINT ELSE weekly_minutes END
    WHERE subject_id = $7
    RETURNING ${SUBJECT_COLUMNS}
`, [subject.subject_name, subject.grade_level_id, subject.color !== undefined, subject.color ?? null,
    subject.weekly_minutes !== undefined, subject.weekly_minutes ?? null, id])).rows[0] || null;

const deleteSubject = async id => (await pool.query(`DELETE FROM subjects WHERE subject_id = $1 RETURNING ${SUBJECT_COLUMNS}`, [id])).rows[0] || null;

module.exports = { listSubjects, getSubject, createSubject, updateSubject, deleteSubject };
