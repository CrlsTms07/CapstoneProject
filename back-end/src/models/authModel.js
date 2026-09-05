const pool = require("../config/database");

// Find user by username
const findUserByUsername = async (username) => {
    const result = await pool.query(
        `
        SELECT
            u.user_id,
            u.username,
            u.password_hash,
            u.role_id,
            r.role_name,
            u.department_id
        FROM users u
        LEFT JOIN roles r
            ON u.role_id = r.role_id
        WHERE u.username = $1
        LIMIT 1
        `,
        [username]
    );

    return result.rows[0];
};

module.exports = {
    findUserByUsername
};