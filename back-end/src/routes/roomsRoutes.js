const express = require("express");

const {
    getRooms,
    getRoomById,
    createRoom,
    updateRoom,
    deleteRoom
} = require("../controllers/roomsControllers");

const router = express.Router();

router.get("/", getRooms);
router.get("/:id", getRoomById);
router.post("/", createRoom);
router.put("/:id", updateRoom);
router.delete("/:id", deleteRoom);

module.exports = router;