const express = require("express");

const {
    getGradeLevels,
    getGradeLevelById,
    createGradeLevel,
    updateGradeLevel,
    deleteGradeLevel
} = require("../controllers/gradeLevelsControllers");

const router = express.Router();

router.get("/", getGradeLevels);
router.get("/:id", getGradeLevelById);
router.post("/", createGradeLevel);
router.put("/:id", updateGradeLevel);
router.delete("/:id", deleteGradeLevel);

module.exports = router;