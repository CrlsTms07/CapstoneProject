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

const { ROLES, authenticate, authorize } = require("../../middleware/authMiddleware");

const router = express.Router();

// All teacher-task routes require authentication
router.use(authenticate);

// View teacher tasks - all authenticated roles
router.get("/", getTeacherTasks);
router.get("/:id", getTeacherTask);

// Create / Update teacher tasks - Admin + Grade Level Chairperson
router.post(
    "/",
    authorize(ROLES.ADMIN, ROLES.CHAIR, ROLES.MASTER_TEACHER),
    createTeacherTaskRecord
);

router.put(
    "/:id",
    authorize(ROLES.ADMIN, ROLES.CHAIR, ROLES.MASTER_TEACHER),
    updateTeacherTaskRecord
);

// Delete teacher task - Admin only
router.delete(
    "/:id",
    authorize(ROLES.ADMIN),
    deleteTeacherTaskRecord
);

module.exports = router;