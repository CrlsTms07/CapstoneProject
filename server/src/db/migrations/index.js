// Shared – runs every startup migration in order (server.js and the test database setup).
const { ensureAccountRecoverySchema } = require("./accountRecovery.migration");
const { ensureClassProgramSchema } = require("./classPrograms.migration");
const { ensureScheduleEntriesSchema } = require("./scheduleEntries.migration");

const runMigrations = async () => {
    await ensureAccountRecoverySchema();
    await ensureClassProgramSchema();
    await ensureScheduleEntriesSchema();
};

module.exports = { runMigrations };
