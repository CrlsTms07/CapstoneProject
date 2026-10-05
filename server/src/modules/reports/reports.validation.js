// HIPO 6.0 – Reports
// Pure checks for GET /api/reports/:type (report type, required ids, output format).
const { HttpError } = require('../../utils/httpError')
const { requireId } = require('../schedules/schedules.validation')

const FORMATS = ['json', 'csv', 'pdf']

// Which query parameter each "needs" value reads, and the service parameter it fills.
const NEEDED_IDS = { section_id: 'sectionId', teacher_id: 'teacherId', room_id: 'roomId' }

const readReportRequest = (type, query, reportTypes) => {
  const definition = reportTypes[type]
  if (!definition) throw new HttpError(400, `Unknown report. Use one of: ${Object.keys(reportTypes).join(', ')}.`)
  const format = String(query.format || 'json').toLowerCase()
  if (!FORMATS.includes(format)) throw new HttpError(400, `format must be one of: ${FORMATS.join(', ')}.`)
  const params = { termId: requireId(query.term_id, 'term_id') }
  if (definition.needs) params[NEEDED_IDS[definition.needs]] = requireId(query[definition.needs], definition.needs)
  return { format, params }
}

// "Class Program – Grade 7 - Rizal" -> "Class-Program-Grade-7-Rizal"
const fileNameFor = report => report.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')

module.exports = { FORMATS, readReportRequest, fileNameFor }
