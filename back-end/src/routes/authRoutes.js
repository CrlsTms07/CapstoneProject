const express = require("express");

const {
    login,
    getCurrentUser,
    logout
    , signup
} = require("../controllers/authControllers");

const { forgotPassword, resetPassword } = require("../controllers/authControllers");

const router = express.Router();

// POST /api/auth/login
router.post("/login", login);

// POST /api/auth/signup
router.post("/signup", signup);

// POST /api/auth/forgot
router.post('/forgot', forgotPassword);

// POST /api/auth/reset
router.post('/reset', resetPassword);

// GET /api/auth/me
router.get("/me", getCurrentUser);

// POST /api/auth/logout
router.post("/logout", logout);

module.exports = router;