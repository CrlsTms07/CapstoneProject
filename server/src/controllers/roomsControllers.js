const pool = require("../config/database");

// GET all rooms
const getRooms = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                room_id,
                building_id,
                room_number
            FROM rooms
            ORDER BY room_id
        `);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching rooms:", error);

        res.status(500).json({
            error: "Failed to fetch rooms",
            details: error.message
        });
    }
};

// GET room by ID
const getRoomById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                room_id,
                building_id,
                room_number
            FROM rooms
            WHERE room_id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Room not found"
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching room:", error);

        res.status(500).json({
            error: "Failed to fetch room",
            details: error.message
        });
    }
};

// CREATE room
const createRoom = async (req, res) => {
    try {
        const { building_id, room_number } = req.body;

        if (
            building_id === undefined ||
            building_id === null ||
            !room_number
        ) {
            return res.status(400).json({
                error: "building_id and room_number are required"
            });
        }

        const result = await pool.query(
            `
            INSERT INTO rooms
                (building_id, room_number)
            VALUES
                ($1, $2)
            RETURNING
                room_id,
                building_id,
                room_number
            `,
            [building_id, room_number]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating room:", error);

        res.status(500).json({
            error: "Failed to create room",
            details: error.message
        });
    }
};

// UPDATE room
const updateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const { building_id, room_number } = req.body;

        if (
            building_id === undefined ||
            building_id === null ||
            !room_number
        ) {
            return res.status(400).json({
                error: "building_id and room_number are required"
            });
        }

        const result = await pool.query(
            `
            UPDATE rooms
            SET
                building_id = $1,
                room_number = $2
            WHERE room_id = $3
            RETURNING
                room_id,
                building_id,
                room_number
            `,
            [building_id, room_number, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Room not found"
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error updating room:", error);

        res.status(500).json({
            error: "Failed to update room",
            details: error.message
        });
    }
};

// DELETE room
const deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            DELETE FROM rooms
            WHERE room_id = $1
            RETURNING
                room_id,
                building_id,
                room_number
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Room not found"
            });
        }

        res.status(200).json({
            message: "Room deleted successfully",
            room: result.rows[0]
        });
    } catch (error) {
        console.error("Error deleting room:", error);

        res.status(500).json({
            error: "Failed to delete room",
            details: error.message
        });
    }
};

module.exports = {
    getRooms,
    getRoomById,
    createRoom,
    updateRoom,
    deleteRoom
};