// HIPO 3.3 / 3.4 / 4.1 / 7.0 (unit tests)
// Pure request checks for subjects (color, weekly minutes), sections (adviser, co-adviser, strand),
// qualified subjects and document settings. No database.
require('../helpers/unitTestEnv')
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { normalizeSubject } = require('../../src/modules/subjects/subjects.validation')
const { normalizeSection } = require('../../src/modules/sections/sections.validation')
const { normalizeSubjectIds } = require('../../src/modules/teachers/teachers.validation')
const { normalizeDocumentSettings } = require('../../src/modules/exports/documentSettings.validation')

const rejects = (fn, message) => assert.throws(fn, error => error.status === 400 && message.test(error.message), message.source)

describe('normalizeSubject', () => {
  it('accepts a color and weekly minutes, and normalizes them', () => {
    assert.deepEqual(normalizeSubject({ subject_name: ' Enhanced Mathematics ', grade_level_id: '7', color: '#3b82f6', weekly_minutes: '400' }),
      { subject_name: 'Enhanced Mathematics', grade_level_id: 7, color: '#3B82F6', weekly_minutes: 400 })
  })

  it('keeps color / weekly minutes unchanged when left out, and clears them when blank', () => {
    const kept = normalizeSubject({ subject_name: 'AP', grade_level_id: 7 })
    assert.equal(kept.color, undefined)
    assert.equal(kept.weekly_minutes, undefined)
    const cleared = normalizeSubject({ subject_name: 'AP', grade_level_id: 7, color: '', weekly_minutes: null })
    assert.deepEqual([cleared.color, cleared.weekly_minutes], [null, null])
  })

  it('rejects bad values with readable messages', () => {
    rejects(() => normalizeSubject({ grade_level_id: 7 }), /subject_name is required/)
    rejects(() => normalizeSubject({ subject_name: 'x'.repeat(101), grade_level_id: 7 }), /at most 100 characters/)
    rejects(() => normalizeSubject({ subject_name: 'AP', grade_level_id: 'seven' }), /grade_level_id is required/)
    rejects(() => normalizeSubject({ subject_name: 'AP', grade_level_id: 7, color: 'blue' }), /hex color/)
    rejects(() => normalizeSubject({ subject_name: 'AP', grade_level_id: 7, color: '#12345' }), /hex color/)
    rejects(() => normalizeSubject({ subject_name: 'AP', grade_level_id: 7, weekly_minutes: 0 }), /1 to 3000/)
    rejects(() => normalizeSubject({ subject_name: 'AP', grade_level_id: 7, weekly_minutes: 3001 }), /1 to 3000/)
    rejects(() => normalizeSubject({ subject_name: 'AP', grade_level_id: 7, weekly_minutes: 45.5 }), /whole number/)
  })
})

describe('normalizeSection', () => {
  it('accepts an adviser, a co-adviser and a strand (upper-cased)', () => {
    assert.deepEqual(normalizeSection({ section_name: ' ABM 12-1 ', grade_level_id: 12, adviser_id: '4', co_adviser_id: 5, strand: ' abm ' }),
      { section_name: 'ABM 12-1', grade_level_id: 12, adviser_id: 4, co_adviser_id: 5, strand: 'ABM' })
  })

  it('keeps fields left out unchanged and clears blank ones', () => {
    const section = normalizeSection({ section_name: 'Honesty', grade_level_id: 7, adviser_id: '' })
    assert.deepEqual([section.adviser_id, section.co_adviser_id, section.strand], [null, undefined, undefined])
  })

  it('rejects bad values with readable messages', () => {
    rejects(() => normalizeSection({ grade_level_id: 7 }), /section_name is required/)
    rejects(() => normalizeSection({ section_name: 'A', grade_level_id: 7, adviser_id: 4, co_adviser_id: 4 }), /must be different teachers/)
    rejects(() => normalizeSection({ section_name: 'A', grade_level_id: 7, adviser_id: -1 }), /adviser_id must be a teacher id/)
    rejects(() => normalizeSection({ section_name: 'A', grade_level_id: 12, strand: 'A'.repeat(31) }), /strand must be up to 30/)
    rejects(() => normalizeSection({ section_name: 'A', grade_level_id: 12, strand: '<script>' }), /strand must be up to 30/)
  })
})

describe('normalizeSubjectIds', () => {
  it('accepts a list of distinct ids (empty clears the list)', () => {
    assert.deepEqual(normalizeSubjectIds({ subject_ids: ['3', 5] }), [3, 5])
    assert.deepEqual(normalizeSubjectIds({ subject_ids: [] }), [])
  })

  it('rejects anything else', () => {
    rejects(() => normalizeSubjectIds({}), /must be a list/)
    rejects(() => normalizeSubjectIds({ subject_ids: [3, 3] }), /listed twice/)
    rejects(() => normalizeSubjectIds({ subject_ids: [0] }), /positive whole number/)
    rejects(() => normalizeSubjectIds({ subject_ids: Array.from({ length: 61 }, (_, index) => index + 1) }), /at most 60/)
  })
})

describe('normalizeDocumentSettings', () => {
  it('trims text, drops blank lines and keeps the signatory order', () => {
    const settings = normalizeDocumentSettings({
      header_lines: [' Republic of the Philippines ', '', 'Department of Education'],
      signatories: [{ label: 'Prepared by', name: ' PAULINA C. CAS ', position: 'Head Teacher III' }, { label: 'Conforme' }],
      deped_orders: ['DO 10, s. 2024', ' '],
      doc_ref_code: ' SCH-OSH-F002 ',
      revision: ''
    })
    assert.deepEqual(settings, {
      header_lines: ['Republic of the Philippines', 'Department of Education'],
      signatories: [{ label: 'Prepared by', name: 'PAULINA C. CAS', position: 'Head Teacher III' }, { label: 'Conforme', name: '', position: '' }],
      deped_orders: ['DO 10, s. 2024'],
      doc_ref_code: 'SCH-OSH-F002',
      revision: null
    })
  })

  it('rejects bad shapes and over-long values', () => {
    rejects(() => normalizeDocumentSettings([]), /must be an object/)
    rejects(() => normalizeDocumentSettings({ header_lines: 'one line' }), /Header line must be a list/)
    rejects(() => normalizeDocumentSettings({ header_lines: Array(11).fill('x') }), /at most 10 lines/)
    rejects(() => normalizeDocumentSettings({ header_lines: ['x'.repeat(201)] }), /Header line #1 must be at most 200/)
    rejects(() => normalizeDocumentSettings({ signatories: [{ name: 'No label' }] }), /needs a label/)
    rejects(() => normalizeDocumentSettings({ signatories: Array(9).fill({ label: 'x' }) }), /At most 8 signatories/)
    rejects(() => normalizeDocumentSettings({ signatories: ['Prepared by'] }), /must be an object/)
    rejects(() => normalizeDocumentSettings({ deped_orders: [42] }), /DepEd Order reference #1 must be text/)
    rejects(() => normalizeDocumentSettings({ doc_ref_code: 'x'.repeat(41) }), /Doc ref code must be at most 40/)
    rejects(() => normalizeDocumentSettings({ revision: 3 }), /Revision must be text/)
  })
})
