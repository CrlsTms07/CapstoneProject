// Shared – role-based access control (RBAC) middleware.
//
//   authenticate            the request must come from a signed-in user (session)
//   authorize(...roles)     the user's role must be one of the given roles (use the ROLES names)
//   scopeToDepartment       loads what the user may plan and puts it in req.scope:
//                             Admin                     -> everything            { isAdmin: true }
//                             Grade Level Chairperson   -> one grade level       { departmentId, gradeLevelId }
//                             Master Teacher            -> one department        { departmentId }
//                             Teacher                   -> own classes           { departmentId, teacherId }
//                           Services check sections against req.scope (see schedules.service.js).
//
// Guest routes (/api/public) use none of these and are read-only.
const pool = require("../config/database");

// Role ids are fixed in the roles table (see src/db/seeds/init_database.js).
const ROLES = Object.freeze({ ADMIN: 1, CHAIR: 2, MASTER_TEACHER: 3, TEACHER: 4 });

const authenticate = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: "Not authenticated." });
    }
    if (req.session.user.must_change_password) {
        return res.status(403).json({ error: "Password change required.", code: "PASSWORD_CHANGE_REQUIRED" });
    }
    next();
};

// Like authenticate, but still allows users who must change their temporary password.
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

const authorize = (...allowedRoles) => (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: "Not authenticated." });
    }
    if (!allowedRoles.includes(Number(req.session.user.role_id))) {
        return res.status(403).json({ error: "You do not have permission to do this." });
    }
    next();
};

// Reads the assignment from the database (not the session) so changes by the admin apply at once.
const scopeToDepartment = async (req, res, next) => {
    try {
        const user = req.session.user;
        const role = Number(user.role_id);
        if (role === ROLES.ADMIN) {
            req.scope = { role, isAdmin: true };
            return next();
        }
        const result = await pool.query(`
            SELECT COALESCE(u.department_id, gl.department_id) AS department_id,
                   u.assigned_grade_level_id, t.teacher_id
            FROM users u
            LEFT JOIN grade_levels gl ON gl.grade_level_id = u.assigned_grade_level_id
            LEFT JOIN teachers t ON t.user_id = u.user_id
            WHERE u.user_id = $1
        `, [user.user_id]);
        const account = result.rows[0] || {};
        req.scope = {
            role,
            isAdmin: false,
            departmentId: account.department_id || null,
            gradeLevelId: role === ROLES.CHAIR ? account.assigned_grade_level_id || null : null,
            teacherId: account.teacher_id || null
        };
        if (role === ROLES.CHAIR && !req.scope.gradeLevelId) {
            return res.status(403).json({ error: "Ask the administrator to assign your grade level first." });
        }
        if (role === ROLES.MASTER_TEACHER && !req.scope.departmentId) {
            return res.status(403).json({ error: "Ask the administrator to assign your department first." });
        }
        next();
    } catch (error) {
        console.error("scopeToDepartment failed:", error);
        res.status(500).json({ error: "Could not check your access." });
    }
};

module.exports = {
    ROLES,
    authenticate,
    authenticateUserForPasswordChange,
    authorize,
    scopeToDepartment
};
