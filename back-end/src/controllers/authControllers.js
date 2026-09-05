const bcrypt = require("bcrypt");
const { findUserByUsername } = require("../models/authModel");

// LOGIN
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({
                error: "Username and password are required."
            });
        }

        // Find user
        const user = await findUserByUsername(username);

        // Generic authentication error
        if (!user || !user.password_hash) {
            return res.status(401).json({
                error: "Invalid username or password."
            });
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

module.exports = {
    login,
    getCurrentUser,
    logout
};