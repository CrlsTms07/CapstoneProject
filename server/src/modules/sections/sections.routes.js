// HIPO 3.4 – Manage Section
// Routes: /api/sections – GET (signed-in users), POST / PUT / DELETE (admin, chair).
const express = require("express");

const {
    getSections,
    getSectionById,
    createSection,
    updateSection,
    deleteSection
} = require("./sections.controller");
const { ROLES, authenticate, authorize } = require("../../middleware/authMiddleware");

const router = express.Router();
const canEdit = authorize(ROLES.ADMIN, ROLES.CHAIR);

router.use(authenticate);

router.get("/", getSections);
router.get("/:id", getSectionById);
router.post("/", canEdit, createSection);
router.put("/:id", canEdit, updateSection);
router.delete("/:id", canEdit, deleteSection);

module.exports = router;
