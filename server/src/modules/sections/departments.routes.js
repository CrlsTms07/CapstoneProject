// HIPO 3.4 – Manage Section (school structure)
// Routes: /api/departments (CRUD). NOTE: no authentication middleware yet (audit P0).
const express = require("express");

const {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require("./departments.controller");

const router = express.Router();

// GET all departments
router.get("/", getDepartments);

// GET department by ID
router.get("/:id", getDepartmentById);

// CREATE department
router.post("/", createDepartment);

// UPDATE department
router.put("/:id", updateDepartment);

// DELETE department
router.delete("/:id", deleteDepartment);

module.exports = router;