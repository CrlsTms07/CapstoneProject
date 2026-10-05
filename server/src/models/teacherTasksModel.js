const pool = require("../config/database");

// GET all teacher tasks
const getAllTeacherTasks = async () => {
    const result = await pool.query(`
        SELECT *
        FROM teacher_tasks
        ORDER BY teacher_task_id
    `);

    return result.rows;
};

// GET teacher task by ID
const getTeacherTaskById = async (id) => {
    const result = await pool.query(
        `
        SELECT *
        FROM teacher_tasks
        WHERE teacher_task_id = $1
        `,
        [id]
    );

    return result.rows[0];
};

// CREATE teacher task
const createTeacherTask = async (teacher_id) => {
    const result = await pool.query(
        `
        INSERT INTO teacher_tasks (teacher_id)
        VALUES ($1)
        RETURNING *
        `,
        [teacher_id]
    );

    return result.rows[0];
};

// UPDATE teacher task
const updateTeacherTask = async (id, teacher_id) => {
    const result = await pool.query(
        `
        UPDATE teacher_tasks
        SET teacher_id = $1
        WHERE teacher_task_id = $2
        RETURNING *
        `,
        [teacher_id, id]
    );

    return result.rows[0];
};

// DELETE teacher task
const deleteTeacherTask = async (id) => {
    const result = await pool.query(
        `
        DELETE FROM teacher_tasks
        WHERE teacher_task_id = $1
        RETURNING *
        `,
        [id]
    );

    return result.rows[0];
};

module.exports = {
    getAllTeacherTasks,
    getTeacherTaskById,
    createTeacherTask,
    updateTeacherTask,
    deleteTeacherTask
};