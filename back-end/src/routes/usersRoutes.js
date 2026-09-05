const express = require("express");

const router = express.Router();

const {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
} = require("../controllers/usersControllers");

const {
    authenticateUser,
    authorizeRoles
} = require("../middleware/authMiddleware");

// All user-management routes require authentication
router.use(authenticateUser);

// Admin only
router.get(
    "/",
    authorizeRoles(1),
    getUsers
);

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

module.exports = router;