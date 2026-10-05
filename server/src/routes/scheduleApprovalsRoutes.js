const express = require("express");

const {
    getApprovals,
    getApproval,
    createApprovalRecord,
    updateApprovalRecord,
    deleteApprovalRecord
} = require("../controllers/scheduleApprovalsControllers");

const {
    authenticateUser,
    authorizeRoles
} = require("../middleware/authMiddleware");

const router = express.Router();

// All Schedule Approval routes require login
router.use(authenticateUser);

// View approvals - all authenticated roles
router.get("/", getApprovals);
router.get("/:id", getApproval);

// Create approvals (submit) - Admin, Grade Level Chairperson, Master Teacher
router.post("/", authorizeRoles(1, 2, 3), createApprovalRecord);

// Update/Delete approvals (approve/reject) - Admin only
router.put("/:id", authorizeRoles(1), updateApprovalRecord);
router.delete("/:id", authorizeRoles(1), deleteApprovalRecord);

module.exports = router;