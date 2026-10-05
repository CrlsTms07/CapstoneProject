// HIPO 3.3 – Manage Teacher
// Routes: /api/teachers (read: signed-in users; create/update: admin, chair, master teacher; delete: admin).
const express = require("express");

const {
    getTeachers,
    getTeacherById,
    createTeacher,
    updateTeacher,
    deleteTeacher
} = require("./teachers.controller");

const { ROLES, authenticate, authorize } = require("../../middleware/authMiddleware");

const router = express.Router();

// All teacher routes require authentication
router.use(authenticate);

// View teachers - all authenticated roles
router.get("/", getTeachers);
router.get("/:id", getTeacherById);

// Create / Update teachers - Admin + Grade Level Chairperson
router.post(
    "/",
    authorize(ROLES.ADMIN, ROLES.CHAIR, ROLES.MASTER_TEACHER),
    createTeacher
);

router.put(
    "/:id",
    authorize(ROLES.ADMIN, ROLES.CHAIR, ROLES.MASTER_TEACHER),
    updateTeacher
);

// Delete teacher - Admin only
router.delete(
    "/:id",
    authorize(ROLES.ADMIN),
    deleteTeacher
);

module.exports = router;