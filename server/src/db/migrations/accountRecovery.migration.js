// HIPO 2.0 – Login (database layer)
// Startup migration for account recovery: approval / forced-password-change columns on users
// and the password_reset_requests table.
const pool = require("../../config/database");

const ensureAccountRecoverySchema = async () => {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE`);
    await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMPTZ;
        CREATE TABLE IF NOT EXISTS password_reset_requests (
            request_id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            employee_id VARCHAR(50) NOT NULL,
            email VARCHAR(150) NOT NULL,
            reason VARCHAR(100) NOT NULL,
            contact_number VARCHAR(40) NOT NULL,
            requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
            reviewed_by INT REFERENCES users(user_id) ON DELETE SET NULL,
            reviewed_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS password_reset_requests_pending_idx
            ON password_reset_requests(status, requested_at);
    `);
    console.log("Ensured account recovery schema exists");
};

module.exports = { ensureAccountRecoverySchema };
