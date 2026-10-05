// HIPO 4.1 – Subjects
// Pure request checks for subjects (no database): name, grade level, display color and weekly minutes.
const { HttpError } = require("../../utils/httpError");

const MAX_WEEKLY_MINUTES = 3000;
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

const isBlank = value => value === undefined || value === null || value === "";

const requirePositiveId = (value, label) => {
    const id = Number(value);
    if (isBlank(value) || !Number.isInteger(id) || id <= 0) throw new HttpError(400, `${label} is required.`);
    return id;
};

// "#1a2b3c" -> "#1A2B3C"; blank -> null; undefined -> undefined (keep the saved value).
const normalizeColor = value => {
    if (value === undefined) return undefined;
    if (isBlank(value)) return null;
    if (typeof value !== "string" || !COLOR_PATTERN.test(value.trim())) {
        throw new HttpError(400, "color must be a hex color such as #3B82F6.");
    }
    return value.trim().toUpperCase();
};

// Whole minutes per week, 1–3000; blank -> null; undefined -> undefined (keep the saved value).
const normalizeWeeklyMinutes = value => {
    if (value === undefined) return undefined;
    if (isBlank(value)) return null;
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_WEEKLY_MINUTES) {
        throw new HttpError(400, `weekly_minutes must be a whole number from 1 to ${MAX_WEEKLY_MINUTES}.`);
    }
    return minutes;
};

// Request body -> clean subject. color / weekly_minutes left out of the body stay unchanged on update.
const normalizeSubject = body => {
    if (!body || typeof body !== "object") throw new HttpError(400, "The request body must be an object.");
    const subjectName = typeof body.subject_name === "string" ? body.subject_name.trim() : "";
    if (!subjectName) throw new HttpError(400, "subject_name is required.");
    if (subjectName.length > 100) throw new HttpError(400, "subject_name must be at most 100 characters.");
    return {
        subject_name: subjectName,
        grade_level_id: requirePositiveId(body.grade_level_id, "grade_level_id"),
        color: normalizeColor(body.color),
        weekly_minutes: normalizeWeeklyMinutes(body.weekly_minutes)
    };
};

module.exports = { MAX_WEEKLY_MINUTES, requirePositiveId, normalizeColor, normalizeWeeklyMinutes, normalizeSubject };
