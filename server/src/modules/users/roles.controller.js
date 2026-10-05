// HIPO 4.3 – Users & Roles
// Role CRUD and the public role list.
const pool = require("../../config/database");

// GET all roles
const getRoles = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM roles
            ORDER BY role_id
        `);
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching roles:", error);
        res.status(500).json({
            error: "Failed to fetch roles"
        });
    }
};

// GET roles available to unauthenticated login and signup forms
const getPublicRoles = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM roles
            WHERE LOWER(role_name) IN ('grade level chairperson', 'master teacher', 'teacher')
            ORDER BY CASE LOWER(role_name)
                WHEN 'grade level chairperson' THEN 1
                WHEN 'master teacher' THEN 2
                WHEN 'teacher' THEN 3
            END
        `);

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching public roles:", error);
        res.status(500).json({ error: "Failed to fetch public roles" });
    }
};

// GET role by ID
const getRoleById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM roles WHERE role_id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Role not found"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching role:", error);

        res.status(500).json({
            error: "Failed to fetch role"
        });
    }
};

// CREATE role
const createRole = async (req, res) => {
    try {
        const { role_name } = req.body;

        if (!role_name) {
            return res.status(400).json({
                error: "role_name is required"
            });
        }

        const result = await pool.query(
            `
            INSERT INTO roles (role_name)
            VALUES ($1)
            RETURNING *
            `,
            [role_name]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating role:", error);

        res.status(500).json({
            error: "Failed to create role"
        });
    }
};

// UPDATE role
const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role_name } = req.body;

        if (!role_name) {
            return res.status(400).json({
                error: "role_name is required"
            });
        }

        const result = await pool.query(
            `
            UPDATE roles
            SET role_name = $1
            WHERE role_id = $2
            RETURNING *
            `,
            [role_name, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Role not found"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error updating role:", error);

        res.status(500).json({
            error: "Failed to update role"
        });
    }
};

// DELETE role
const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            DELETE FROM roles
            WHERE role_id = $1
            RETURNING *
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Role not found"
            });
        }

        res.json({
            message: "Role deleted successfully",
            role: result.rows[0]
        });
    } catch (error) {
        console.error("Error deleting role:", error);

        res.status(500).json({
            error: "Failed to delete role"
        });
    }
};

module.exports = {
    getRoles,
    getPublicRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole
};