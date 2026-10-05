// HIPO 4.3 – Users & Roles
// User account CRUD and approval of pending accounts.
const pool = require("../../config/database");
const { sendError } = require("../../utils/httpError");
const { resolveUserGradeScope } = require("./users.service");

// GET all users
const getUsers = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.user_id, u.username, u.role_id, u.department_id,
                   u.assigned_grade_level_id, gl.grade_level_name AS assigned_grade_level_name, u.is_approved
            FROM users u
            LEFT JOIN grade_levels gl ON gl.grade_level_id = u.assigned_grade_level_id
            ORDER BY user_id
        `);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching users:", error);

        res.status(500).json({
            error: "Failed to fetch users"
        });
    }
};

// GET user by ID
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT u.user_id, u.username, u.role_id, u.department_id,
                    u.assigned_grade_level_id, gl.grade_level_name AS assigned_grade_level_name, u.is_approved
             FROM users u LEFT JOIN grade_levels gl ON gl.grade_level_id = u.assigned_grade_level_id
             WHERE u.user_id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching user:", error);

        res.status(500).json({
            error: "Failed to fetch user"
        });
    }
};

// CREATE user
const createUser = async (req, res) => {
    try {
        const {
            username,
            role_id,
            department_id,
            assigned_grade_level_id
        } = req.body;
        const scope = await resolveUserGradeScope(role_id, assigned_grade_level_id, department_id);
        if (scope.error) return res.status(400).json({ error: scope.error });

        const result = await pool.query(
            `INSERT INTO users 
                (username, role_id, department_id, assigned_grade_level_id, is_approved)
             VALUES ($1, $2, $3, $4, TRUE)
             RETURNING user_id, username, role_id, department_id, assigned_grade_level_id, is_approved`,
            [username, role_id, scope.departmentId, scope.assignedGradeLevelId]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating user:", error);

        res.status(500).json({
            error: "Failed to create user"
        });
    }
};

// UPDATE user
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            username,
            role_id,
            department_id,
            assigned_grade_level_id
        } = req.body;
        const scope = await resolveUserGradeScope(role_id, assigned_grade_level_id, department_id);
        if (scope.error) return res.status(400).json({ error: scope.error });

        const result = await pool.query(
            `UPDATE users
             SET username = $1,
                 role_id = $2,
                 department_id = $3,
                 assigned_grade_level_id = $4
             WHERE user_id = $5
             RETURNING user_id, username, role_id, department_id, assigned_grade_level_id`,
            [username, role_id, scope.departmentId, scope.assignedGradeLevelId, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error updating user:", error);

        res.status(500).json({
            error: "Failed to update user"
        });
    }
};

// DELETE user
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM users
             WHERE user_id = $1
             RETURNING user_id, username, role_id, department_id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        res.status(200).json({
            message: "User deleted successfully",
            user: result.rows[0]
        });
    } catch (error) {
        // Still used by schedule entries or approval history (ON DELETE RESTRICT) -> 409 with a readable message.
        sendError(res, error, { action: "delete" });
    }
};

// export moved to bottom after function declarations

// GET pending users (not approved yet) - Admin only
const getPendingUsers = async (req, res) => {
    try {
        const result = await pool.query(`
                 SELECT u.user_id, u.username, u.role_id, u.department_id,
                     u.assigned_grade_level_id, gl.grade_level_name AS assigned_grade_level_name, u.is_approved
                 FROM users u LEFT JOIN grade_levels gl ON gl.grade_level_id = u.assigned_grade_level_id
                 WHERE u.is_approved = FALSE
                 ORDER BY u.user_id
        `);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching pending users:', error);
        res.status(500).json({ error: 'Failed to fetch pending users' });
    }
};

// Approve user - Admin only
const approveUser = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `UPDATE users SET is_approved = TRUE WHERE user_id = $1 RETURNING user_id, username, role_id, department_id, assigned_grade_level_id, is_approved`,
            [id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        res.status(200).json({ message: 'User approved', user: result.rows[0] });
    } catch (error) {
        console.error('Error approving user:', error);
        res.status(500).json({ error: 'Failed to approve user' });
    }
};

module.exports = {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    getPendingUsers,
    approveUser
};