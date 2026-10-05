// HIPO 3.2 – Schedule Plotter (legacy schedules)
// Schedule CRUD with conflict checks (conflict.service.js). Chair / master teacher submissions start as pending.
const pool = require("../../config/database");
const { findLegacyScheduleConflict } = require("./conflict.service");

// HTTP responses for each conflict type returned by findLegacyScheduleConflict.
const LEGACY_CONFLICT_RESPONSES = {
    teacher: {
        error: "Teacher conflict",
        message: "The teacher is already assigned to another schedule at this day and time."
    },
    room: {
        error: "Room conflict",
        message: "The room is already assigned to another schedule at this day and time."
    },
    section: {
        error: "Section conflict",
        message: "The section already has another schedule at this day and time."
    }
};

// GET all schedules
const getSchedules = async (req, res) => {
    try {
        // If the logged-in user is a Teacher (role_id 4), return only their schedules
        if (req.session && req.session.user && req.session.user.role_id === 4) {
            const userId = req.session.user.user_id;
            const teacherRes = await pool.query(
                `SELECT teacher_id FROM teachers WHERE user_id = $1 LIMIT 1`,
                [userId]
            );

            if (teacherRes.rows.length === 0) {
                return res.status(200).json([]);
            }

            const teacherId = teacherRes.rows[0].teacher_id;
            const result = await pool.query(
                `SELECT * FROM schedules WHERE teacher_id = $1 ORDER BY schedule_id`,
                [teacherId]
            );

            return res.status(200).json(result.rows);
        }

        const result = await pool.query(`
            SELECT *
            FROM schedules
            ORDER BY schedule_id
        `);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching schedules:", error);

        res.status(500).json({
            error: "Failed to fetch schedules"
        });
    }
};

// GET schedule by ID
const getScheduleById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM schedules WHERE schedule_id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Schedule not found"
            });
        }

        const schedule = result.rows[0];

        // If the logged-in user is a Teacher, ensure they can only view their own schedule
        if (req.session && req.session.user && req.session.user.role_id === 4) {
            const userId = req.session.user.user_id;
            const teacherRes = await pool.query(
                `SELECT teacher_id FROM teachers WHERE user_id = $1 LIMIT 1`,
                [userId]
            );

            if (teacherRes.rows.length === 0) {
                return res.status(403).json({ error: "Access denied." });
            }

            const teacherId = teacherRes.rows[0].teacher_id;
            if (schedule.teacher_id !== teacherId) {
                return res.status(403).json({ error: "Access denied." });
            }
        }

        res.status(200).json(schedule);
    } catch (error) {
        console.error("Error fetching schedule:", error);

        res.status(500).json({
            error: "Failed to fetch schedule"
        });
    }
};

