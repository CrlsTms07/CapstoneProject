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

const { ROLES, authenticate, authorize } = require("../../middleware/authMiddleware");

// All user-management routes require authentication
router.use(authenticate);

// Admin only
router.get(
    "/",
    authorize(ROLES.ADMIN),
    getUsers
);

// Pending users
router.get('/pending', authorize(ROLES.ADMIN), getPendingUsers);

router.get(
    "/:id",
    authorize(ROLES.ADMIN),
    getUserById
);

router.post(
    "/",
    authorize(ROLES.ADMIN),
    createUser
);

router.put(
    "/:id",
    authorize(ROLES.ADMIN),
    updateUser
);

router.delete(
    "/:id",
    authorize(ROLES.ADMIN),
    deleteUser
);

// Approve a pending user
router.post('/:id/approve', authorize(ROLES.ADMIN), approveUser);

module.exports = router;