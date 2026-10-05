// HIPO 6.0 – Reports (with HIPO 7.0 exports)
// GET /api/reports/:type?term_id=&...&format=json|csv|pdf – one data query per report type
// (reports.service.js); CSV and PDF are only two ways of writing that same data.
const { handle } = require('../../utils/httpError')
const { REPORT_TYPES, buildReport } = require('./reports.service')
const { readReportRequest, fileNameFor } = require('./reports.validation')
const { toCsv } = require('../exports/csvExport.service')
const { toPdf } = require('../exports/pdfExport.service')

const getReport = handle(async (req, res) => {
  const { format, params } = readReportRequest(req.params.type, req.query, REPORT_TYPES)
  const report = await buildReport(req.params.type, { ...params, scope: req.scope })

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${fileNameFor(report)}.csv"`)
    return res.send(toCsv(report))
  }
  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${fileNameFor(report)}.pdf"`)
    return res.send(await toPdf(report))
  }
  res.json(report)
})

// GET /api/reports – the report types the page can offer and the id each one needs.
const getReportTypes = (req, res) => {
  res.json(Object.entries(REPORT_TYPES).map(([type, definition]) => ({ type, needs: definition.needs })))
}

module.exports = { getReport, getReportTypes }
