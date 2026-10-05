// HIPO 3.4 – Manage Section
// Data access for sections: name, grade level, class adviser, co-adviser and (Senior High) strand.
const pool = require("../../config/database");
const { HttpError } = require("../../utils/httpError");
const { schoolLevelOf } = require("../schedules/schedules.validation");

const SECTION_SELECT = `
    SELECT s.section_id, s.section_name, s.grade_level_id, s.adviser_id, s.co_adviser_id, s.strand,
           COALESCE(au.full_name, a.last_name) AS adviser_name,
           COALESCE(cu.full_name, c.last_name) AS co_adviser_name
    FROM sections s
    LEFT JOIN teachers a ON a.teacher_id = s.adviser_id
    LEFT JOIN users au ON au.user_id = a.user_id
    LEFT JOIN teachers c ON c.teacher_id = s.co_adviser_id
    LEFT JOIN users cu ON cu.user_id = c.user_id
`;

const listSections = async () => (await pool.query(`${SECTION_SELECT} ORDER BY s.section_id`)).rows;

const getSection = async id => (await pool.query(`${SECTION_SELECT} WHERE s.section_id = $1`, [id])).rows[0] || null;

// The values a save would end with (undefined fields keep the saved value).
const mergedWithSaved = (section, saved) => ({
    adviser_id: section.adviser_id !== undefined ? section.adviser_id : saved?.adviser_id ?? null,
    co_adviser_id: section.co_adviser_id !== undefined ? section.co_adviser_id : saved?.co_adviser_id ?? null,
    strand: section.strand !== undefined ? section.strand : saved?.strand ?? null
});

// Checks that need the database: the grade level exists, a strand only on Grades 11–12,
// adviser and co-adviser are existing, different teachers.
const assertSectionRules = async (section, saved = null) => {
    const merged = mergedWithSaved(section, saved);
    const gradeLevel = (await pool.query("SELECT grade_level_name FROM grade_levels WHERE grade_level_id = $1", [section.grade_level_id])).rows[0];
    if (!gradeLevel) throw new HttpError(400, "The selected grade level does not exist.");
    if (merged.strand && schoolLevelOf(gradeLevel.grade_level_name) !== "SHS") {
        throw new HttpError(400, "A strand is only set for Senior High School sections (Grades 11–12).");
    }
    if (merged.adviser_id && merged.adviser_id === merged.co_adviser_id) {
        throw new HttpError(400, "The class adviser and the co-adviser must be different teachers.");
    }
    const teacherIds = [merged.adviser_id, merged.co_adviser_id].filter(Boolean);
    if (teacherIds.length) {
        const found = await pool.query("SELECT teacher_id FROM teachers WHERE teacher_id = ANY($1::INT[])", [teacherIds]);
        if (found.rowCount !== new Set(teacherIds).size) throw new HttpError(400, "The selected adviser or co-adviser is not a registered teacher.");
    }
};

const createSection = async section => {
    await assertSectionRules(section);
    const created = await pool.query(`
        INSERT INTO sections (section_name, grade_level_id, adviser_id, co_adviser_id, strand)
        VALUES ($1, $2, $3, $4, $5) RETURNING section_id
    `, [section.section_name, section.grade_level_id, section.adviser_id ?? null, section.co_adviser_id ?? null, section.strand ?? null]);
    return getSection(created.rows[0].section_id);
};

const updateSection = async (id, section) => {
    const saved = await getSection(id);
    if (!saved) return null;
    await assertSectionRules(section, saved);
    const merged = mergedWithSaved(section, saved);
    await pool.query(`
        UPDATE sections
        SET section_name = $1, grade_level_id = $2, adviser_id = $3, co_adviser_id = $4, strand = $5
        WHERE section_id = $6
    `, [section.section_name, section.grade_level_id, merged.adviser_id, merged.co_adviser_id, merged.strand, id]);
    return getSection(id);
};

const deleteSection = async id => (await pool.query(`
    DELETE FROM sections WHERE section_id = $1 RETURNING section_id, section_name, grade_level_id
`, [id])).rows[0] || null;

module.exports = { listSections, getSection, createSection, updateSection, deleteSection };
