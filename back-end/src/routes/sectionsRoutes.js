const express = require("express");

const {
    getSections,
    getSectionById,
    createSection,
    updateSection,
    deleteSection
} = require("../controllers/sectionsControllers");

const router = express.Router();

router.get("/", getSections);
router.get("/:id", getSectionById);
router.post("/", createSection);
router.put("/:id", updateSection);
router.delete("/:id", deleteSection);

module.exports = router;