// HIPO 4.1 – Subjects
// Routes: /api/subjects – GET (signed-in users), POST / PUT / DELETE (admin, master teacher).
const express = require("express");

const {
    getSubjects,
    getSubjectById,
    createSubject,
    updateSubject,
    deleteSubject
} = require("./subjects.controller");
const { ROLES, authenticate, authorize } = require("../../middleware/authMiddleware");

const router = express.Router();
const canEdit = authorize(ROLES.ADMIN, ROLES.MASTER_TEACHER);

router.use(authenticate);

router.get("/", getSubjects);
router.get("/:id", getSubjectById);
router.post("/", canEdit, createSubject);
router.put("/:id", canEdit, updateSubject);
router.delete("/:id", canEdit, deleteSubject);

module.exports = router;
