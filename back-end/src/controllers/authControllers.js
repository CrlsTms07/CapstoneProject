const bcrypt = require("bcrypt");
const { findUserByUsername } = require("../models/authModel");
const pool = require("../config/database");

// Simple in-memory reset token store for dev flow { username -> { token, expiresAt } }
const resetTokens = new Map();

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
            role_id: user.role_id,
            role_name: user.role_name,
            department_id: user.department_id
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
const getCurrentUser = (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            error: "Not authenticated."
        });
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
             RETURNING user_id, username, full_name, email, school_id, role_id, department_id, is_approved`,
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
                role_id: user.role_id,
                role_name: selectedRole.role_name,
                department_id: user.department_id
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


// FORGOT PASSWORD - generate reset token (development flow)
const forgotPassword = async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'username is required' });

        const user = await findUserByUsername(username);
        if (!user) {
            // Don't reveal whether user exists
            return res.status(200).json({ message: 'If the account exists, a reset token was generated.' });
        }

        const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
        const expiresAt = Date.now() + 1000 * 60 * 15; // 15 minutes

        resetTokens.set(username, { token, expiresAt });

        console.log(`Password reset token for ${username}: ${token} (expires in 15 minutes)`);

        // In production you'd email the token. Here we return a generic response.
        return res.status(200).json({ message: 'If the account exists, a reset token was generated.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ error: 'Failed to process forgot password request' });
    }
};

// RESET PASSWORD - verify token and set new password
const resetPassword = async (req, res) => {
    try {
        const { username, token, new_password } = req.body;
        if (!username || !token || !new_password) return res.status(400).json({ error: 'username, token and new_password are required' });

        const entry = resetTokens.get(username);
        if (!entry || entry.token !== token || Date.now() > entry.expiresAt) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        const hash = await bcrypt.hash(new_password, 10);

        await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2', [hash, username]);

        resetTokens.delete(username);

        return res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({ error: 'Failed to reset password' });
    }
};

// Export controllers (after functions are defined)
module.exports = {
    login,
    getCurrentUser,
    logout,
    signup,
    forgotPassword,
    resetPassword
};