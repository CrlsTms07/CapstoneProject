// HIPO 4.1 – Subjects
// Routes: /api/subjects (CRUD). NOTE: no authentication middleware yet (audit P0).
const express = require("express");

const {
    getSubjects,
    getSubjectById,
    createSubject,
    updateSubject,
    deleteSubject
} = require("./subjects.controller");

const router = express.Router();

router.get("/", getSubjects);
router.get("/:id", getSubjectById);
router.post("/", createSubject);
router.put("/:id", updateSubject);
router.delete("/:id", deleteSubject);

module.exports = router;