// HIPO 3.2 – Schedule Plotter (legacy schedules; also HIPO 8.0: teachers only see their own)
// Routes: /api/schedules (read: signed-in users; create/update: admin, chair, master teacher; delete: admin).
const express = require("express");

const {
    getSchedules,
    getScheduleById,
    createSchedule,
    updateSchedule,
    deleteSchedule
} = require("./schedules.controller");

const {
    authenticateUser,
    authorizeRoles
} = require("../../middleware/authMiddleware");

const router = express.Router();

// All schedule routes require authentication
router.use(authenticateUser);

// View schedules - all authenticated users
router.get("/", getSchedules);
router.get("/:id", getScheduleById);

// Create schedules - Super Administrator + Grade Level Chairperson
router.post(
    "/",
    authorizeRoles(1, 2, 3),
    createSchedule
);

// Update schedules - Super Administrator + Grade Level Chairperson
router.put(
    "/:id",
    authorizeRoles(1, 2, 3),
    updateSchedule
);

// Delete schedules - Super Administrator only
router.delete(
    "/:id",
    authorizeRoles(1),
    deleteSchedule
);

module.exports = router;