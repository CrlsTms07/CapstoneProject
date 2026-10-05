const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);

require("dotenv").config();

// Database
const pool = require("./src/config/database");

// Routes (centralized)
const routes = require("./src/routes");
// Startup migrations (src/db/migrations)
const { ensureAccountRecoverySchema } = require("./src/db/migrations/accountRecovery.migration");
const { ensureClassProgramSchema } = require("./src/db/migrations/classPrograms.migration");

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

// Public roles must be registered before the authenticated /api/roles router.
app.use("/api/roles/public", routes.publicRolesRoutes);
app.use("/api/roles", routes.rolesRoutes);
app.use("/api/departments", routes.departmentsRoutes);
app.use("/api/grade-levels", routes.gradeLevelsRoutes);
app.use("/api/buildings", routes.buildingsRoutes);
app.use("/api/rooms", routes.roomsRoutes);
app.use("/api/teachers", routes.teachersRoutes);
app.use("/api/subjects", routes.subjectsRoutes);
app.use("/api/sections", routes.sectionsRoutes);
app.use("/api/time-slots", routes.timeSlotsRoutes);
app.use("/api/schedules", routes.schedulesRoutes);
app.use("/api/class-programs", routes.classProgramsRoutes);

// Public schedules (no auth)
app.use("/api/public/schedules", routes.publicSchedulesRoutes);
app.use("/api/schedule-approvals", routes.scheduleApprovalsRoutes);

app.use("/api/teacher-tasks", routes.teacherTasksRoutes);
app.use("/api/users", routes.usersRoutes);
app.use("/api/password-reset-requests", routes.passwordResetRequestsRoutes);
app.use("/api/auth", routes.authRoutes);

// Serve the built frontend when running the production server.
app.use(express.static(path.join(__dirname, "../client/dist")));
app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

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

ensureAccountRecoverySchema()
    .then(() => ensureClassProgramSchema())
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });
    })
    .catch(error => {
        console.error("Failed to initialize account recovery schema:", error.message || error);
        process.exit(1);
    });