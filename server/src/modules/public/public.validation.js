// HIPO 10.0 – Guest schedule view
// Query-string checks for the guest endpoints (all filters are optional ids).
const { positiveIdOrNull } = require('../schedules/schedules.validation')

const readScheduleFilters = query => ({
  termId: positiveIdOrNull(query.term_id),
  departmentId: positiveIdOrNull(query.department_id),
  sectionId: positiveIdOrNull(query.section_id)
})

module.exports = { readScheduleFilters }
