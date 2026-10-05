// HIPO 3.4 – Manage Section (school structure)
// Department CRUD (e.g. JHS / SHS departments).
const pool = require("../../config/database");

// GET all departments
const getDepartments = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT department_id, department_name FROM departments ORDER BY department_id"
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ error: "Failed to fetch departments" });
  }
};

// GET department by ID
const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT department_id, department_name FROM departments WHERE department_id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Department not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching department:", error);
    res.status(500).json({ error: "Failed to fetch department" });
  }
};

// CREATE department
const createDepartment = async (req, res) => {
  try {
    const { department_name } = req.body;

    if (!department_name) {
      return res.status(400).json({
        error: "department_name is required"
      });
    }

    const result = await pool.query(
      "INSERT INTO departments (department_name) VALUES ($1) RETURNING department_id, department_name",
      [department_name]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating department:", error);
    res.status(500).json({ error: "Failed to create department" });
  }
};

// UPDATE department
const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { department_name } = req.body;

    if (!department_name) {
      return res.status(400).json({
        error: "department_name is required"
      });
    }

    const result = await pool.query(
      "UPDATE departments SET department_name = $1 WHERE department_id = $2 RETURNING department_id, department_name",
      [department_name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Department not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error updating department:", error);
    res.status(500).json({ error: "Failed to update department" });
  }
};

// DELETE department
const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM departments WHERE department_id = $1 RETURNING department_id, department_name",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Department not found" });
    }

    res.status(200).json({
      message: "Department deleted successfully",
      department: result.rows[0]
    });
  } catch (error) {
    console.error("Error deleting department:", error);
    res.status(500).json({ error: "Failed to delete department" });
  }
};

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment
};