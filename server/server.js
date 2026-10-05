// Shared – server entry point: runs the startup migrations, then starts the Express app (src/app.js).
require("dotenv").config();

const app = require("./src/app");
const { runMigrations } = require("./src/db/migrations");

const PORT = process.env.PORT || 5000;

runMigrations()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });
    })
    .catch(error => {
        console.error("Failed to run startup migrations:", error.message || error);
        process.exit(1);
    });
