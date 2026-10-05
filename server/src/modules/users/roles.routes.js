// HIPO 4.3 – Users & Roles
// Routes: /api/roles (read: any signed-in user; write: admin).
const express = require("express");

const {
    getRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole
} = require("./roles.controller");

const { ROLES, authenticate, authorize } = require("../../middleware/authMiddleware");

const router = express.Router();

// All role routes require authentication
router.use(authenticate);

// View roles - all authenticated users
router.get("/", getRoles);
router.get("/:id", getRoleById);

// Create / Update / Delete roles - Admin only
router.post("/", authorize(ROLES.ADMIN), createRole);

router.put(
    "/:id",
    authorize(ROLES.ADMIN),
    updateRole
);

router.delete(
    "/:id",
    authorize(ROLES.ADMIN),
    deleteRole
);

module.exports = router;