// CREATE schedule
const createSchedule = async (req, res) => {
    try {
        const {
            section_id,
            subject_id,
            teacher_id,
            room_id,
            time_slot_id,
            day_of_week,
            status
        } = req.body;

        // Determine effective status based on creator role
        let effectiveStatus = status;
        const creatorRoleId = req.session && req.session.user && req.session.user.role_id;
        const creatorUserId = req.session && req.session.user && req.session.user.user_id;

        // If Grade Level Chairperson (2) or Master Teacher (3) create schedule, mark as pending
        if (creatorRoleId === 2 || creatorRoleId === 3) {
            effectiveStatus = 'pending';
        }

        // Check for teacher / room / section conflicts on the same day and time slot (conflict.service.js)
        const conflict = await findLegacyScheduleConflict({ section_id, teacher_id, room_id, time_slot_id, day_of_week });

        if (conflict) {
            return res.status(409).json({
                ...LEGACY_CONFLICT_RESPONSES[conflict.resource],
                conflicting_schedule_id: conflict.schedule.schedule_id
            });
        }

        // Create schedule if no conflict exists
        const result = await pool.query(
            `
            INSERT INTO schedules (
                section_id,
                subject_id,
                teacher_id,
                room_id,
                time_slot_id,
                day_of_week,
                status
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                COALESCE($7, 'scheduled')
            )
            RETURNING *
            `,
            [
                section_id,
                subject_id,
                teacher_id,
                room_id,
                time_slot_id,
                day_of_week,
                effectiveStatus
            ]
        );

        const created = result.rows[0];

        // If created as pending, insert an approval record noting the submission
        if (created.status === 'pending') {
            try {
                await pool.query(
                    `INSERT INTO schedule_approvals (schedule_id, action, performed_by) VALUES ($1, $2, $3)`,
                    [created.schedule_id, 'pending', creatorUserId || null]
                );
            } catch (err) {
                console.error('Failed to create approval record for pending schedule:', err);
                // Non-fatal: keep the schedule but inform caller
            }
        }

        res.status(201).json(created);

    } catch (error) {
        console.error("Error creating schedule:", error);

        // Invalid foreign key
        if (error.code === "23503") {
            return res.status(400).json({
                error: "Invalid foreign key",
                message: "One or more referenced IDs do not exist.",
                details: error.detail
            });
        }

        // Missing required field
        if (error.code === "23502") {
            return res.status(400).json({
                error: "Missing required field",
                message: "A required schedule field was not provided.",
                details: error.detail
            });
        }

        // Unexpected error
        return res.status(500).json({
            error: "Failed to create schedule",
            details: error.message
        });
    }
};

// UPDATE schedule
const updateSchedule = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            section_id,
            subject_id,
            teacher_id,
            room_id,
            time_slot_id,
            day_of_week,
            status
        } = req.body;

        // Check for conflicts, excluding the current schedule (conflict.service.js)
        const conflict = await findLegacyScheduleConflict({ section_id, teacher_id, room_id, time_slot_id, day_of_week }, id);

        if (conflict) {
            return res.status(409).json({
                ...LEGACY_CONFLICT_RESPONSES[conflict.resource],
                conflicting_schedule_id: conflict.schedule.schedule_id
            });
        }

        const result = await pool.query(
            `
            UPDATE schedules
            SET
                section_id = $1,
                subject_id = $2,
                teacher_id = $3,
                room_id = $4,
                time_slot_id = $5,
                day_of_week = $6,
                status = $7
            WHERE schedule_id = $8
            RETURNING *
            `,
            [
                section_id,
                subject_id,
                teacher_id,
                room_id,
                time_slot_id,
                day_of_week,
                status,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Schedule not found"
            });
        }

        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error("Error updating schedule:", error);

        if (error.code === "23503") {
            return res.status(400).json({
                error: "Invalid foreign key",
                message: "One or more referenced IDs do not exist.",
                details: error.detail
            });
        }

        if (error.code === "23502") {
            return res.status(400).json({
                error: "Missing required field",
                message: "A required schedule field was not provided.",
                details: error.detail
            });
        }

        return res.status(500).json({
            error: "Failed to update schedule",
            details: error.message
        });
    }
};

// DELETE schedule
const deleteSchedule = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            DELETE FROM schedules
            WHERE schedule_id = $1
            RETURNING *
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Schedule not found"
            });
        }

        res.status(200).json({
            message: "Schedule deleted successfully",
            schedule: result.rows[0]
        });

    } catch (error) {
        console.error("Error creating schedule:", error);

        if (error.code === "23503") {
            return res.status(400).json({
                error: "Invalid foreign key",
                message: "One or more referenced IDs do not exist.",
                details: error.detail
            });
        }

        if (error.code === "23502") {
            return res.status(400).json({
                error: "Missing required field",
                message: "A required schedule field was not provided.",
                details: error.detail
            });
        }

        return res.status(500).json({
            error: "Failed to create schedule",
            details: error.message
        });
    }
};

module.exports = {
    getSchedules,
    getScheduleById,
    createSchedule,
    updateSchedule,
    deleteSchedule
};