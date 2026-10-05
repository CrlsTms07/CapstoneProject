// HIPO 3.2 – Schedule Plotter (unit tests)
// Auto-Generate Draft planner (autoGenerate.service.js) against an in-memory school.
require('../helpers/unitTestEnv')
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { buildPeriodGrid, dayGroupsFor, planSectionWeek } = require('../../src/modules/schedules/autoGenerate.service')
const { detectConflictsForEntries, DEFAULT_TIME_RULES } = require('../../src/modules/schedules/conflict.service')
const { IDS, makeContext, savedEntry } = require('../helpers/sampleContext')

const qualifiedFor = pairs => {
  const map = new Map()
  pairs.forEach(([subjectId, teacherId]) => map.set(subjectId, [...(map.get(subjectId) || []), teacherId]))
  return map
}
const ALL_QUALIFIED = qualifiedFor([[IDS.math7, IDS.cruz], [IDS.english7, IDS.santos], [IDS.science7, IDS.santos], [IDS.science7, IDS.cruz]])
const countBy = (items, key) => items.reduce((counts, item) => ({ ...counts, [key(item)]: (counts[key(item)] || 0) + 1 }), {})

describe('buildPeriodGrid', () => {
  it('splits the school day into whole periods for every allowed day', () => {
    const grid = buildPeriodGrid({ period_minutes: 45, day_start_min: 420, day_end_min: 600, allowed_days: ['Monday', 'Friday'] })
    assert.equal(grid.length, 8) // 07:00–10:00 = 4 periods × 2 days
    assert.deepEqual(grid[0], { day_of_week: 'Monday', start_min: 420, end_min: 465 })
    assert.deepEqual(grid.at(-1), { day_of_week: 'Friday', start_min: 555, end_min: 600 })
    assert.equal(buildPeriodGrid(DEFAULT_TIME_RULES.JHS).length, 13 * 5)
  })
})

describe('dayGroupsFor', () => {
  it('groups Monday–Thursday for Junior High (DepEd class-program layout) and keeps days apart for Senior High', () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    assert.deepEqual(dayGroupsFor('JHS', days), [['Monday', 'Tuesday', 'Wednesday', 'Thursday'], ['Friday']])
    assert.deepEqual(dayGroupsFor('SHS', days), [['Monday'], ['Tuesday'], ['Wednesday'], ['Thursday'], ['Friday']])
  })
})

describe('planSectionWeek', () => {
  it('places every needed period and the result has no conflicts', () => {
    const context = makeContext()
    const { generated, unfilled } = planSectionWeek({ termId: 1, sectionId: IDS.rizal, context, qualified: ALL_QUALIFIED })
    assert.deepEqual(unfilled, [])
    assert.deepEqual(countBy(generated, entry => entry.subject_id), { [IDS.math7]: 4, [IDS.english7]: 4, [IDS.science7]: 4 })
    assert.deepEqual(detectConflictsForEntries(generated, context).conflicts, [])
  })

  it('puts a Junior High subject at the same time Monday to Thursday', () => {
    const { generated } = planSectionWeek({ termId: 1, sectionId: IDS.rizal, context: makeContext(), qualified: ALL_QUALIFIED })
    const math = generated.filter(entry => entry.subject_id === IDS.math7)
    assert.deepEqual(math.map(entry => entry.day_of_week), ['Monday', 'Tuesday', 'Wednesday', 'Thursday'])
    assert.equal(new Set(math.map(entry => entry.start_min)).size, 1)
  })

  it('spreads a Senior High subject over different days in 60-minute periods', () => {
    const { generated, unfilled } = planSectionWeek({ termId: 1, sectionId: IDS.stemA, context: makeContext(), qualified: new Map([[IDS.genMath, [IDS.reyes]]]) })
    assert.deepEqual(unfilled, [])
    assert.deepEqual(generated.map(entry => entry.day_of_week), ['Monday', 'Tuesday', 'Wednesday', 'Thursday'])
    assert.ok(generated.every(entry => entry.end_min - entry.start_min === 60))
  })

  it('works around a busy teacher and the section\'s existing rows', () => {
    const cruzBusyMonday = savedEntry({ section_id: IDS.mabini, room_id: IDS.r102, day_of_week: 'Monday', start_min: 420, end_min: 1020 })
    const rizalBreak = savedEntry({ section_id: IDS.rizal, subject_id: null, teacher_id: null, room_id: null, activity: 'BREAK', day_of_week: 'Tuesday', start_min: 420, end_min: 465 })
    const context = makeContext({ existingEntries: [cruzBusyMonday, rizalBreak] })
    const { generated } = planSectionWeek({ termId: 1, sectionId: IDS.rizal, context, qualified: ALL_QUALIFIED })
    assert.ok(!generated.some(entry => entry.teacher_id === IDS.cruz && entry.day_of_week === 'Monday'))
    assert.ok(!generated.some(entry => entry.day_of_week === 'Tuesday' && entry.start_min === 420))
    assert.deepEqual(detectConflictsForEntries(generated, context).conflicts, [])
  })

  it('only adds what is missing and keeps the teacher the section already has for a subject', () => {
    const existing = [1, 2, 3].map(index => savedEntry({ teacher_id: IDS.cruz, subject_id: IDS.science7, day_of_week: ['Monday', 'Tuesday', 'Wednesday'][index - 1], start_min: 420, end_min: 465 }))
    const { generated } = planSectionWeek({ termId: 1, sectionId: IDS.rizal, context: makeContext({ existingEntries: existing }), qualified: ALL_QUALIFIED })
    const science = generated.filter(entry => entry.subject_id === IDS.science7)
    assert.equal(science.length, 1)
    assert.equal(science[0].day_of_week, 'Friday', 'one period is missing, so it goes in a Friday slot')
    assert.equal(science[0].teacher_id, IDS.cruz, 'Santos is also qualified, but Cruz already teaches Science 7 to Rizal')
  })

  it('reports subjects it cannot place, with the reason', () => {
    const qualified = qualifiedFor([[IDS.math7, IDS.cruz]])
    const { unfilled } = planSectionWeek({ termId: 1, sectionId: IDS.rizal, context: makeContext(), qualified })
    assert.deepEqual(unfilled.map(item => [item.subject_name, item.missing_periods]), [['English 7', 4], ['Science 7', 4]])
    assert.match(unfilled[0].reason, /No teacher is marked as qualified/)
  })

  it('stops at the teacher load limit instead of overloading', () => {
    const context = makeContext({ teacherOverrides: { [IDS.cruz]: { weekly_load_minutes: 90 } } })
    const { generated, unfilled } = planSectionWeek({ termId: 1, sectionId: IDS.rizal, context, qualified: qualifiedFor([[IDS.math7, IDS.cruz]]) })
    assert.equal(generated.filter(entry => entry.subject_id === IDS.math7).length, 2)
    assert.deepEqual(unfilled.find(item => item.subject_name === 'Math 7').missing_periods, 2)
  })
})
