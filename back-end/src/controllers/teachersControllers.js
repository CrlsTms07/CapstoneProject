const pool = require("../config/database");
const ALLOWED_ANCILLARY_TASKS = new Set(["ICT Coordinator", "SSG Coordinator", "Lab Manager"]);

const normalizeAncillaryTasks = tasks => {
    if (tasks === undefined) return [];
    if (!Array.isArray(tasks) || tasks.some(task => !ALLOWED_ANCILLARY_TASKS.has(task))) return null;
    return [...new Set(tasks)];
};

const validMaxSubjectLoad = value => value === undefined || value === null || value === '' || (Number.isInteger(Number(value)) && Number(value) >= 4 && Number(value) <= 5);

// GET all teachers
const getTeachers = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.teacher_id, t.user_id, u.full_name, t.last_name,
                   t.max_subject_load, t.weekly_load_minutes, t.ancillary_tasks
            FROM teachers t
            JOIN users u ON u.user_id = t.user_id
            ORDER BY t.teacher_id
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
            `SELECT teacher_id, user_id, last_name, max_subject_load, weekly_load_minutes, ancillary_tasks FROM teachers WHERE teacher_id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Teacher not found"
            });
        }

        const teacher = result.rows[0];

        // If logged-in user is a Teacher, ensure they can only view their own profile
        if (req.session && req.session.user && req.session.user.role_id === 4) {
            if (teacher.user_id !== req.session.user.user_id) {
                return res.status(403).json({ error: "Access denied." });
            }
        }

        res.status(200).json(teacher);
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
            weekly_load_minutes,
            ancillary_tasks: requestedTasks
        } = req.body;
        const ancillary_tasks = normalizeAncillaryTasks(requestedTasks);

        if (ancillary_tasks === null) return res.status(400).json({ error: "Ancillary tasks must be ICT Coordinator, SSG Coordinator, or Lab Manager." });
        if (!validMaxSubjectLoad(max_subject_load)) return res.status(400).json({ error: "Maximum subject load must be 4 or 5." });

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
                    weekly_load_minutes,
                    ancillary_tasks
                )
            VALUES
                ($1, $2, $3, $4, $5)
            RETURNING
                teacher_id,
                user_id,
                last_name,
                max_subject_load,
                weekly_load_minutes,
                ancillary_tasks
            `,
            [
                user_id,
                last_name,
                max_subject_load ?? null,
                weekly_load_minutes ?? null,
                ancillary_tasks
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
            weekly_load_minutes,
            ancillary_tasks: requestedTasks
        } = req.body;
        const ancillary_tasks = normalizeAncillaryTasks(requestedTasks);

        if (ancillary_tasks === null) return res.status(400).json({ error: "Ancillary tasks must be ICT Coordinator, SSG Coordinator, or Lab Manager." });
        if (!validMaxSubjectLoad(max_subject_load)) return res.status(400).json({ error: "Maximum subject load must be 4 or 5." });

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
                weekly_load_minutes = $4,
                ancillary_tasks = $5
            WHERE teacher_id = $6
            RETURNING
                teacher_id,
                user_id,
                last_name,
                max_subject_load,
                weekly_load_minutes,
                ancillary_tasks
            `,
            [
                user_id,
                last_name,
                max_subject_load ?? null,
                weekly_load_minutes ?? null,
                ancillary_tasks,
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