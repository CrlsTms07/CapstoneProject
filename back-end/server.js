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
const { ensureClassProgramSchema } = require("./src/models/classProgramsModel");

const app = express();

const ensureAccountRecoverySchema = async () => {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE`);
    await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMPTZ;
        CREATE TABLE IF NOT EXISTS password_reset_requests (
            request_id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            employee_id VARCHAR(50) NOT NULL,
            email VARCHAR(150) NOT NULL,
            reason VARCHAR(100) NOT NULL,
            contact_number VARCHAR(40) NOT NULL,
            requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
            reviewed_by INT REFERENCES users(user_id) ON DELETE SET NULL,
            reviewed_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS password_reset_requests_pending_idx
            ON password_reset_requests(status, requested_at);
    `);
    console.log("Ensured account recovery schema exists");
};

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
app.use(express.static(path.join(__dirname, "../front-end/dist")));
app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(__dirname, "../front-end/dist/index.html"));
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