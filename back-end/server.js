const express = require("express");
const cors = require("cors");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);

require("dotenv").config();

// Database
const pool = require("./src/config/database");

// Routes
const rolesRoutes = require("./src/routes/rolesRoutes");
const departmentsRoutes = require("./src/routes/departmentsRoutes");
const gradeLevelsRoutes = require("./src/routes/gradeLevelsRoutes");
const buildingsRoutes = require("./src/routes/buildingsRoutes");
const roomsRoutes = require("./src/routes/roomsRoutes");
const teachersRoutes = require("./src/routes/teachersRoutes");
const subjectsRoutes = require("./src/routes/subjectsRoutes");
const sectionsRoutes = require("./src/routes/sectionsRoutes");
const timeSlotsRoutes = require("./src/routes/timeSlotsRoutes");
const schedulesRoutes = require("./src/routes/schedulesRoutes");
const scheduleApprovalsRoutes = require("./src/routes/scheduleApprovalsRoutes");
const teacherTasksRoutes = require("./src/routes/teacherTasksRoutes");
const usersRoutes = require("./src/routes/usersRoutes");
const authRoutes = require("./src/routes/authRoutes");

const app = express();

// =========================
// Middleware
// =========================

app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        credentials: true
    })
);

app.use(express.json());

// =========================
// Session Configuration
// =========================

app.use(
    session({
        store: new pgSession({
            pool: pool,
            tableName: "session"
        }),
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 8
        }
    })
);

// =========================
// Routes
// =========================

app.use("/api/roles", rolesRoutes);

app.use("/api/departments", departmentsRoutes);

app.use("/api/grade-levels", gradeLevelsRoutes);

app.use("/api/buildings", buildingsRoutes);

app.use("/api/rooms", roomsRoutes);

app.use("/api/teachers", teachersRoutes);

app.use("/api/subjects", subjectsRoutes);

app.use("/api/sections", sectionsRoutes);

app.use("/api/time-slots", timeSlotsRoutes);

app.use("/api/schedules", schedulesRoutes);

app.use("/api/schedule-approvals", scheduleApprovalsRoutes);

app.use("/api/teacher-tasks", teacherTasksRoutes);

app.use("/api/users", usersRoutes);

app.use("/api/auth", authRoutes);

// =========================
// Test Route
// =========================

app.get("/", (req, res) => {
    res.json({
        message: "Class Scheduling Backend is running!"
    });
});

// =========================
// Test Database Route
// =========================

app.get("/api/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.status(200).json({
            success: true,
            message: "Database connection is working!",
            time: result.rows[0].now
        });
    } catch (error) {
        console.error("Database test error:", error);

        res.status(500).json({
            success: false,
            message: "Database connection failed."
        });
    }
});

// =========================
// Start Server
// =========================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});