// HIPO 3.4 – Manage Section
// Routes: /api/sections (CRUD). NOTE: no authentication middleware yet (audit P0).
const express = require("express");

const {
    getSections,
    getSectionById,
    createSection,
    updateSection,
    deleteSection
} = require("./sections.controller");

const router = express.Router();

router.get("/", getSections);
router.get("/:id", getSectionById);
router.post("/", createSection);
router.put("/:id", updateSection);
router.delete("/:id", deleteSection);

module.exports = router;