// Shared – runs every startup migration in order (server.js and the test database setup).
const { ensureAccountRecoverySchema } = require("./accountRecovery.migration");
const { ensureClassProgramSchema } = require("./classPrograms.migration");
const { ensureScheduleEntriesSchema } = require("./scheduleEntries.migration");
const { ensureClassProgramFields } = require("./classProgramFields.migration");
const { ensureTimeTemplatesSchema } = require("./timeTemplates.migration");
const { ensureEntryTeachersSchema } = require("./entryTeachers.migration");
const { ensureDocumentSettingsSchema } = require("./documentSettings.migration");

const runMigrations = async () => {
    await ensureAccountRecoverySchema();
    await ensureClassProgramSchema();
    await ensureScheduleEntriesSchema();
    await ensureClassProgramFields();
    await ensureTimeTemplatesSchema();
    await ensureEntryTeachersSchema();
    await ensureDocumentSettingsSchema();
};

module.exports = { runMigrations };
