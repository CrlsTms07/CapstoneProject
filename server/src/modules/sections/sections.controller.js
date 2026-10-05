// HIPO 3.4 – Manage Section
// Section CRUD (section name + grade level).
const pool = require("../../config/database");

// GET all sections
const getSections = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                section_id,
                section_name,
                grade_level_id
            FROM sections
            ORDER BY section_id
        `);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching sections:", error);

        res.status(500).json({
            error: "Failed to fetch sections",
            details: error.message
        });
    }
};

// GET section by ID
const getSectionById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                section_id,
                section_name,
                grade_level_id
            FROM sections
            WHERE section_id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Section not found"
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching section:", error);

        res.status(500).json({
            error: "Failed to fetch section",
            details: error.message
        });
    }
};

// CREATE section
const createSection = async (req, res) => {
    try {
        const { section_name, grade_level_id } = req.body;

        if (
            !section_name ||
            grade_level_id === undefined ||
            grade_level_id === null
        ) {
            return res.status(400).json({
                error: "section_name and grade_level_id are required"
            });
        }

        const result = await pool.query(
            `
            INSERT INTO sections
                (section_name, grade_level_id)
            VALUES
                ($1, $2)
            RETURNING
                section_id,
                section_name,
                grade_level_id
            `,
            [section_name, grade_level_id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating section:", error);

        res.status(500).json({
            error: "Failed to create section",
            details: error.message
        });
    }
};

// UPDATE section
const updateSection = async (req, res) => {
    try {
        const { id } = req.params;
        const { section_name, grade_level_id } = req.body;

        if (
            !section_name ||
            grade_level_id === undefined ||
            grade_level_id === null
        ) {
            return res.status(400).json({
                error: "section_name and grade_level_id are required"
            });
        }

        const result = await pool.query(
            `
            UPDATE sections
            SET
                section_name = $1,
                grade_level_id = $2
            WHERE section_id = $3
            RETURNING
                section_id,
                section_name,
                grade_level_id
            `,
            [section_name, grade_level_id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Section not found"
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error updating section:", error);

        res.status(500).json({
            error: "Failed to update section",
            details: error.message
        });
    }
};

// DELETE section
const deleteSection = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            DELETE FROM sections
            WHERE section_id = $1
            RETURNING
                section_id,
                section_name,
                grade_level_id
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Section not found"
            });
        }

        res.status(200).json({
            message: "Section deleted successfully",
            section: result.rows[0]
        });
    } catch (error) {
        console.error("Error deleting section:", error);

        res.status(500).json({
            error: "Failed to delete section",
            details: error.message
        });
    }
};

module.exports = {
    getSections,
    getSectionById,
    createSection,
    updateSection,
    deleteSection
};