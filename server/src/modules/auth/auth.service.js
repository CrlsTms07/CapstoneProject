// HIPO 2.0 – Login
// Data access: user lookup by school email or username.
const pool = require("../../config/database");

// Find a user by school email, with username fallback for existing admin accounts.
const findUserByEmail = async (email) => {
    const result = await pool.query(
        `
        SELECT
            u.user_id,
            u.username,
            u.full_name,
            u.email,
            u.school_id,
            u.password_hash,
            u.role_id,
            r.role_name,
            u.department_id,
            u.assigned_grade_level_id,
            u.is_approved,
            u.must_change_password,
            u.temporary_password_expires_at
        FROM users u
        LEFT JOIN roles r
            ON u.role_id = r.role_id
        WHERE u.email = $1 OR u.username = $1
        LIMIT 1
        `,
        [email]
    );

    return result.rows[0];
};

module.exports = {
    findUserByEmail,
    findUserByUsername: findUserByEmail
};