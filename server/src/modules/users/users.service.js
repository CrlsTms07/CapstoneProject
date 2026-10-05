// HIPO 4.3 – Users & Roles
// Data access for user accounts.
const pool = require("../../config/database");
const { gradeNumber } = require("./users.validation");

// A Grade Level Chairperson (role 2) must be assigned a Grade 7–10 level; other roles keep their department.
const resolveUserGradeScope = async (roleId, gradeLevelId, departmentId) => {
    if (Number(roleId) !== 2) return { assignedGradeLevelId: null, departmentId: departmentId || null };
    if (!gradeLevelId) return { error: "Select the chairperson's assigned Grade 7–10 level." };
    const result = await pool.query(
        "SELECT grade_level_id, grade_level_name, department_id FROM grade_levels WHERE grade_level_id = $1",
        [gradeLevelId]
    );
    const grade = result.rows[0];
    if (!grade || !gradeNumber(grade.grade_level_name)) return { error: "Chairperson assignment must be Grade 7, 8, 9, or 10." };
    return { assignedGradeLevelId: grade.grade_level_id, departmentId: grade.department_id };
};

module.exports = { resolveUserGradeScope };
