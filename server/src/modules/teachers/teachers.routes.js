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

const {
    authenticateUser,
    authorizeRoles
} = require("../../middleware/authMiddleware");

const router = express.Router();

// All teacher routes require authentication
router.use(authenticateUser);

// View teachers - all authenticated roles
router.get("/", getTeachers);
router.get("/:id", getTeacherById);

// Create / Update teachers - Admin + Grade Level Chairperson
router.post(
    "/",
    authorizeRoles(1, 2, 3),
    createTeacher
);

router.put(
    "/:id",
    authorizeRoles(1, 2, 3),
    updateTeacher
);

// Delete teacher - Admin only
router.delete(
    "/:id",
    authorizeRoles(1),
    deleteTeacher
);

module.exports = router;