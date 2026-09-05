const pool = require("../config/database");

// GET all subjects
const getSubjects = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                subject_id,
                subject_name,
                grade_level_id
            FROM subjects
            ORDER BY subject_id
        `);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching subjects:", error);

        res.status(500).json({
            error: "Failed to fetch subjects",
            details: error.message
        });
    }
};

// GET subject by ID
const getSubjectById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                subject_id,
                subject_name,
                grade_level_id
            FROM subjects
            WHERE subject_id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Subject not found"
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching subject:", error);

        res.status(500).json({
            error: "Failed to fetch subject",
            details: error.message
        });
    }
};

// CREATE subject
const createSubject = async (req, res) => {
    try {
        const { subject_name, grade_level_id } = req.body;

        if (
            !subject_name ||
            grade_level_id === undefined ||
            grade_level_id === null
        ) {
            return res.status(400).json({
                error: "subject_name and grade_level_id are required"
            });
        }

        const result = await pool.query(
            `
            INSERT INTO subjects
                (subject_name, grade_level_id)
            VALUES
                ($1, $2)
            RETURNING
                subject_id,
                subject_name,
                grade_level_id
            `,
            [subject_name, grade_level_id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating subject:", error);

        res.status(500).json({
            error: "Failed to create subject",
            details: error.message
        });
    }
};

// UPDATE subject
const updateSubject = async (req, res) => {
    try {
        const { id } = req.params;
        const { subject_name, grade_level_id } = req.body;

        if (
            !subject_name ||
            grade_level_id === undefined ||
            grade_level_id === null
        ) {
            return res.status(400).json({
                error: "subject_name and grade_level_id are required"
            });
        }

        const result = await pool.query(
            `
            UPDATE subjects
            SET
                subject_name = $1,
                grade_level_id = $2
            WHERE subject_id = $3
            RETURNING
                subject_id,
                subject_name,
                grade_level_id
            `,
            [subject_name, grade_level_id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Subject not found"
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error updating subject:", error);

        res.status(500).json({
            error: "Failed to update subject",
            details: error.message
        });
    }
};

// DELETE subject
const deleteSubject = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            DELETE FROM subjects
            WHERE subject_id = $1
            RETURNING
                subject_id,
                subject_name,
                grade_level_id
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Subject not found"
            });
        }

        res.status(200).json({
            message: "Subject deleted successfully",
            subject: result.rows[0]
        });
    } catch (error) {
        console.error("Error deleting subject:", error);

        res.status(500).json({
            error: "Failed to delete subject",
            details: error.message
        });
    }
};

module.exports = {
    getSubjects,
    getSubjectById,
    createSubject,
    updateSubject,
    deleteSubject
};