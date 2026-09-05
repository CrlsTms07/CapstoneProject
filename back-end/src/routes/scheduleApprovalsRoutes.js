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

// Create/Update/Delete approvals - Super Administrator only
router.post("/", authorizeRoles(1), createApprovalRecord);
router.put("/:id", authorizeRoles(1), updateApprovalRecord);
router.delete("/:id", authorizeRoles(1), deleteApprovalRecord);

module.exports = router;