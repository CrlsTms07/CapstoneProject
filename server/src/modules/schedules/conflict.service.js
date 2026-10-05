// HIPO 3.2 – Schedule Plotter: conflict detection (API level)
//
// Checks a proposed schedule before it is saved and reports:
//   - teacher, room and section overlaps (same weekday, overlapping time)
//   - teacher subject load against max_subject_load (default 5) – reported as a warning only
//
// The same rules are enforced again inside PostgreSQL (exclusion constraints + triggers) in
// src/db/migrations/scheduleConflictGuards.migration.js, so a conflict that slips past the API
// is still rejected by the database.
const pool = require('../../config/database')

// ---------------------------------------------------------------------------------------------
// Legacy schedules (/api/schedules): a conflict is another schedule on the same day AND the same
// time_slot_id that uses the same teacher, room or section (checked in that order).
// Returns { resource: 'teacher' | 'room' | 'section', schedule } or null.
// Pass excludeScheduleId when updating so the schedule does not conflict with itself.
// ---------------------------------------------------------------------------------------------
const findLegacyScheduleConflict = async ({ section_id, teacher_id, room_id, time_slot_id, day_of_week }, excludeScheduleId) => {
  const conflictResult = excludeScheduleId === undefined
    ? await pool.query(`
      SELECT
          s.schedule_id,
          s.section_id,
          s.teacher_id,
          s.room_id,
          s.time_slot_id,
          s.day_of_week
      FROM schedules s
      WHERE s.day_of_week = $1
        AND s.time_slot_id = $2
    `, [day_of_week, time_slot_id])
    : await pool.query(`
      SELECT
          s.schedule_id,
          s.section_id,
          s.teacher_id,
          s.room_id,
          s.time_slot_id,
          s.day_of_week
      FROM schedules s
      WHERE s.day_of_week = $1
        AND s.time_slot_id = $2
        AND s.schedule_id <> $3
    `, [day_of_week, time_slot_id, excludeScheduleId])

  const conflicts = conflictResult.rows

  const teacherConflict = conflicts.find(schedule => schedule.teacher_id === Number(teacher_id))
  if (teacherConflict) return { resource: 'teacher', schedule: teacherConflict }

  const roomConflict = conflicts.find(schedule => schedule.room_id === Number(room_id))
  if (roomConflict) return { resource: 'room', schedule: roomConflict }

  const sectionConflict = conflicts.find(schedule => schedule.section_id === Number(section_id))
  if (sectionConflict) return { resource: 'section', schedule: sectionConflict }

  return null
}

// ---------------------------------------------------------------------------------------------
// JHS class programs (/api/class-programs/validate): every candidate entry is a 45-minute period.
// Compares candidates against existing legacy schedules and other class programs (excluding the
// program being edited), and against each other. Returns an array of
// { resource, day_of_week, start_time, message } – empty when there are no conflicts.
// ---------------------------------------------------------------------------------------------
const findClassProgramConflicts = async (entries, programId) => {
  const days = [...new Set(entries.map(entry => entry.day_of_week))]
  const existingResult = days.length ? await pool.query(`
    SELECT s.day_of_week, ts.start_time::TEXT AS start_time, s.section_id, s.teacher_id, s.room_id,
           s.subject_id, 'schedule'::TEXT AS source
    FROM schedules s JOIN time_slots ts ON ts.time_slot_id = s.time_slot_id
    WHERE s.day_of_week = ANY($1::TEXT[]) AND s.status <> 'rejected'
    UNION ALL
    SELECT e.day_of_week, e.start_time::TEXT AS start_time, e.section_id, e.teacher_id, e.room_id,
           e.subject_id, 'class-program'::TEXT AS source
    FROM jhs_class_program_entries e
    WHERE e.day_of_week = ANY($1::TEXT[]) AND e.status <> 'rejected'
      AND ($2::INT IS NULL OR e.program_id <> $2)
  `, [days, programId]) : { rows: [] }
  const toMinutes = value => {
    const [hour, minute] = String(value).split(':').map(Number)
    return hour * 60 + minute
  }
  const conflicts = []
  entries.forEach((candidate, index) => {
    const candidateStart = toMinutes(candidate.start_time)
    const candidateEnd = candidateStart + 45
    existingResult.rows.forEach(existing => {
      if (candidate.day_of_week !== existing.day_of_week) return
      const existingStart = toMinutes(existing.start_time)
      if (candidateStart >= existingStart + 45 || existingStart >= candidateEnd) return
      const resource = candidate.teacher_id && candidate.teacher_id === Number(existing.teacher_id) ? 'teacher'
        : candidate.room_id && candidate.room_id === Number(existing.room_id) ? 'room'
          : candidate.section_id === Number(existing.section_id) ? 'section' : null
      if (resource) conflicts.push({ resource, day_of_week: candidate.day_of_week, start_time: candidate.start_time, message: `Conflicts with an existing ${resource} schedule at ${existing.start_time}.` })
    })
    entries.slice(index + 1).forEach(other => {
      if (candidate.day_of_week !== other.day_of_week) return
      const otherStart = toMinutes(other.start_time)
      if (candidateStart >= otherStart + 45 || otherStart >= candidateEnd) return
      const resource = candidate.teacher_id && candidate.teacher_id === other.teacher_id ? 'teacher'
        : candidate.room_id && candidate.room_id === other.room_id ? 'room'
          : candidate.section_id === other.section_id ? 'section' : null
      if (resource) conflicts.push({ resource, day_of_week: candidate.day_of_week, start_time: candidate.start_time, message: `Two rows overlap for this ${resource} at ${other.start_time}.` })
    })
  })
  return conflicts
}

