const {
    getAllApprovals,
    getApprovalById,
    createApproval,
    updateApproval,
    deleteApproval
} = require("../models/scheduleApprovalsModel");
const pool = require("../config/database");

// GET all approvals
const getApprovals = async (req, res) => {
    try {
        const approvals = await getAllApprovals();

        res.status(200).json(approvals);
    } catch (error) {
        console.error("Error fetching approvals:", error);

        res.status(500).json({
            error: "Failed to fetch schedule approvals",
            details: error.message
        });
    }
};

// GET approval by ID
const getApproval = async (req, res) => {
    try {
        const { id } = req.params;

        const approval = await getApprovalById(id);

        if (!approval) {
            return res.status(404).json({
                error: "Schedule approval not found"
            });
        }

        res.status(200).json(approval);
    } catch (error) {
        console.error("Error fetching approval:", error);

        res.status(500).json({
            error: "Failed to fetch schedule approval",
            details: error.message
        });
    }
};

// CREATE approval
const createApprovalRecord = async (req, res) => {
    try {
        const {
            schedule_id,
            action,
            performed_by
        } = req.body;

        const approval = await createApproval(
            schedule_id,
            action,
            performed_by
        );

        res.status(201).json(approval);
    } catch (error) {
        console.error("Error creating approval:", error);

        if (error.code === "23503") {
            return res.status(400).json({
                error: "Invalid foreign key",
                message: "The schedule or user referenced by this approval does not exist.",
                details: error.detail
            });
        }

        if (error.code === "23502") {
            return res.status(400).json({
                error: "Missing required field",
                message: "A required approval field was not provided.",
                details: error.detail
            });
        }

        return res.status(500).json({
            error: "Failed to create schedule approval",
            details: error.message
        });
    }
};

// UPDATE approval
const updateApprovalRecord = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            schedule_id,
            action,
            performed_by
        } = req.body;

        const approval = await updateApproval(
            id,
            schedule_id,
            action,
            performed_by
        );

        if (!approval) {
            return res.status(404).json({
                error: "Schedule approval not found"
            });
        }

        // If this update represents an Admin approval/rejection, update schedule status accordingly
        // Only update schedule status for explicit 'approve'/'approved' or 'reject'/'rejected' actions
        const normalized = (action || '').toString().toLowerCase();
        try {
            if (normalized === 'approve' || normalized === 'approved') {
                await pool.query(`UPDATE schedules SET status = $1 WHERE schedule_id = $2`, ['scheduled', schedule_id]);
            } else if (normalized === 'reject' || normalized === 'rejected') {
                await pool.query(`UPDATE schedules SET status = $1 WHERE schedule_id = $2`, ['rejected', schedule_id]);
            }
        } catch (err) {
            console.error('Failed to update schedule status after approval update:', err);
        }

        res.status(200).json(approval);
    } catch (error) {
        console.error("Error updating approval:", error);

        res.status(500).json({
            error: "Failed to update schedule approval",
            details: error.message
        });
    }
};

// DELETE approval
const deleteApprovalRecord = async (req, res) => {
    try {
        const { id } = req.params;

        const approval = await deleteApproval(id);

        if (!approval) {
            return res.status(404).json({
                error: "Schedule approval not found"
            });
        }

        res.status(200).json({
            message: "Schedule approval deleted successfully",
            approval
        });
    } catch (error) {
        console.error("Error deleting approval:", error);

        res.status(500).json({
            error: "Failed to delete schedule approval",
            details: error.message
        });
    }
};

module.exports = {
    getApprovals,
    getApproval,
    createApprovalRecord,
    updateApprovalRecord,
    deleteApprovalRecord
};