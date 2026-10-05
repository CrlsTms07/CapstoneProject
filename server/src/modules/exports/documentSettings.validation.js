// HIPO 7.0 – Export PDF/CSV
// Pure request checks for document settings (no database): header lines, signatories,
// DepEd Order references, doc ref code and revision. Limits match documentSettings.migration.js.
const { HttpError } = require('../../utils/httpError')

const LIMITS = {
  headerLines: 10, headerLineLength: 200,
  signatories: 8, labelLength: 60, nameLength: 120, positionLength: 120,
  depedOrders: 10, depedOrderLength: 100,
  docRefCodeLength: 40, revisionLength: 10
}

const requireDepartmentId = value => {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Department id must be a positive whole number.')
  return id
}

// Optional short text: trimmed; blank -> null.
const optionalText = (value, label, maxLength) => {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw new HttpError(400, `${label} must be text.`)
  const text = value.trim()
  if (text.length > maxLength) throw new HttpError(400, `${label} must be at most ${maxLength} characters.`)
  return text || null
}

// A list of short text lines; blank lines are dropped.
const textList = (value, label, maxItems, maxLength) => {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new HttpError(400, `${label} must be a list.`)
  const lines = value.map((item, index) => {
    if (typeof item !== 'string') throw new HttpError(400, `${label} #${index + 1} must be text.`)
    const text = item.trim()
    if (text.length > maxLength) throw new HttpError(400, `${label} #${index + 1} must be at most ${maxLength} characters.`)
    return text
  }).filter(Boolean)
  if (lines.length > maxItems) throw new HttpError(400, `${label}: at most ${maxItems} lines.`)
  return lines
}

// [{ label, name, position }] – label is required ("Prepared by"), name and position may be blank.
const normalizeSignatories = value => {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new HttpError(400, 'signatories must be a list.')
  if (value.length > LIMITS.signatories) throw new HttpError(400, `At most ${LIMITS.signatories} signatories.`)
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, `Signatory #${index + 1} must be an object.`)
    const label = optionalText(item.label, `Signatory #${index + 1} label`, LIMITS.labelLength)
    if (!label) throw new HttpError(400, `Signatory #${index + 1} needs a label such as "Prepared by".`)
    return {
      label,
      name: optionalText(item.name, `Signatory #${index + 1} name`, LIMITS.nameLength) || '',
      position: optionalText(item.position, `Signatory #${index + 1} position`, LIMITS.positionLength) || ''
    }
  })
}

const normalizeDocumentSettings = body => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'The request body must be an object.')
  return {
    header_lines: textList(body.header_lines, 'Header line', LIMITS.headerLines, LIMITS.headerLineLength),
    signatories: normalizeSignatories(body.signatories),
    deped_orders: textList(body.deped_orders, 'DepEd Order reference', LIMITS.depedOrders, LIMITS.depedOrderLength),
    doc_ref_code: optionalText(body.doc_ref_code, 'Doc ref code', LIMITS.docRefCodeLength),
    revision: optionalText(body.revision, 'Revision', LIMITS.revisionLength)
  }
}

module.exports = { LIMITS, requireDepartmentId, normalizeSignatories, normalizeDocumentSettings }
