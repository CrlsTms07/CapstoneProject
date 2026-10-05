// HIPO 4.2 – Rooms & Buildings
// Routes: /api/rooms (CRUD). NOTE: no authentication middleware yet (audit P0).
const express = require("express");

const {
    getRooms,
    getRoomById,
    createRoom,
    updateRoom,
    deleteRoom
} = require("./rooms.controller");

const router = express.Router();

router.get("/", getRooms);
router.get("/:id", getRoomById);
router.post("/", createRoom);
router.put("/:id", updateRoom);
router.delete("/:id", deleteRoom);

module.exports = router;