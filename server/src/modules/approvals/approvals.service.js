// HIPO 5.0 – Approvals (legacy schedules)
// Data access for the schedule_approvals table.
const pool = require("../../config/database");

// GET all approval records
const getAllApprovals = async () => {
    const result = await pool.query(`
        SELECT *
        FROM schedule_approvals
        ORDER BY approval_id
    `);

    return result.rows;
};

// GET approval by ID
const getApprovalById = async (id) => {
    const result = await pool.query(
        `
        SELECT *
        FROM schedule_approvals
        WHERE approval_id = $1
        `,
        [id]
    );

    return result.rows[0];
};

// CREATE approval
const createApproval = async (schedule_id, action, performed_by) => {
    const result = await pool.query(
        `
        INSERT INTO schedule_approvals (
            schedule_id,
            action,
            performed_by
        )
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [schedule_id, action, performed_by]
    );

    return result.rows[0];
};

// UPDATE approval
const updateApproval = async (id, schedule_id, action, performed_by) => {
    const result = await pool.query(
        `
        UPDATE schedule_approvals
        SET
            schedule_id = $1,
            action = $2,
            performed_by = $3
        WHERE approval_id = $4
        RETURNING *
        `,
        [schedule_id, action, performed_by, id]
    );

    return result.rows[0];
};

// DELETE approval
const deleteApproval = async (id) => {
    const result = await pool.query(
        `
        DELETE FROM schedule_approvals
        WHERE approval_id = $1
        RETURNING *
        `,
        [id]
    );

    return result.rows[0];
};

module.exports = {
    getAllApprovals,
    getApprovalById,
    createApproval,
    updateApproval,
    deleteApproval
};