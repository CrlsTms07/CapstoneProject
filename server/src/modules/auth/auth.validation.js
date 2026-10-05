// HIPO 2.0 – Login
// Validation rules for authentication and account recovery.
// Note: the password-strength rule is still inline in auth.controller.js (signup, changePassword).

// Reasons accepted on the account recovery (forgot password) form.
const ALLOWED_REASONS = ["Forgotten Password", "Account Locked / Suspicious Activity", "Other"];

module.exports = { ALLOWED_REASONS };
