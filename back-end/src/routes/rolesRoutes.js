const express = require("express");

const {
    getRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole
} = require("../controllers/rolesControllers");

const {
    authenticateUser,
    authorizeRoles
} = require("../middleware/authMiddleware");

const router = express.Router();

// All role routes require authentication
router.use(authenticateUser);

// View roles - all authenticated users
router.get("/", getRoles);
router.get("/:id", getRoleById);

// Create / Update / Delete roles - Admin only
router.post("/", authorizeRoles(1), createRole);

router.put(
    "/:id",
    authorizeRoles(1),
    updateRole
);

router.delete(
    "/:id",
    authorizeRoles(1),
    deleteRole
);

module.exports = router;