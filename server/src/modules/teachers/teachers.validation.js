// HIPO 3.3 – Manage Teacher
// Validation rules for teacher records: allowed ancillary (teaching-related) tasks, the 4–5 subject load limit,
// and the list of subjects a teacher is qualified to teach.
const { HttpError } = require("../../utils/httpError");

const MAX_QUALIFIED_SUBJECTS = 60;
const ALLOWED_ANCILLARY_TASKS = new Set(["ICT Coordinator", "SSG Coordinator", "Lab Manager"]);

const normalizeAncillaryTasks = tasks => {
    if (tasks === undefined) return [];
    if (!Array.isArray(tasks) || tasks.some(task => !ALLOWED_ANCILLARY_TASKS.has(task))) return null;
    return [...new Set(tasks)];
};

const validMaxSubjectLoad = value => value === undefined || value === null || value === '' || (Number.isInteger(Number(value)) && Number(value) >= 4 && Number(value) <= 5);

// { subject_ids: [3, 5] } -> [3, 5] (distinct positive ids; an empty list clears the qualifications).
const normalizeSubjectIds = body => {
    const ids = body?.subject_ids;
    if (!Array.isArray(ids)) throw new HttpError(400, "subject_ids must be a list of subject ids.");
    if (ids.length > MAX_QUALIFIED_SUBJECTS) throw new HttpError(400, `A teacher can be qualified for at most ${MAX_QUALIFIED_SUBJECTS} subjects.`);
    const numbers = ids.map(Number);
    if (numbers.some(id => !Number.isInteger(id) || id <= 0)) throw new HttpError(400, "Each subject id must be a positive whole number.");
    if (new Set(numbers).size !== numbers.length) throw new HttpError(400, "A subject is listed twice.");
    return numbers;
};

const requireTeacherId = value => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Teacher id must be a positive whole number.");
    return id;
};

module.exports = { ALLOWED_ANCILLARY_TASKS, MAX_QUALIFIED_SUBJECTS, normalizeAncillaryTasks, validMaxSubjectLoad, normalizeSubjectIds, requireTeacherId };
