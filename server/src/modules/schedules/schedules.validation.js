// HIPO 3.2 – Schedule Plotter
// Request validation for JHS class-program entries (weekday, 24-hour start time, fixed 45-minute
// periods, instruction rows vs break/lunch rows, one teacher per subject per section).

// Extracts the JHS grade number (7–10) from a grade-level name such as "Grade 7".
const gradeNumber = name => String(name || '').match(/\b(?:grade\s*)?(7|8|9|10)\b/i)?.[1] || null

const normalizeEntries = (entries, section, status) => {
  if (!Array.isArray(entries) || entries.length > 600) throw Object.assign(new Error('Entries must be an array of at most 600 rows.'), { statusCode: 400 })
  const subjectTeachers = new Map()
  const normalized = []
  for (const entry of entries) {
    const day = String(entry.day_of_week || '')
    const time = String(entry.start_time || '')
    const minutes = Number(entry.duration_minutes ?? 45)
    if (!['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day)) throw Object.assign(new Error('Each row needs a weekday from Monday to Friday.'), { statusCode: 400 })
    if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) throw Object.assign(new Error('Use a valid 24-hour start time.'), { statusCode: 400 })
    if (minutes !== 45) throw Object.assign(new Error('JHS class periods must be exactly 45 minutes.'), { statusCode: 400 })
    const subjectId = entry.subject_id ? Number(entry.subject_id) : null
    const teacherId = entry.teacher_id ? Number(entry.teacher_id) : null
    const roomId = entry.room_id ? Number(entry.room_id) : null
    const activity = String(entry.activity || '').trim().slice(0, 100) || null
    if (subjectId) {
      if (!teacherId || !roomId || activity) throw Object.assign(new Error('Instruction rows require one subject, teacher, and room.'), { statusCode: 400 })
      const assignedTeacher = subjectTeachers.get(subjectId)
      if (assignedTeacher && assignedTeacher !== teacherId) throw Object.assign(new Error('Each subject must use the same assigned teacher for this section.'), { statusCode: 400 })
      subjectTeachers.set(subjectId, teacherId)
    } else if (teacherId || roomId || !activity) {
      throw Object.assign(new Error('Break/lunch rows need an activity name and no teacher or room.'), { statusCode: 400 })
    }
    normalized.push({
      section_id: section.section_id,
      day_of_week: day,
      start_time: time,
      duration_minutes: 45,
      subject_id: subjectId,
      activity,
      teacher_id: teacherId,
      room_id: roomId,
      status
    })
  }
  return normalized
}

module.exports = { gradeNumber, normalizeEntries }