// ---------------------------------------------------------------------------------------------
// Teacher load for a candidate class program: distinct subjects per teacher across existing
// schedules, other class programs and the candidate entries, compared to max_subject_load.
// ---------------------------------------------------------------------------------------------
const getTeacherLoadWarnings = async (entries, programId) => {
  const teacherIds = [...new Set(entries.map(entry => entry.teacher_id).filter(Boolean))]
  let warnings = []
  if (teacherIds.length) {
    const currentLoads = await pool.query(`
      SELECT DISTINCT teacher_id, subject_id
      FROM (
        SELECT teacher_id, subject_id FROM schedules WHERE status NOT IN ('rejected', 'draft')
        UNION
        SELECT teacher_id, subject_id FROM jhs_class_program_entries
        WHERE status <> 'rejected' AND ($2::INT IS NULL OR program_id <> $2)
      ) loads
      WHERE teacher_id = ANY($1::INT[])
    `, [teacherIds, programId])
    const candidateSubjects = new Map()
    currentLoads.rows.forEach(row => {
      const ids = candidateSubjects.get(Number(row.teacher_id)) || new Set()
      ids.add(Number(row.subject_id))
      candidateSubjects.set(Number(row.teacher_id), ids)
    })
    entries.forEach(entry => {
      if (!entry.teacher_id || !entry.subject_id) return
      const ids = candidateSubjects.get(Number(entry.teacher_id)) || new Set()
      ids.add(entry.subject_id)
      candidateSubjects.set(Number(entry.teacher_id), ids)
    })
    const teachersResult = await pool.query(`
      SELECT t.teacher_id, COALESCE(u.full_name, t.last_name) AS teacher_name,
             COALESCE(t.max_subject_load, 5)::INT AS max_subject_load, t.ancillary_tasks
      FROM teachers t JOIN users u ON u.user_id = t.user_id
      WHERE t.teacher_id = ANY($1::INT[])
    `, [teacherIds])
    warnings = teachersResult.rows.map(teacher => {
      const subjectCount = candidateSubjects.get(Number(teacher.teacher_id))?.size || 0
      return {
        teacher_id: teacher.teacher_id,
        teacher_name: teacher.teacher_name,
        subject_count: subjectCount,
        max_subject_load: teacher.max_subject_load,
        ancillary_tasks: teacher.ancillary_tasks || [],
        overloaded: subjectCount > teacher.max_subject_load
      }
    })
  }
  return warnings
}

// Teacher load for the teachers assigned in a saved class program.
const getTeacherWarnings = async programId => {
  const result = await pool.query(`
    WITH assigned AS (
      SELECT DISTINCT teacher_id FROM jhs_class_program_entries
      WHERE program_id = $1 AND teacher_id IS NOT NULL
    ), subject_load AS (
      SELECT teacher_id, COUNT(DISTINCT subject_id)::INT AS subject_count
      FROM (
        SELECT teacher_id, subject_id
        FROM schedules
        WHERE status NOT IN ('rejected', 'draft')
        UNION
        SELECT teacher_id, subject_id
        FROM jhs_class_program_entries
        WHERE status <> 'rejected'
      ) loads
      GROUP BY teacher_id
    )
    SELECT t.teacher_id, COALESCE(u.full_name, t.last_name) AS teacher_name,
           COALESCE(load.subject_count, 0)::INT AS subject_count,
           COALESCE(t.max_subject_load, 5)::INT AS max_subject_load,
           t.ancillary_tasks
    FROM assigned a
    JOIN teachers t ON t.teacher_id = a.teacher_id
    JOIN users u ON u.user_id = t.user_id
    LEFT JOIN subject_load load ON load.teacher_id = t.teacher_id
  `, [programId])
  return result.rows.map(teacher => ({
    ...teacher,
    overloaded: teacher.subject_count > teacher.max_subject_load,
    ancillary_tasks: teacher.ancillary_tasks || []
  }))
}

module.exports = { findLegacyScheduleConflict, findClassProgramConflicts, getTeacherLoadWarnings, getTeacherWarnings }
