// Shared – authentication (session) and role-based authorization middleware.
// Check if the user is logged in
const authenticateUser = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            error: "Not authenticated."
        });
    }

    if (req.session.user.must_change_password) {
        return res.status(403).json({
            error: "Password change required.",
            code: "PASSWORD_CHANGE_REQUIRED"
        });
    }

    next();
};

const authenticateUserForPasswordChange = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: "Not authenticated." });
    }
    const expiresAt = req.session.user.temporary_password_expires_at;
    if (req.session.user.must_change_password && expiresAt && new Date(expiresAt) <= new Date()) {
        return res.status(403).json({
            error: "Your temporary password has expired. Submit a new account recovery request.",
            code: "TEMPORARY_PASSWORD_EXPIRED"
        });
    }
    next();
};

// Check if the logged-in user has one of the allowed roles
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                error: "Not authenticated."
            });
        }

        const userRoleId = req.session.user.role_id;

        if (!allowedRoles.includes(userRoleId)) {
            return res.status(403).json({
                error: "Access denied.",
                message: "You do not have permission to access this resource."
            });
        }

        next();
    };
};

module.exports = {
    authenticateUser,
    authenticateUserForPasswordChange,
    authorizeRoles
};