// HIPO 2.0 – Login
// Routes: POST /api/auth/login, /signup, /change-password, /logout; GET /api/auth/me
const express = require("express");

const {
    login,
    getCurrentUser,
    logout
    , signup,
    changePassword
} = require("./auth.controller");

const { authenticateUserForPasswordChange } = require("../../middleware/authMiddleware");

const router = express.Router();

// POST /api/auth/login
router.post("/login", login);

// POST /api/auth/signup
router.post("/signup", signup);

// POST /api/auth/change-password
router.post('/change-password', authenticateUserForPasswordChange, changePassword);

// GET /api/auth/me
router.get("/me", getCurrentUser);

// POST /api/auth/logout
router.post("/logout", logout);

module.exports = router;