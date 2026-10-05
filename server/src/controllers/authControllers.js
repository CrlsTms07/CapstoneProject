const bcrypt = require("bcrypt");
const { findUserByUsername } = require("../models/authModel");
const pool = require("../config/database");

// LOGIN
const login = async (req, res) => {
    try {
        const { username, password, remember } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({
                error: "Username and password are required."
            });
        }

        // Find user by the school email supplied by the login form.
        const user = await findUserByUsername(username.trim().toLowerCase());

        // Generic authentication error
        if (!user || !user.password_hash) {
            return res.status(401).json({
                error: "Invalid username or password."
            });
        }

        // Check approval
        if (user.is_approved === false) {
            return res.status(403).json({ error: 'Account pending admin approval.' });
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                error: "Invalid username or password."
            });
        }

        if (user.must_change_password && user.temporary_password_expires_at && new Date(user.temporary_password_expires_at) <= new Date()) {
            return res.status(403).json({ error: "Your temporary password has expired. Submit a new account recovery request." });
        }

        // Regenerate session ID after successful authentication
        await new Promise((resolve, reject) => {
            req.session.regenerate((error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        req.session.cookie.maxAge = remember ? 1000 * 60 * 60 * 24 * 30 : null;

        // Store authenticated user in session
        req.session.user = {
            user_id: user.user_id,
            username: user.username,
            full_name: user.full_name,
            role_id: user.role_id,
            role_name: user.role_name,
            department_id: user.department_id,
            assigned_grade_level_id: user.assigned_grade_level_id,
            must_change_password: Boolean(user.must_change_password),
            temporary_password_expires_at: user.temporary_password_expires_at
        };

        // Explicitly save session before sending response
        await new Promise((resolve, reject) => {
            req.session.save((error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        console.log("Login successful for:", user.username);
        console.log("Session ID created:", req.sessionID);

        return res.status(200).json({
            message: "Login successful",
            user: req.session.user
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            error: "Login failed",
            details: error.message
        });
    }
};

// GET CURRENT LOGGED-IN USER
const getCurrentUser = async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            error: "Not authenticated."
        });
    }

    try {
        const result = await pool.query(
            "SELECT department_id, assigned_grade_level_id FROM users WHERE user_id = $1",
            [req.session.user.user_id]
        );
        if (result.rows[0]) {
            req.session.user.department_id = result.rows[0].department_id;
            req.session.user.assigned_grade_level_id = result.rows[0].assigned_grade_level_id;
        }
    } catch (error) {
        console.error("Unable to refresh user grade assignment:", error.message);
    }

    res.status(200).json({
        authenticated: true,
        user: req.session.user
    });
};

// LOGOUT
const logout = (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error("Logout error:", error);

            return res.status(500).json({
                error: "Logout failed"
            });
        }

        res.clearCookie("connect.sid", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax"
        });

        res.status(200).json({
            message: "Logout successful"
        });
    });
};


// SIGNUP (public)
const signup = async (req, res) => {
    try {
        const { full_name, email, school_id, password, confirm_password, role_id, department_id } = req.body;

        if (!full_name || !email || !school_id || !password || !confirm_password || !role_id) {
            return res.status(400).json({ error: "Full name, school email, ID number, role, password and password confirmation are required." });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedSchoolId = school_id.trim();
        const passwordIsStrong = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);

        if (!passwordIsStrong) {
            return res.status(400).json({ error: "Password must be at least 8 characters and include an uppercase letter, number and special character." });
        }

        if (password !== confirm_password) {
            return res.status(400).json({ error: "Passwords do not match." });
        }

        const roleRes = await pool.query(
            `SELECT role_id, role_name
             FROM roles
             WHERE role_id = $1
               AND LOWER(role_name) IN ('grade level chairperson', 'master teacher', 'teacher')
             LIMIT 1`,
            [role_id]
        );
        if (roleRes.rows.length === 0) {
            return res.status(400).json({ error: "Invalid signup role." });
        }
        const selectedRole = roleRes.rows[0];

        const existing = await pool.query(
            'SELECT user_id FROM users WHERE LOWER(email) = $1 OR school_id = $2 LIMIT 1',
            [normalizedEmail, normalizedSchoolId]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: "The school email or ID number is already registered." });
        }

        // Hash password
        const hash = await bcrypt.hash(password, 10);

        // Auto-approve non-admin roles so users can access their dashboards immediately
        const isApproved = true;

        // Insert user (include password_hash)
        const insertRes = await pool.query(
            `INSERT INTO users (username, full_name, email, school_id, role_id, department_id, password_hash, is_approved)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING user_id, username, full_name, email, school_id, role_id, department_id, assigned_grade_level_id, is_approved`,
            [normalizedEmail, full_name.trim(), normalizedEmail, normalizedSchoolId, role_id, department_id || null, hash, isApproved]
        );

        const user = insertRes.rows[0];

        // If approved, create session and login user immediately
        if (user.is_approved) {
            await new Promise((resolve, reject) => {
                req.session.regenerate((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            req.session.user = {
                user_id: user.user_id,
                username: user.username,
                full_name: user.full_name,
                role_id: user.role_id,
                role_name: selectedRole.role_name,
                department_id: user.department_id,
                assigned_grade_level_id: user.assigned_grade_level_id
            };

            await new Promise((resolve, reject) => {
                req.session.save((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            return res.status(201).json({ message: 'User created', user: req.session.user });
        }

        return res.status(201).json({ message: 'User created and pending approval', user });

    } catch (error) {
        console.error('Signup error:', error);
        return res.status(500).json({ error: 'Signup failed', details: error.message });
    }
};

// (module.exports moved below after helper functions)


const changePassword = async (req, res) => {
    try {
        const { new_password, confirm_password } = req.body;
        if (!new_password || !confirm_password) return res.status(400).json({ error: 'New password and confirmation are required.' });
        if (new_password !== confirm_password) return res.status(400).json({ error: 'Passwords do not match.' });
        if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(new_password)) {
            return res.status(400).json({ error: 'Password must be at least 8 characters and include an uppercase letter, number and special character.' });
        }

        const hash = await bcrypt.hash(new_password, 12);
        const result = await pool.query(
            `UPDATE users
             SET password_hash = $1,
                 must_change_password = FALSE,
                 temporary_password_expires_at = NULL
             WHERE user_id = $2
             RETURNING user_id`,
            [hash, req.session.user.user_id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found.' });

        req.session.user.must_change_password = false;
        await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
        return res.status(200).json({ message: 'Password changed successfully.' });
    } catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({ error: 'Failed to change password.' });
    }
};

// Export controllers (after functions are defined)
module.exports = {
    login,
    getCurrentUser,
    logout,
    signup,
    changePassword
};