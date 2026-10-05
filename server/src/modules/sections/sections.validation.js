// HIPO 3.4 – Manage Section
// Pure request checks for sections (no database): name, grade level, adviser, co-adviser and strand.
const { HttpError } = require("../../utils/httpError");

const STRAND_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 .&-]{0,29}$/;

const isBlank = value => value === undefined || value === null || value === "";

const requirePositiveId = (value, label) => {
    const id = Number(value);
    if (isBlank(value) || !Number.isInteger(id) || id <= 0) throw new HttpError(400, `${label} is required.`);
    return id;
};

// A teacher id, null when blank, undefined when left out (keep the saved value).
const optionalTeacherId = (value, label) => {
    if (value === undefined) return undefined;
    if (isBlank(value)) return null;
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, `${label} must be a teacher id.`);
    return id;
};

// "abm" -> "ABM"; blank -> null; undefined -> undefined (keep the saved value).
const normalizeStrand = value => {
    if (value === undefined) return undefined;
    if (isBlank(value)) return null;
    const strand = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
    if (!STRAND_PATTERN.test(strand)) {
        throw new HttpError(400, "strand must be up to 30 letters, numbers, spaces, dots, & or hyphens (e.g. ABM, STEM, TVL-ICT).");
    }
    return strand.toUpperCase();
};

// Request body -> clean section. adviser_id / co_adviser_id / strand left out of the body stay unchanged.
const normalizeSection = body => {
    if (!body || typeof body !== "object") throw new HttpError(400, "The request body must be an object.");
    const sectionName = typeof body.section_name === "string" ? body.section_name.trim() : "";
    if (!sectionName) throw new HttpError(400, "section_name is required.");
    if (sectionName.length > 100) throw new HttpError(400, "section_name must be at most 100 characters.");
    const section = {
        section_name: sectionName,
        grade_level_id: requirePositiveId(body.grade_level_id, "grade_level_id"),
        adviser_id: optionalTeacherId(body.adviser_id, "adviser_id"),
        co_adviser_id: optionalTeacherId(body.co_adviser_id, "co_adviser_id"),
        strand: normalizeStrand(body.strand)
    };
    if (section.adviser_id && section.adviser_id === section.co_adviser_id) {
        throw new HttpError(400, "The class adviser and the co-adviser must be different teachers.");
    }
    return section;
};

module.exports = { requirePositiveId, optionalTeacherId, normalizeStrand, normalizeSection };
