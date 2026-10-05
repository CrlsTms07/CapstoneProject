// HIPO 7.0 – Export PDF/CSV
// HTTP handlers for /api/document-settings (printed class-program settings per department).
const { handle } = require('../../utils/httpError')
const service = require('./documentSettings.service')
const { requireDepartmentId, normalizeDocumentSettings } = require('./documentSettings.validation')

// GET /api/document-settings – every department with its settings.
const getAllDocumentSettings = handle(async (req, res) => {
  res.json(await service.listDocumentSettings())
})

// GET /api/document-settings/:departmentId
const getDocumentSettings = handle(async (req, res) => {
  res.json(await service.getDocumentSettings(requireDepartmentId(req.params.departmentId)))
})

// PUT /api/document-settings/:departmentId – { header_lines, signatories, deped_orders, doc_ref_code, revision }
const saveDocumentSettings = handle(async (req, res) => {
  const departmentId = requireDepartmentId(req.params.departmentId)
  const settings = normalizeDocumentSettings(req.body)
  res.json(await service.saveDocumentSettings(departmentId, settings, req.session.user.user_id))
})

module.exports = { getAllDocumentSettings, getDocumentSettings, saveDocumentSettings }
