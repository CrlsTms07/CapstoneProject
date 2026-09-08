const pool = require('../config/database');

// Public: GET /api/public/schedules
// Optional query params: department_id, section_id
const getPublicSchedules = async (req, res) => {
  try {
    const departmentId = req.query.department_id ? Number(req.query.department_id) : null;
    const sectionId = req.query.section_id ? Number(req.query.section_id) : null;

    const result = await pool.query(
      `
      SELECT
        s.schedule_id,
        s.day_of_week,
        s.status,
        ts.start_time,
        sec.section_id,
        sec.section_name,
        gl.grade_level_id,
        d.department_id,
        d.department_name,
        sub.subject_id,
        sub.subject_name,
        t.teacher_id,
        t.last_name AS teacher_last_name,
        r.room_id,
        r.room_number,
        b.building_id,
        b.building_name
      FROM schedules s
      JOIN sections sec ON s.section_id = sec.section_id
      JOIN grade_levels gl ON sec.grade_level_id = gl.grade_level_id
      JOIN departments d ON gl.department_id = d.department_id
      LEFT JOIN subjects sub ON s.subject_id = sub.subject_id
      LEFT JOIN teachers t ON s.teacher_id = t.teacher_id
      LEFT JOIN rooms r ON s.room_id = r.room_id
      LEFT JOIN buildings b ON r.building_id = b.building_id
      LEFT JOIN time_slots ts ON s.time_slot_id = ts.time_slot_id
      WHERE ($1::int IS NULL OR d.department_id = $1)
        AND ($2::int IS NULL OR s.section_id = $2)
      ORDER BY s.day_of_week, ts.start_time
      `,
      [departmentId, sectionId]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching public schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
};

module.exports = { getPublicSchedules };
