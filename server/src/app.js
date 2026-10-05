// Shared – Express application: middleware, sessions and the API mounts for every HIPO module.
// server.js runs the migrations and calls listen(); tests import this file directly.
const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);

const pool = require("./config/database");

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
            tableName: "session",
            // The pruning timer would keep the automated tests from exiting.
            pruneSessionInterval: process.env.NODE_ENV === "test" ? false : 60 * 15
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
// Mount order matters: /api/roles/public must come before /api/roles.
app.use("/api/roles/public", require("./modules/users/roles.public.routes"));        // HIPO 4.3 (public role list)
app.use("/api/roles", require("./modules/users/roles.routes"));                      // HIPO 4.3 Users & Roles
app.use("/api/departments", require("./modules/sections/departments.routes"));       // HIPO 3.4 Manage Section
app.use("/api/grade-levels", require("./modules/sections/gradeLevels.routes"));      // HIPO 3.4 Manage Section
app.use("/api/buildings", require("./modules/rooms/buildings.routes"));              // HIPO 4.2 Rooms & Buildings
app.use("/api/rooms", require("./modules/rooms/rooms.routes"));                      // HIPO 4.2 Rooms & Buildings
app.use("/api/teachers", require("./modules/teachers/teachers.routes"));             // HIPO 3.3 Manage Teacher
app.use("/api/subjects", require("./modules/subjects/subjects.routes"));             // HIPO 4.1 Subjects
app.use("/api/sections", require("./modules/sections/sections.routes"));             // HIPO 3.4 Manage Section
app.use("/api/time-slots", require("./modules/schedules/timeSlots.routes"));         // HIPO 3.2 Schedule Plotter
app.use("/api/terms", require("./modules/schedules/terms.routes"));                  // HIPO 3.2 Schedule Plotter
app.use("/api/schedules", require("./modules/schedules/schedules.routes"));          // HIPO 3.2 / 8.0
app.use("/api/public", require("./modules/public/public.routes"));                   // HIPO 10.0 Guest view (no login, read-only)
app.use("/api/approvals", require("./modules/approvals/approvals.routes"));          // HIPO 5.0 Approvals
app.use("/api/reports", require("./modules/reports/reports.routes"));              // HIPO 6.0 Reports / 7.0 Export
app.use("/api/document-settings", require("./modules/exports/documentSettings.routes")); // HIPO 7.0 Export (printed header / signatories)
app.use("/api/teacher-tasks", require("./modules/teachers/teacherTasks.routes"));    // HIPO 3.3 Manage Teacher
app.use("/api/users", require("./modules/users/users.routes"));                      // HIPO 4.3 Users & Roles
app.use("/api/password-reset-requests", require("./modules/auth/passwordReset.routes")); // HIPO 2.0 Login (recovery)
app.use("/api/auth", require("./modules/auth/auth.routes"));                         // HIPO 2.0 Login

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

// Unknown /api paths return JSON instead of the React page.
app.use("/api", (req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
});

// Serve the built frontend when running the production server.
app.use(express.static(path.join(__dirname, "../../client/dist")));
app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(__dirname, "../../client/dist/index.html"));
});

module.exports = app;
