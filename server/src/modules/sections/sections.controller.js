// HIPO 3.4 – Manage Section
// Section CRUD (section name, grade level, class adviser, co-adviser, strand).
const { HttpError, handle } = require("../../utils/httpError");
const service = require("./sections.service");
const { normalizeSection, requirePositiveId } = require("./sections.validation");

const sectionIdOf = req => requirePositiveId(req.params.id, "Section id");

// GET /api/sections
const getSections = handle(async (req, res) => {
    res.status(200).json(await service.listSections());
});

// GET /api/sections/:id
const getSectionById = handle(async (req, res) => {
    const section = await service.getSection(sectionIdOf(req));
    if (!section) throw new HttpError(404, "Section not found");
    res.status(200).json(section);
});

// POST /api/sections – { section_name, grade_level_id, adviser_id?, co_adviser_id?, strand? }
const createSection = handle(async (req, res) => {
    res.status(201).json(await service.createSection(normalizeSection(req.body)));
});

// PUT /api/sections/:id – adviser_id / co_adviser_id / strand left out of the body stay unchanged.
const updateSection = handle(async (req, res) => {
    const section = await service.updateSection(sectionIdOf(req), normalizeSection(req.body));
    if (!section) throw new HttpError(404, "Section not found");
    res.status(200).json(section);
});

// DELETE /api/sections/:id – 409 while schedule entries or approval history still use it (ON DELETE RESTRICT).
const deleteSection = handle(async (req, res) => {
    const section = await service.deleteSection(sectionIdOf(req));
    if (!section) throw new HttpError(404, "Section not found");
    res.status(200).json({ message: "Section deleted successfully", section });
}, { action: "delete" });

module.exports = {
    getSections,
    getSectionById,
    createSection,
    updateSection,
    deleteSection
};
