// Check if the user is logged in
const authenticateUser = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            error: "Not authenticated."
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
    authorizeRoles
};