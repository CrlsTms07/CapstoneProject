// HIPO 4.2 – Rooms & Buildings
// Building CRUD (building name + department).
const pool = require("../../config/database");

// GET all buildings
const getBuildings = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                building_id,
                building_name,
                department_id
            FROM buildings
            ORDER BY building_id
        `);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching buildings:", error);

        res.status(500).json({
            error: "Failed to fetch buildings",
            details: error.message
        });
    }
};

// GET building by ID
const getBuildingById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                building_id,
                building_name,
                department_id
            FROM buildings
            WHERE building_id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Building not found"
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching building:", error);

        res.status(500).json({
            error: "Failed to fetch building",
            details: error.message
        });
    }
};

// CREATE building
const createBuilding = async (req, res) => {
    try {
        const { building_name, department_id } = req.body;

        if (
            !building_name ||
            department_id === undefined ||
            department_id === null
        ) {
            return res.status(400).json({
                error: "building_name and department_id are required"
            });
        }

        const result = await pool.query(
            `
            INSERT INTO buildings
                (building_name, department_id)
            VALUES
                ($1, $2)
            RETURNING
                building_id,
                building_name,
                department_id
            `,
            [building_name, department_id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating building:", error);

        res.status(500).json({
            error: "Failed to create building",
            details: error.message
        });
    }
};

// UPDATE building
const updateBuilding = async (req, res) => {
    try {
        const { id } = req.params;
        const { building_name, department_id } = req.body;

        if (
            !building_name ||
            department_id === undefined ||
            department_id === null
        ) {
            return res.status(400).json({
                error: "building_name and department_id are required"
            });
        }

        const result = await pool.query(
            `
            UPDATE buildings
            SET
                building_name = $1,
                department_id = $2
            WHERE building_id = $3
            RETURNING
                building_id,
                building_name,
                department_id
            `,
            [building_name, department_id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Building not found"
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error updating building:", error);

        res.status(500).json({
            error: "Failed to update building",
            details: error.message
        });
    }
};

// DELETE building
const deleteBuilding = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            DELETE FROM buildings
            WHERE building_id = $1
            RETURNING
                building_id,
                building_name,
                department_id
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Building not found"
            });
        }

        res.status(200).json({
            message: "Building deleted successfully",
            building: result.rows[0]
        });
    } catch (error) {
        console.error("Error deleting building:", error);

        res.status(500).json({
            error: "Failed to delete building",
            details: error.message
        });
    }
};

module.exports = {
    getBuildings,
    getBuildingById,
    createBuilding,
    updateBuilding,
    deleteBuilding
};