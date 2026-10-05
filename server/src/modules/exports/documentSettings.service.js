// HIPO 7.0 – Export PDF/CSV
// Data access for document_settings: the printed class-program header, signatories, DepEd Order
// references, doc ref code and revision of each department. A department without a saved row
// gets empty settings (nothing is hardcoded).
const pool = require('../../config/database')
const { HttpError } = require('../../utils/httpError')

const SETTINGS_SELECT = `
  SELECT d.department_id, d.department_name,
         COALESCE(ds.header_lines, '{}') AS header_lines,
         COALESCE(ds.signatories, '[]'::JSONB) AS signatories,
         COALESCE(ds.deped_orders, '{}') AS deped_orders,
         ds.doc_ref_code, ds.revision, ds.updated_at,
         COALESCE(u.full_name, u.username) AS updated_by_name
  FROM departments d
  LEFT JOIN document_settings ds ON ds.department_id = d.department_id
  LEFT JOIN users u ON u.user_id = ds.updated_by
`

const listDocumentSettings = async () => (await pool.query(`${SETTINGS_SELECT} ORDER BY d.department_name`)).rows

const getDocumentSettings = async departmentId => {
  const row = (await pool.query(`${SETTINGS_SELECT} WHERE d.department_id = $1`, [departmentId])).rows[0]
  if (!row) throw new HttpError(404, 'Department not found.')
  return row
}

const saveDocumentSettings = async (departmentId, settings, userId) => {
  const department = await pool.query('SELECT 1 FROM departments WHERE department_id = $1', [departmentId])
  if (!department.rowCount) throw new HttpError(404, 'Department not found.')
  await pool.query(`
    INSERT INTO document_settings (department_id, header_lines, signatories, deped_orders, doc_ref_code, revision, updated_by, updated_at)
    VALUES ($1, $2, $3::JSONB, $4, $5, $6, $7, NOW())
    ON CONFLICT (department_id) DO UPDATE SET
      header_lines = EXCLUDED.header_lines, signatories = EXCLUDED.signatories, deped_orders = EXCLUDED.deped_orders,
      doc_ref_code = EXCLUDED.doc_ref_code, revision = EXCLUDED.revision,
      updated_by = EXCLUDED.updated_by, updated_at = NOW()
  `, [departmentId, settings.header_lines, JSON.stringify(settings.signatories), settings.deped_orders,
    settings.doc_ref_code, settings.revision, userId])
  return getDocumentSettings(departmentId)
}

module.exports = { listDocumentSettings, getDocumentSettings, saveDocumentSettings }
