// HIPO 4.3 – Users & Roles
// Validation helpers for user accounts.

// Extracts the JHS grade number (7–10) from a grade-level name such as "Grade 7".
const gradeNumber = value => String(value || "").match(/\b(?:grade\s*)?(7|8|9|10)\b/i)?.[1] || null;

module.exports = { gradeNumber };
