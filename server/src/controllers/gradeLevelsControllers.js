const pool = require("../config/database");

// GET all grade levels
const getGradeLevels = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                grade_level_id,
                grade_level_name,
                department_id
            FROM grade_levels
            ORDER BY grade_level_id
        `);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching grade levels:", error);

        res.status(500).json({
            error: "Failed to fetch grade levels",
            details: error.message
        });
    }
};

// GET grade level by ID
const getGradeLevelById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                grade_level_id,
                grade_level_name,
                department_id
            FROM grade_levels
            WHERE grade_level_id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Grade level not found"
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching grade level:", error);

        res.status(500).json({
            error: "Failed to fetch grade level",
            details: error.message
        });
    }
};

// CREATE grade level
const createGradeLevel = async (req, res) => {
    try {
        const { grade_level_name, department_id } = req.body;

        if (!grade_level_name || department_id === undefined || department_id === null) {
            return res.status(400).json({
                error: "grade_level_name and department_id are required"
            });
        }

        const result = await pool.query(
            `
            INSERT INTO grade_levels
                (grade_level_name, department_id)
            VALUES
                ($1, $2)
            RETURNING
                grade_level_id,
                grade_level_name,
                department_id
            `,
            [grade_level_name, department_id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating grade level:", error);

        res.status(500).json({
            error: "Failed to create grade level",
            details: error.message
        });
    }
};

// UPDATE grade level
const updateGradeLevel = async (req, res) => {
    try {
        const { id } = req.params;
        const { grade_level_name, department_id } = req.body;

        if (!grade_level_name || department_id === undefined || department_id === null) {
            return res.status(400).json({
                error: "grade_level_name and department_id are required"
            });
        }

        const result = await pool.query(
            `
            UPDATE grade_levels
            SET
                grade_level_name = $1,
                department_id = $2
            WHERE grade_level_id = $3
            RETURNING
                grade_level_id,
                grade_level_name,
                department_id
            `,
            [grade_level_name, department_id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Grade level not found"
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error updating grade level:", error);

        res.status(500).json({
            error: "Failed to update grade level",
            details: error.message
        });
    }
};

// DELETE grade level
const deleteGradeLevel = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            DELETE FROM grade_levels
            WHERE grade_level_id = $1
            RETURNING
                grade_level_id,
                grade_level_name,
                department_id
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Grade level not found"
            });
        }

        res.status(200).json({
            message: "Grade level deleted successfully",
            grade_level: result.rows[0]
        });
    } catch (error) {
        console.error("Error deleting grade level:", error);

        res.status(500).json({
            error: "Failed to delete grade level",
            details: error.message
        });
    }
};

module.exports = {
    getGradeLevels,
    getGradeLevelById,
    createGradeLevel,
    updateGradeLevel,
    deleteGradeLevel
};