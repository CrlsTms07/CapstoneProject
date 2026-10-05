const express = require("express");

const {
    getTimeSlots,
    getTimeSlotById,
    createTimeSlot,
    updateTimeSlot,
    deleteTimeSlot
} = require("../controllers/timeSlotsControllers");

const router = express.Router();

router.get("/", getTimeSlots);
router.get("/:id", getTimeSlotById);
router.post("/", createTimeSlot);
router.put("/:id", updateTimeSlot);
router.delete("/:id", deleteTimeSlot);

module.exports = router;