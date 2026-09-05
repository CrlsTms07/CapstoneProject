const express = require("express");

const {
    getSchedules,
    getScheduleById,
    createSchedule,
    updateSchedule,
    deleteSchedule
} = require("../controllers/schedulesControllers");

const {
    authenticateUser,
    authorizeRoles
} = require("../middleware/authMiddleware");

const router = express.Router();

// All schedule routes require authentication
router.use(authenticateUser);

// View schedules - all authenticated users
router.get("/", getSchedules);
router.get("/:id", getScheduleById);

// Create schedules - Super Administrator + Grade Level Chairperson
router.post(
    "/",
    authorizeRoles(1, 2),
    createSchedule
);

// Update schedules - Super Administrator + Grade Level Chairperson
router.put(
    "/:id",
    authorizeRoles(1, 2),
    updateSchedule
);

// Delete schedules - Super Administrator only
router.delete(
    "/:id",
    authorizeRoles(1),
    deleteSchedule
);

module.exports = router;