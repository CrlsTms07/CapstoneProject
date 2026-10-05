// HIPO 3.3 – Manage Teacher
// Data access for teachers' qualified subjects (teacher_subjects, used by Auto-Generate).
// The SQL for teacher CRUD is still inline in teachers.controller.js.
// Teacher tasks data access: see teacherTasks.service.js.
const pool = require("../../config/database");
const { HttpError } = require("../../utils/httpError");

const QUALIFIED_SUBJECTS_SQL = `
    SELECT s.subject_id, s.subject_name, s.grade_level_id, gl.grade_level_name
    FROM teacher_subjects ts
    JOIN subjects s ON s.subject_id = ts.subject_id
    JOIN grade_levels gl ON gl.grade_level_id = s.grade_level_id
    WHERE ts.teacher_id = $1
    ORDER BY gl.grade_level_name, s.subject_name
`;

const assertTeacherExists = async (teacherId, db = pool) => {
    const found = await db.query("SELECT 1 FROM teachers WHERE teacher_id = $1", [teacherId]);
    if (!found.rowCount) throw new HttpError(404, "Teacher not found");
};

const listQualifiedSubjects = async teacherId => {
    await assertTeacherExists(teacherId);
    return (await pool.query(QUALIFIED_SUBJECTS_SQL, [teacherId])).rows;
};

// Replaces the teacher's qualified subjects with subjectIds (in one transaction).
const replaceQualifiedSubjects = async (teacherId, subjectIds) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await assertTeacherExists(teacherId, client);
        const found = await client.query("SELECT subject_id FROM subjects WHERE subject_id = ANY($1::INT[])", [subjectIds]);
        if (found.rowCount !== subjectIds.length) throw new HttpError(400, "One or more selected subjects do not exist.");
        await client.query("DELETE FROM teacher_subjects WHERE teacher_id = $1 AND NOT (subject_id = ANY($2::INT[]))", [teacherId, subjectIds]);
        await client.query(`
            INSERT INTO teacher_subjects (teacher_id, subject_id)
            SELECT $1, UNNEST($2::INT[])
            ON CONFLICT (teacher_id, subject_id) DO NOTHING
        `, [teacherId, subjectIds]);
        const result = await client.query(QUALIFIED_SUBJECTS_SQL, [teacherId]);
        await client.query("COMMIT");
        return result.rows;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

module.exports = { listQualifiedSubjects, replaceQualifiedSubjects };
