// HIPO 3.4 – Manage Section (school structure)
// Routes: /api/grade-levels – GET (signed-in users), POST / PUT / DELETE (admin).
const express = require("express");

const {
    getGradeLevels,
    getGradeLevelById,
    createGradeLevel,
    updateGradeLevel,
    deleteGradeLevel
} = require("./gradeLevels.controller");
const { ROLES, authenticate, authorize } = require("../../middleware/authMiddleware");

const router = express.Router();
const canEdit = authorize(ROLES.ADMIN);

router.use(authenticate);

router.get("/", getGradeLevels);
router.get("/:id", getGradeLevelById);
router.post("/", canEdit, createGradeLevel);
router.put("/:id", canEdit, updateGradeLevel);
router.delete("/:id", canEdit, deleteGradeLevel);

module.exports = router;
