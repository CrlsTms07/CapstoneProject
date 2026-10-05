const bcrypt = require("bcrypt");
const crypto = require("crypto");
const pool = require("../config/database");
const { sendMail } = require("../config/mailer");

const ALLOWED_REASONS = ["Forgotten Password", "Account Locked / Suspicious Activity", "Other"];
const ADMIN_URL = process.env.ADMIN_DASHBOARD_URL || `${process.env.FRONTEND_URL || "http://localhost:5173"}/admin`;

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

const submitRequest = async (req, res) => {
    try {
        const identifier = String(req.body.employee_identifier || "").trim();
        const reason = String(req.body.reason || "").trim();
        const contactNumber = String(req.body.contact_number || "").trim();
        if (!identifier || !reason || !contactNumber) {
            return res.status(400).json({ error: "Employee ID or official email, reason, and contact number are required." });
        }
        if (!ALLOWED_REASONS.includes(reason)) return res.status(400).json({ error: "Choose a valid reason for the request." });
        if (contactNumber.length > 40) return res.status(400).json({ error: "Contact number is too long." });

        const userResult = await pool.query(
            `SELECT u.user_id, u.full_name, u.school_id, u.email, u.username,
                    u.department_id, d.department_name
             FROM users u
             LEFT JOIN departments d ON d.department_id = u.department_id
             WHERE LOWER(COALESCE(u.email, '')) = LOWER($1)
                OR LOWER(COALESCE(u.username, '')) = LOWER($1)
                OR LOWER(COALESCE(u.school_id, '')) = LOWER($1)
             LIMIT 1`,
            [identifier]
        );
        const user = userResult.rows[0];
        if (!user || !user.email) return res.status(404).json({ error: "No account with that Employee ID or official email was found." });

        const requestResult = await pool.query(
            `INSERT INTO password_reset_requests (user_id, employee_id, email, reason, contact_number)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING request_id, requested_at`,
            [user.user_id, user.school_id || identifier, user.email, reason, contactNumber]
        );
        const resetRequest = requestResult.rows[0];
        const requestedAt = new Date(resetRequest.requested_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
        const name = user.full_name || user.username || user.email;
        const adminEmail = process.env.SYSTEM_ADMIN_EMAIL;
        const adminText = [
            "A faculty/staff account recovery request requires review.",
            `Employee Name: ${name}`,
            `Employee ID: ${user.school_id || "Not provided"}`,
            `Email: ${user.email}`,
            `Department: ${user.department_name || "Not assigned"}`,
            `Contact Number: ${contactNumber}`,
            `Date/Time Requested: ${requestedAt}`,
            `Reason: ${reason}`,
            `Review request: ${ADMIN_URL}`
        ].join("\n");

        const mailResults = await Promise.allSettled([
            adminEmail ? sendMail({
                to: adminEmail,
                subject: `[ACTION REQUIRED] Password Reset Request - ${name} (${user.school_id || "No ID"})`,
                text: adminText,
                html: `<h2>Account recovery request</h2><p><b>Employee Name:</b> ${escapeHtml(name)}</p><p><b>Employee ID:</b> ${escapeHtml(user.school_id || "Not provided")}</p><p><b>Email:</b> ${escapeHtml(user.email)}</p><p><b>Department:</b> ${escapeHtml(user.department_name || "Not assigned")}</p><p><b>Contact Number:</b> ${escapeHtml(contactNumber)}</p><p><b>Date/Time Requested:</b> ${escapeHtml(requestedAt)}</p><p><b>Reason:</b> ${escapeHtml(reason)}</p><p><a href="${escapeHtml(ADMIN_URL)}">Review in Admin Dashboard</a></p>`
            }) : Promise.reject(new Error("SYSTEM_ADMIN_EMAIL is not configured.")),
            sendMail({
                to: user.email,
                subject: "Password Reset Request Acknowledgment",
                text: `Dear ${name},\n\nYour account recovery request has been received and is pending System Administrator verification. You will receive another email when its status is updated.\n\nThis is an automated message.`,
                html: `<p>Dear ${escapeHtml(name)},</p><p>Your account recovery request has been received and is pending System Administrator verification. You will receive another email when its status is updated.</p><p>This is an automated message.</p>`
            })
        ]);
        const emailDelivery = mailResults.every(result => result.status === "fulfilled");
        if (!emailDelivery) console.error("Recovery request notification failure:", mailResults.filter(result => result.status === "rejected").map(result => result.reason.message));

        return res.status(201).json({
            message: emailDelivery
                ? "Your request was submitted. Check your email for an acknowledgment."
                : "Your request was recorded, but email notification could not be delivered. Contact the System Administrator directly.",
            request_id: resetRequest.request_id,
            email_delivery: emailDelivery
        });
    } catch (error) {
        console.error("Account recovery request error:", error);
        return res.status(500).json({ error: "Failed to submit account recovery request." });
    }
};

const getRequests = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT pr.request_id, pr.user_id, pr.employee_id, pr.email, pr.reason,
                    pr.contact_number, pr.requested_at, pr.status,
                    u.full_name, u.department_id, d.department_name
             FROM password_reset_requests pr
             JOIN users u ON u.user_id = pr.user_id
             LEFT JOIN departments d ON d.department_id = u.department_id
             WHERE pr.status = 'PENDING'
             ORDER BY pr.requested_at ASC`
        );
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error("Fetch account recovery requests error:", error);
        return res.status(500).json({ error: "Failed to fetch account recovery requests." });
    }
};

const decideRequest = async (req, res) => {
    const decision = String(req.params.decision || "").toUpperCase();
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || !["APPROVE", "REJECT"].includes(decision)) {
        return res.status(400).json({ error: "Invalid request or decision." });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await client.query(
            `SELECT pr.request_id, pr.user_id, pr.employee_id, pr.email, pr.status,
                    u.full_name
             FROM password_reset_requests pr
             JOIN users u ON u.user_id = pr.user_id
             WHERE pr.request_id = $1
             FOR UPDATE OF pr, u`,
            [requestId]
        );
        const request = result.rows[0];
        if (!request) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Recovery request not found." });
        }
        if (request.status !== "PENDING") {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "This recovery request has already been reviewed." });
        }

        if (decision === "REJECT") {
            await client.query(
                `UPDATE password_reset_requests SET status = 'REJECTED', reviewed_by = $1, reviewed_at = NOW() WHERE request_id = $2`,
                [req.session.user.user_id, requestId]
            );
            await client.query("COMMIT");
            try {
                await sendMail({
                    to: request.email,
                    subject: "Account Recovery Request Status",
                    text: "Your account recovery request was reviewed and could not be approved. Please contact the System Administrator for assistance.",
                    html: "<p>Your account recovery request was reviewed and could not be approved.</p><p>Please contact the System Administrator for assistance.</p>"
                });
            } catch (mailError) {
                console.error("Recovery rejection email error:", mailError.message);
            }
            return res.status(200).json({ message: "Request rejected." });
        }

        const temporaryPassword = crypto.randomBytes(18).toString("base64url");
        const passwordHash = await bcrypt.hash(temporaryPassword, 12);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await sendMail({
            to: request.email,
            subject: "Temporary Password for Your Faculty Account",
            text: `Your account recovery request was approved. Temporary password: ${temporaryPassword}\n\nIt expires in 24 hours. Sign in with this password and change it immediately.`,
            html: `<p>Your account recovery request was approved.</p><p><b>Temporary password:</b> ${escapeHtml(temporaryPassword)}</p><p>It expires in 24 hours. Sign in with this password and change it immediately.</p>`
        });
        await client.query(
            `UPDATE users SET password_hash = $1, must_change_password = TRUE, temporary_password_expires_at = $2 WHERE user_id = $3`,
            [passwordHash, expiresAt, request.user_id]
        );
        await client.query(
            `UPDATE password_reset_requests SET status = 'APPROVED', reviewed_by = $1, reviewed_at = NOW() WHERE request_id = $2`,
            [req.session.user.user_id, requestId]
        );
        await client.query("COMMIT");
        return res.status(200).json({ message: "Request approved and temporary credentials emailed; they expire in 24 hours." });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("Review account recovery request error:", error);
        return res.status(500).json({ error: "Failed to review request. Verify email service configuration and try again." });
    } finally {
        client.release();
    }
};

module.exports = { submitRequest, getRequests, decideRequest };