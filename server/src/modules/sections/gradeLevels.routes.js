// HIPO 3.4 – Manage Section (school structure)
// Routes: /api/grade-levels (CRUD). NOTE: no authentication middleware yet (audit P0).
const express = require("express");

const {
    getGradeLevels,
    getGradeLevelById,
    createGradeLevel,
    updateGradeLevel,
    deleteGradeLevel
} = require("./gradeLevels.controller");

const router = express.Router();

router.get("/", getGradeLevels);
router.get("/:id", getGradeLevelById);
router.post("/", createGradeLevel);
router.put("/:id", updateGradeLevel);
router.delete("/:id", deleteGradeLevel);

module.exports = router;