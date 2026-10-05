// Shared – Express entry point: session setup, startup migrations and the API mounts for every HIPO module.
const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);

require("dotenv").config();

// Database
const pool = require("./src/config/database");

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

// Each feature lives in src/modules/<module>/ (see docs/FEATURE_MAP.md).
// Mount order matters: /api/roles/public must come before /api/roles, and the
// class-program review router must come before the class-program plotter router.
app.use("/api/roles/public", require("./src/modules/users/roles.public.routes"));        // HIPO 4.3 (public role list)
app.use("/api/roles", require("./src/modules/users/roles.routes"));                      // HIPO 4.3 Users & Roles
app.use("/api/departments", require("./src/modules/sections/departments.routes"));       // HIPO 3.4 Manage Section
app.use("/api/grade-levels", require("./src/modules/sections/gradeLevels.routes"));      // HIPO 3.4 Manage Section
app.use("/api/buildings", require("./src/modules/rooms/buildings.routes"));              // HIPO 4.2 Rooms & Buildings
app.use("/api/rooms", require("./src/modules/rooms/rooms.routes"));                      // HIPO 4.2 Rooms & Buildings
app.use("/api/teachers", require("./src/modules/teachers/teachers.routes"));             // HIPO 3.3 Manage Teacher
app.use("/api/subjects", require("./src/modules/subjects/subjects.routes"));             // HIPO 4.1 Subjects
app.use("/api/sections", require("./src/modules/sections/sections.routes"));             // HIPO 3.4 Manage Section
app.use("/api/time-slots", require("./src/modules/schedules/timeSlots.routes"));         // HIPO 3.2 Schedule Plotter
app.use("/api/schedules", require("./src/modules/schedules/schedules.routes"));          // HIPO 3.2 / 8.0
app.use("/api/class-programs", require("./src/modules/approvals/classProgramReview.routes")); // HIPO 5.0 Approvals
app.use("/api/class-programs", require("./src/modules/schedules/classPrograms.routes"));      // HIPO 3.2 Schedule Plotter
app.use("/api/public/schedules", require("./src/modules/public/public.routes"));         // HIPO 10.0 Guest view (no auth)
app.use("/api/schedule-approvals", require("./src/modules/approvals/approvals.routes")); // HIPO 5.0 Approvals
app.use("/api/teacher-tasks", require("./src/modules/teachers/teacherTasks.routes"));    // HIPO 3.3 Manage Teacher
app.use("/api/users", require("./src/modules/users/users.routes"));                      // HIPO 4.3 Users & Roles
app.use("/api/password-reset-requests", require("./src/modules/auth/passwordReset.routes")); // HIPO 2.0 Login (recovery)
app.use("/api/auth", require("./src/modules/auth/auth.routes"));                         // HIPO 2.0 Login

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