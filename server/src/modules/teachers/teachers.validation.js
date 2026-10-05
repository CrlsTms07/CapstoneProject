// HIPO 3.3 – Manage Teacher
// Validation rules for teacher records: allowed ancillary (teaching-related) tasks and the 4–5 subject load limit.
const ALLOWED_ANCILLARY_TASKS = new Set(["ICT Coordinator", "SSG Coordinator", "Lab Manager"]);

const normalizeAncillaryTasks = tasks => {
    if (tasks === undefined) return [];
    if (!Array.isArray(tasks) || tasks.some(task => !ALLOWED_ANCILLARY_TASKS.has(task))) return null;
    return [...new Set(tasks)];
};

const validMaxSubjectLoad = value => value === undefined || value === null || value === '' || (Number.isInteger(Number(value)) && Number(value) >= 4 && Number(value) <= 5);

module.exports = { ALLOWED_ANCILLARY_TASKS, normalizeAncillaryTasks, validMaxSubjectLoad };
