const express = require("express");

const {
    login,
    getCurrentUser,
    logout
} = require("../controllers/authControllers");

const router = express.Router();

// POST /api/auth/login
router.post("/login", login);

// GET /api/auth/me
router.get("/me", getCurrentUser);

// POST /api/auth/logout
router.post("/logout", logout);

module.exports = router;