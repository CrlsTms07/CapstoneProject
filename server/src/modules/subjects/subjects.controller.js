// HIPO 4.1 – Subjects
// Subject CRUD (subject name, grade level, display color, weekly minutes).
const { HttpError, handle } = require("../../utils/httpError");
const service = require("./subjects.service");
const { normalizeSubject, requirePositiveId } = require("./subjects.validation");

const subjectIdOf = req => requirePositiveId(req.params.id, "Subject id");

// GET /api/subjects
const getSubjects = handle(async (req, res) => {
    res.status(200).json(await service.listSubjects());
});

// GET /api/subjects/:id
const getSubjectById = handle(async (req, res) => {
    const subject = await service.getSubject(subjectIdOf(req));
    if (!subject) throw new HttpError(404, "Subject not found");
    res.status(200).json(subject);
});

// POST /api/subjects – { subject_name, grade_level_id, color?, weekly_minutes? }
const createSubject = handle(async (req, res) => {
    res.status(201).json(await service.createSubject(normalizeSubject(req.body)));
});

// PUT /api/subjects/:id – color / weekly_minutes left out of the body stay unchanged.
const updateSubject = handle(async (req, res) => {
    const subject = await service.updateSubject(subjectIdOf(req), normalizeSubject(req.body));
    if (!subject) throw new HttpError(404, "Subject not found");
    res.status(200).json(subject);
});

// DELETE /api/subjects/:id – 409 while schedule entries or approval history still use it (ON DELETE RESTRICT).
const deleteSubject = handle(async (req, res) => {
    const subject = await service.deleteSubject(subjectIdOf(req));
    if (!subject) throw new HttpError(404, "Subject not found");
    res.status(200).json({ message: "Subject deleted successfully", subject });
}, { action: "delete" });

module.exports = {
    getSubjects,
    getSubjectById,
    createSubject,
    updateSubject,
    deleteSubject
};
