// HIPO 4.2 – Rooms & Buildings
// Routes: /api/buildings – GET (signed-in users), POST / PUT / DELETE (admin).
const express = require("express");

const {
    getBuildings,
    getBuildingById,
    createBuilding,
    updateBuilding,
    deleteBuilding
} = require("./buildings.controller");
const { ROLES, authenticate, authorize } = require("../../middleware/authMiddleware");

const router = express.Router();
const canEdit = authorize(ROLES.ADMIN);

router.use(authenticate);

router.get("/", getBuildings);
router.get("/:id", getBuildingById);
router.post("/", canEdit, createBuilding);
router.put("/:id", canEdit, updateBuilding);
router.delete("/:id", canEdit, deleteBuilding);

module.exports = router;
