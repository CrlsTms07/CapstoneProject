const pool = require("../config/database");

// GET all teachers
const getTeachers = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                teacher_id,
                user_id,
                last_name,
                max_subject_load,
                weekly_load_minutes
            FROM teachers
            ORDER BY teacher_id
        `);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching teachers:", error);

        res.status(500).json({
            error: "Failed to fetch teachers",
            details: error.message
        });
    }
};

// GET teacher by ID
const getTeacherById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                teacher_id,
                user_id,
                last_name,
                max_subject_load,
                weekly_load_minutes
            FROM teachers
            WHERE teacher_id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Teacher not found"
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching teacher:", error);

        res.status(500).json({
            error: "Failed to fetch teacher",
            details: error.message
        });
    }
};

// CREATE teacher
const createTeacher = async (req, res) => {
    try {
        const {
            user_id,
            last_name,
            max_subject_load,
            weekly_load_minutes
        } = req.body;

        if (
            user_id === undefined ||
            user_id === null ||
            !last_name
        ) {
            return res.status(400).json({
                error: "user_id and last_name are required"
            });
        }

        const result = await pool.query(
            `
            INSERT INTO teachers
                (
                    user_id,
                    last_name,
                    max_subject_load,
                    weekly_load_minutes
                )
            VALUES
                ($1, $2, $3, $4)
            RETURNING
                teacher_id,
                user_id,
                last_name,
                max_subject_load,
                weekly_load_minutes
            `,
            [
                user_id,
                last_name,
                max_subject_load ?? null,
                weekly_load_minutes ?? null
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating teacher:", error);

        res.status(500).json({
            error: "Failed to create teacher",
            details: error.message
        });
    }
};

// UPDATE teacher
const updateTeacher = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            user_id,
            last_name,
            max_subject_load,
            weekly_load_minutes
        } = req.body;

        if (
            user_id === undefined ||
            user_id === null ||
            !last_name
        ) {
            return res.status(400).json({
                error: "user_id and last_name are required"
            });
        }

        const result = await pool.query(
            `
            UPDATE teachers
            SET
                user_id = $1,
                last_name = $2,
                max_subject_load = $3,
                weekly_load_minutes = $4
            WHERE teacher_id = $5
            RETURNING
                teacher_id,
                user_id,
                last_name,
                max_subject_load,
                weekly_load_minutes
            `,
            [
                user_id,
                last_name,
                max_subject_load ?? null,
                weekly_load_minutes ?? null,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Teacher not found"
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error updating teacher:", error);

        res.status(500).json({
            error: "Failed to update teacher",
            details: error.message
        });
    }
};

// DELETE teacher
const deleteTeacher = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            DELETE FROM teachers
            WHERE teacher_id = $1
            RETURNING
                teacher_id,
                user_id,
                last_name,
                max_subject_load,
                weekly_load_minutes
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Teacher not found"
            });
        }

        res.status(200).json({
            message: "Teacher deleted successfully",
            teacher: result.rows[0]
        });
    } catch (error) {
        console.error("Error deleting teacher:", error);

        res.status(500).json({
            error: "Failed to delete teacher",
            details: error.message
        });
    }
};

module.exports = {
    getTeachers,
    getTeacherById,
    createTeacher,
    updateTeacher,
    deleteTeacher
};