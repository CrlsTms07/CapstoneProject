const express = require("express");

const {
    getBuildings,
    getBuildingById,
    createBuilding,
    updateBuilding,
    deleteBuilding
} = require("../controllers/buildingsControllers");

const router = express.Router();

router.get("/", getBuildings);
router.get("/:id", getBuildingById);
router.post("/", createBuilding);
router.put("/:id", updateBuilding);
router.delete("/:id", deleteBuilding);

module.exports = router;