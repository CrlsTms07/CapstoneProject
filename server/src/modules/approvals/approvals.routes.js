// HIPO 5.0 – Approvals (legacy schedules)
// Routes: /api/schedule-approvals (read: signed-in users; create: admin, chair, master teacher; update/delete: admin).
const express = require("express");

const {
    getApprovals,
    getApproval,
    createApprovalRecord,
    updateApprovalRecord,
    deleteApprovalRecord
} = require("./approvals.controller");

const { ROLES, authenticate, authorize } = require("../../middleware/authMiddleware");

const router = express.Router();

// All Schedule Approval routes require login
router.use(authenticate);

// View approvals - all authenticated roles
router.get("/", getApprovals);
router.get("/:id", getApproval);

// Create approvals (submit) - Admin, Grade Level Chairperson, Master Teacher
router.post("/", authorize(ROLES.ADMIN, ROLES.CHAIR, ROLES.MASTER_TEACHER), createApprovalRecord);

// Update/Delete approvals (approve/reject) - Admin only
router.put("/:id", authorize(ROLES.ADMIN), updateApprovalRecord);
router.delete("/:id", authorize(ROLES.ADMIN), deleteApprovalRecord);

module.exports = router;