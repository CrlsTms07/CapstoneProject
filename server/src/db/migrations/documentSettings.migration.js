// HIPO 7.0 – Export PDF/CSV (database layer)
// Startup migration: printed class-program settings per department, edited by the admin
// (never hardcoded – CLAUDE.md "Scheduling Rules").
//   header_lines  – the lines above the title, e.g. "Republic of the Philippines", school name, address
//   signatories   – [{ label, name, position }], e.g. { "Prepared by", "PAULINA C. CAS", "Head Teacher III" }
//   deped_orders  – DepEd Order references, e.g. "DO 10, s. 2024"
//   doc_ref_code, revision – the form's document control box, e.g. "SCH-OSH-F002", "00"
// Additive only.
const pool = require('../../config/database')

const DOCUMENT_SETTINGS_SQL = `
    CREATE TABLE IF NOT EXISTS document_settings (
        department_id INT PRIMARY KEY REFERENCES departments(department_id) ON UPDATE CASCADE ON DELETE CASCADE,
        header_lines TEXT[] NOT NULL DEFAULT '{}',
        signatories JSONB NOT NULL DEFAULT '[]'::JSONB,
        deped_orders TEXT[] NOT NULL DEFAULT '{}',
        doc_ref_code VARCHAR(40),
        revision VARCHAR(10),
        updated_by INT REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT document_settings_signatories_array CHECK (jsonb_typeof(signatories) = 'array'),
        CONSTRAINT document_settings_header_limit CHECK (COALESCE(array_length(header_lines, 1), 0) <= 10),
        CONSTRAINT document_settings_signatory_limit CHECK (jsonb_array_length(signatories) <= 8),
        CONSTRAINT document_settings_order_limit CHECK (COALESCE(array_length(deped_orders, 1), 0) <= 10)
    );
`

const ensureDocumentSettingsSchema = async () => {
  await pool.query(DOCUMENT_SETTINGS_SQL)
}

module.exports = { ensureDocumentSettingsSchema }
