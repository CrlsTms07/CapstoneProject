// HIPO 4.3 – Users & Roles (admin only)
// Routes: /api/users (CRUD), GET /api/users/pending, POST /api/users/:id/approve
const express = require("express");

const router = express.Router();

const {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
} = require("./users.controller");
const { getPendingUsers, approveUser } = require("./users.controller");

const {
    authenticateUser,
    authorizeRoles
} = require("../../middleware/authMiddleware");

// All user-management routes require authentication
router.use(authenticateUser);

// Admin only
router.get(
    "/",
    authorizeRoles(1),
    getUsers
);

// Pending users
router.get('/pending', authorizeRoles(1), getPendingUsers);

router.get(
    "/:id",
    authorizeRoles(1),
    getUserById
);

router.post(
    "/",
    authorizeRoles(1),
    createUser
);

router.put(
    "/:id",
    authorizeRoles(1),
    updateUser
);

router.delete(
    "/:id",
    authorizeRoles(1),
    deleteUser
);

// Approve a pending user
router.post('/:id/approve', authorizeRoles(1), approveUser);

module.exports = router;