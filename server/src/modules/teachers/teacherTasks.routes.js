// HIPO 3.3 – Manage Teacher (teaching-related tasks)
// Routes: /api/teacher-tasks
const express = require("express");

const {
    getTeacherTasks,
    getTeacherTask,
    createTeacherTaskRecord,
    updateTeacherTaskRecord,
    deleteTeacherTaskRecord
} = require("./teacherTasks.controller");

const {
    authenticateUser,
    authorizeRoles
} = require("../../middleware/authMiddleware");

const router = express.Router();

// All teacher-task routes require authentication
router.use(authenticateUser);

// View teacher tasks - all authenticated roles
router.get("/", getTeacherTasks);
router.get("/:id", getTeacherTask);

// Create / Update teacher tasks - Admin + Grade Level Chairperson
router.post(
    "/",
    authorizeRoles(1, 2, 3),
    createTeacherTaskRecord
);

router.put(
    "/:id",
    authorizeRoles(1, 2, 3),
    updateTeacherTaskRecord
);

// Delete teacher task - Admin only
router.delete(
    "/:id",
    authorizeRoles(1),
    deleteTeacherTaskRecord
);

module.exports = router;