// HIPO 6.0 / 7.0 – Reports and exports (unit tests)
// The CSV and PDF exporters and the report request checks – no database.
require('../helpers/unitTestEnv')
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { toCsv, csvValue } = require('../../src/modules/exports/csvExport.service')
const { toPdf } = require('../../src/modules/exports/pdfExport.service')
const { readReportRequest, fileNameFor } = require('../../src/modules/reports/reports.validation')

const sampleReport = rows => ({
  title: 'Class Program – Grade 7 - Rizal',
  subtitle: 'S.Y. 2026-2027 · Full Year',
  columns: [{ key: 'day', label: 'Day' }, { key: 'subject', label: 'Subject / Activity' }],
  rows
})

describe('CSV exporter', () => {
  it('quotes commas, quotes and line breaks', () => {
    assert.equal(csvValue('Math'), 'Math')
    assert.equal(csvValue('Room 1, Annex'), '"Room 1, Annex"')
    assert.equal(csvValue('the "new" room'), '"the ""new"" room"')
    assert.equal(csvValue(null), '')
  })

  it('writes a header row and one line per row, Excel-friendly', () => {
    const csv = toCsv(sampleReport([{ day: 'Monday', subject: 'Math, Advanced' }, { day: 'Tuesday', subject: 'Español' }]))
    assert.ok(csv.startsWith('﻿'), 'UTF-8 byte-order mark')
    assert.equal(csv.slice(1), 'Day,Subject / Activity\r\nMonday,"Math, Advanced"\r\nTuesday,Español\r\n')
  })
})

describe('PDF exporter', () => {
  it('produces a PDF file, also across several pages', async () => {
    const rows = Array.from({ length: 120 }, (_, index) => ({ day: 'Monday', subject: `Subject ${index}` }))
    const pdf = await toPdf(sampleReport(rows))
    assert.ok(Buffer.isBuffer(pdf))
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
    assert.ok((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length > 1, 'more than one page')
  })

  it('still produces a PDF for an empty report', async () => {
    assert.equal((await toPdf(sampleReport([]))).subarray(0, 5).toString(), '%PDF-')
  })
})

describe('report request checks', () => {
  const types = { section: { needs: 'section_id' }, 'teacher-load': { needs: null } }

  it('reads the format and the id the report needs', () => {
    assert.deepEqual(readReportRequest('section', { term_id: '1', section_id: '4', format: 'PDF' }, types), { format: 'pdf', params: { termId: 1, sectionId: 4 } })
    assert.deepEqual(readReportRequest('teacher-load', { term_id: '1' }, types), { format: 'json', params: { termId: 1 } })
  })

  it('rejects unknown reports, formats and missing ids', () => {
    assert.throws(() => readReportRequest('grades', { term_id: 1 }, types), /Unknown report/)
    assert.throws(() => readReportRequest('section', { term_id: 1, section_id: 2, format: 'xlsx' }, types), /format must be one of/)
    assert.throws(() => readReportRequest('section', { term_id: 1 }, types), /section_id is required/)
  })

  it('makes a safe file name from the title', () => {
    assert.equal(fileNameFor({ title: 'Class Program – Grade 7 - Rizal' }), 'Class-Program-Grade-7-Rizal')
  })
})
