// Shared – HTTP errors and one place that turns any error into a JSON response.
//
// Services throw `new HttpError(409, 'message', { conflicts })`; controllers call sendError(res, error).
// PostgreSQL errors are translated into readable messages here:
//   23P01 exclusion violation  -> 409 (double booking caught by the database safety net)
//   23001 restrict violation   -> 409 (record is still used, ON DELETE RESTRICT)
//   23503 foreign key, DELETE  -> 409 (record is still used, ON DELETE NO ACTION – the older tables)
//   23503 foreign key, INSERT  -> 400 (a selected record does not exist)
//   23505 unique violation     -> 409
//   23514 check violation      -> 400

class HttpError extends Error {
  constructor (status, message, details = {}) {
    super(message)
    this.status = status
    this.details = details
  }
}

// Exclusion constraints on schedule_entries (scheduleConflictGuards.migration.js).
const OVERLAP_MESSAGES = {
  schedule_entries_teacher_no_overlap: 'The teacher is already scheduled at an overlapping time.',
  schedule_entries_room_no_overlap: 'The room is already used at an overlapping time.',
  schedule_entries_section_no_overlap: 'The section already has a class at an overlapping time.'
}

// Friendly names for tables that appear in "still used by" messages.
const TABLE_LABELS = {
  schedule_entries: 'schedule entries',
  entry_teachers: 'schedule entries',
  time_templates: 'time templates',
  document_settings: 'document settings',
  approval_logs: 'approval history',
  class_program_headers: 'class programs',
  schedules: 'schedules',
  jhs_class_program_entries: 'class programs',
  jhs_class_programs: 'class programs',
  sections: 'sections',
  subjects: 'subjects',
  teachers: 'teachers',
  rooms: 'rooms',
  grade_levels: 'grade levels',
  users: 'user accounts'
}

// "update or delete on table "teachers" violates foreign key constraint ... on table "schedule_entries""
const referencingTable = error => {
  const match = /on table "([^"]+)"\s*$/.exec(error.message || '')
  return match ? match[1] : error.table
}

const fromDatabaseError = (error, { action } = {}) => {
  if (error.code === '23P01') {
    return new HttpError(409, OVERLAP_MESSAGES[error.constraint] || 'This schedule overlaps another schedule.', { code: 'SCHEDULE_CONFLICT' })
  }
  if (error.code === '23001' || error.code === '23503') {
    const isDelete = error.code === '23001' || action === 'delete' || /^update or delete on table/.test(error.message || '')
    if (isDelete) {
      const usedBy = TABLE_LABELS[referencingTable(error)] || 'other records'
      return new HttpError(409, `This record cannot be deleted because it is still used by ${usedBy}. Remove or reassign those first.`, { code: 'DELETE_RESTRICTED' })
    }
    return new HttpError(400, 'A selected record (section, subject, teacher, room or term) does not exist.', { code: 'INVALID_REFERENCE' })
  }
  if (error.code === '23505') return new HttpError(409, 'A record with the same details already exists.', { code: 'DUPLICATE' })
  if (error.code === '23514') return new HttpError(400, 'The data breaks a database rule (check the times and required fields).', { code: 'INVALID_DATA' })
  if (error.code === '22P02') return new HttpError(400, 'An id or value has the wrong format.', { code: 'INVALID_DATA' })
  return null
}

const sendError = (res, error, options) => {
  const httpError = error instanceof HttpError ? error : fromDatabaseError(error, options)
  if (httpError) return res.status(httpError.status).json({ error: httpError.message, ...httpError.details })
  console.error(error)
  return res.status(500).json({ error: 'Something went wrong on the server.' })
}

// Wraps an async controller so every thrown error goes through sendError.
const handle = (controller, options) => async (req, res) => {
  try {
    await controller(req, res)
  } catch (error) {
    sendError(res, error, options)
  }
}

module.exports = { HttpError, fromDatabaseError, sendError, handle }
