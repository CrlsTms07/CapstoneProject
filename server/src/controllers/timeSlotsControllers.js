const pool = require("../config/database");

// GET all time slots
const getTimeSlots = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                time_slot_id,
                department_id,
                start_time
            FROM time_slots
            ORDER BY time_slot_id
        `);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching time slots:", error);

        res.status(500).json({
            error: "Failed to fetch time slots",
            details: error.message
        });
    }
};

// GET time slot by ID
const getTimeSlotById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                time_slot_id,
                department_id,
                start_time
            FROM time_slots
            WHERE time_slot_id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Time slot not found"
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching time slot:", error);

        res.status(500).json({
            error: "Failed to fetch time slot",
            details: error.message
        });
    }
};

// CREATE time slot
const createTimeSlot = async (req, res) => {
    try {
        const { department_id, start_time } = req.body;

        if (
            department_id === undefined ||
            department_id === null ||
            !start_time
        ) {
            return res.status(400).json({
                error: "department_id and start_time are required"
            });
        }

        const result = await pool.query(
            `
            INSERT INTO time_slots
                (department_id, start_time)
            VALUES
                ($1, $2)
            RETURNING
                time_slot_id,
                department_id,
                start_time
            `,
            [department_id, start_time]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating time slot:", error);

        res.status(500).json({
            error: "Failed to create time slot",
            details: error.message
        });
    }
};

// UPDATE time slot
const updateTimeSlot = async (req, res) => {
    try {
        const { id } = req.params;
        const { department_id, start_time } = req.body;

        if (
            department_id === undefined ||
            department_id === null ||
            !start_time
        ) {
            return res.status(400).json({
                error: "department_id and start_time are required"
            });
        }

        const result = await pool.query(
            `
            UPDATE time_slots
            SET
                department_id = $1,
                start_time = $2
            WHERE time_slot_id = $3
            RETURNING
                time_slot_id,
                department_id,
                start_time
            `,
            [department_id, start_time, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Time slot not found"
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error updating time slot:", error);

        res.status(500).json({
            error: "Failed to update time slot",
            details: error.message
        });
    }
};

// DELETE time slot
const deleteTimeSlot = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            DELETE FROM time_slots
            WHERE time_slot_id = $1
            RETURNING
                time_slot_id,
                department_id,
                start_time
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Time slot not found"
            });
        }

        res.status(200).json({
            message: "Time slot deleted successfully",
            time_slot: result.rows[0]
        });
    } catch (error) {
        console.error("Error deleting time slot:", error);

        res.status(500).json({
            error: "Failed to delete time slot",
            details: error.message
        });
    }
};

module.exports = {
    getTimeSlots,
    getTimeSlotById,
    createTimeSlot,
    updateTimeSlot,
    deleteTimeSlot
};