// HIPO 3.2 – Schedule Plotter (time slots)
// Routes: /api/time-slots (CRUD). NOTE: no authentication middleware yet (audit P0).
const express = require("express");

const {
    getTimeSlots,
    getTimeSlotById,
    createTimeSlot,
    updateTimeSlot,
    deleteTimeSlot
} = require("./timeSlots.controller");

const router = express.Router();

router.get("/", getTimeSlots);
router.get("/:id", getTimeSlotById);
router.post("/", createTimeSlot);
router.put("/:id", updateTimeSlot);
router.delete("/:id", deleteTimeSlot);

module.exports = router;