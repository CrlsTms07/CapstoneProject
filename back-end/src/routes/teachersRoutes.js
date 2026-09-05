const express = require("express");

const {
    getTeachers,
    getTeacherById,
    createTeacher,
    updateTeacher,
    deleteTeacher
} = require("../controllers/teachersControllers");

const {
    authenticateUser,
    authorizeRoles
} = require("../middleware/authMiddleware");

const router = express.Router();

// All teacher routes require authentication
router.use(authenticateUser);

// View teachers - all authenticated roles
router.get("/", getTeachers);
router.get("/:id", getTeacherById);

// Create / Update teachers - Admin + Grade Level Chairperson
router.post(
    "/",
    authorizeRoles(1, 2),
    createTeacher
);

router.put(
    "/:id",
    authorizeRoles(1, 2),
    updateTeacher
);

// Delete teacher - Admin only
router.delete(
    "/:id",
    authorizeRoles(1),
    deleteTeacher
);

module.exports = router;