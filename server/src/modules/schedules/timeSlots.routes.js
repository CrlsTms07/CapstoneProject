// HIPO 3.2 – Schedule Plotter (time slots, legacy)
// Routes: /api/time-slots – GET (signed-in users), POST / PUT / DELETE (admin).
const express = require("express");

const {
    getTimeSlots,
    getTimeSlotById,
    createTimeSlot,
    updateTimeSlot,
    deleteTimeSlot
} = require("./timeSlots.controller");
const { ROLES, authenticate, authorize } = require("../../middleware/authMiddleware");

const router = express.Router();
const canEdit = authorize(ROLES.ADMIN);

router.use(authenticate);

router.get("/", getTimeSlots);
router.get("/:id", getTimeSlotById);
router.post("/", canEdit, createTimeSlot);
router.put("/:id", canEdit, updateTimeSlot);
router.delete("/:id", canEdit, deleteTimeSlot);

module.exports = router;
