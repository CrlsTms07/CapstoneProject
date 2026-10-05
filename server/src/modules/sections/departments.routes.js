// HIPO 3.4 – Manage Section (school structure)
// Routes: /api/departments – GET (signed-in users), POST / PUT / DELETE (admin).
const express = require("express");

const {
    getDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment
} = require("./departments.controller");
const { ROLES, authenticate, authorize } = require("../../middleware/authMiddleware");

const router = express.Router();
const canEdit = authorize(ROLES.ADMIN);

router.use(authenticate);

router.get("/", getDepartments);
router.get("/:id", getDepartmentById);
router.post("/", canEdit, createDepartment);
router.put("/:id", canEdit, updateDepartment);
router.delete("/:id", canEdit, deleteDepartment);

module.exports = router;
