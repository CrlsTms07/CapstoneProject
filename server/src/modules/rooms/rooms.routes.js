// HIPO 4.2 – Rooms & Buildings
// Routes: /api/rooms – GET (signed-in users), POST / PUT / DELETE (admin).
const express = require("express");

const {
    getRooms,
    getRoomById,
    createRoom,
    updateRoom,
    deleteRoom
} = require("./rooms.controller");
const { ROLES, authenticate, authorize } = require("../../middleware/authMiddleware");

const router = express.Router();
const canEdit = authorize(ROLES.ADMIN);

router.use(authenticate);

router.get("/", getRooms);
router.get("/:id", getRoomById);
router.post("/", canEdit, createRoom);
router.put("/:id", canEdit, updateRoom);
router.delete("/:id", canEdit, deleteRoom);

module.exports = router;
