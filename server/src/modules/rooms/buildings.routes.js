// HIPO 4.2 – Rooms & Buildings
// Routes: /api/buildings (CRUD). NOTE: no authentication middleware yet (audit P0).
const express = require("express");

const {
    getBuildings,
    getBuildingById,
    createBuilding,
    updateBuilding,
    deleteBuilding
} = require("./buildings.controller");

const router = express.Router();

router.get("/", getBuildings);
router.get("/:id", getBuildingById);
router.post("/", createBuilding);
router.put("/:id", updateBuilding);
router.delete("/:id", deleteBuilding);

module.exports = router;