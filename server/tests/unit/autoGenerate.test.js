// HIPO 3.2 – Schedule Plotter (unit tests)
// Auto-Generate Draft planner (autoGenerate.service.js) against an in-memory school that uses the
// seeded Grade 7 and Grade 12 time templates (CLAUDE.md "Scheduling Rules").
require('../helpers/unitTestEnv')
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { buildPlacements, planSectionWeek } = require('../../src/modules/schedules/autoGenerate.service')
const { detectConflictsForEntries } = require('../../src/modules/schedules/conflict.service')
const { IDS, GRADE_7_TEMPLATE, SHS_TEMPLATE, makeContext, savedEntry } = require('../helpers/sampleContext')

const qualifiedFor = pairs => {
  const map = new Map()
  pairs.forEach(([subjectId, teacherId]) => map.set(subjectId, [...(map.get(subjectId) || []), teacherId]))
  return map
}
const ALL_QUALIFIED = qualifiedFor([[IDS.math7, IDS.cruz], [IDS.english7, IDS.santos], [IDS.science7, IDS.santos], [IDS.science7, IDS.cruz]])
// Enhanced Math: 80 minutes every day (4 × 80 + 80); English and Science: 4 × 45 + 40.
const GRADE_7_MINUTES = { [IDS.math7]: 400, [IDS.english7]: 220, [IDS.science7]: 220 }
const jhsContext = (extra = {}) => makeContext({ templates: [GRADE_7_TEMPLATE], subjectMinutes: GRADE_7_MINUTES, ...extra })
const minutesOf = entries => entries.reduce((total, entry) => total + entry.end_min - entry.start_min, 0)

describe('buildPlacements', () => {
  it('pairs the n-th Monday–Thursday period with the n-th Friday period (Junior High)', () => {
    const placements = buildPlacements(GRADE_7_TEMPLATE, 'JHS')
    assert.equal(placements.length, 11) // 10 paired periods + Friday HGP
    assert.deepEqual(placements[0].parts.map(part => [part.day_of_week, part.start_min, part.end_min]), [
      ['Monday', 390, 435], ['Tuesday', 390, 435], ['Wednesday', 390, 435], ['Thursday', 390, 435], ['Friday', 390, 430]
    ])
    assert.equal(placements[0].minutes, 220)
    assert.equal(placements[2].minutes, 400, '08:00–09:20 Mon–Thu + 07:50–09:10 Friday')
    assert.deepEqual(placements.at(-1).parts, [{ day_of_week: 'Friday', start_min: 950, end_min: 990 }], 'HGP stands alone')
  })

  it('offers 2-hour and 1-hour blocks per day for Senior High, keeping the asynchronous window', () => {
    const placements = buildPlacements(SHS_TEMPLATE, 'SHS')
    const monday = placements.filter(item => item.parts[0].day_of_week === 'Monday')
    assert.deepEqual(monday.filter(item => item.minutes === 120).map(item => item.parts[0].start_min), [570, 750, 900, 1020])
    assert.equal(monday.filter(item => item.minutes === 60).length, 8)
    assert.equal(monday.find(item => item.parts[0].start_min === 570).parts[0].delivery_mode, 'asynchronous')
    assert.equal(monday.find(item => item.parts[0].start_min === 750).parts[0].delivery_mode, 'face_to_face')
  })
})

describe('planSectionWeek – Junior High', () => {
  it('fills each subject\'s weekly minutes with template periods, conflict-free', () => {
    const context = jhsContext()
    const { generated, unfilled } = planSectionWeek({ termId: 1, sectionId: IDS.rizal, context, qualified: ALL_QUALIFIED })
    assert.deepEqual(unfilled, [])
    for (const [subjectId, minutes] of Object.entries(GRADE_7_MINUTES)) {
      assert.equal(minutesOf(generated.filter(entry => entry.subject_id === Number(subjectId))), minutes)
    }
    assert.deepEqual(detectConflictsForEntries(generated, context).conflicts, [])
  })

  it('keeps a subject at the same place every day: Mon–Thu at one time, Friday in the matching period', () => {
    const { generated } = planSectionWeek({ termId: 1, sectionId: IDS.rizal, context: jhsContext(), qualified: ALL_QUALIFIED })
    const math = generated.filter(entry => entry.subject_id === IDS.math7)
    assert.deepEqual(math.map(entry => entry.day_of_week), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
    assert.deepEqual(math.map(entry => entry.end_min - entry.start_min), [80, 80, 80, 80, 80], 'Enhanced Math gets an 80-minute period')
    assert.equal(new Set(math.slice(0, 4).map(entry => entry.start_min)).size, 1)
  })

  it('works around a busy teacher and the section\'s existing rows', () => {
    // Cruz teaches Mabini in every 80-minute Monday period; Rizal already has 06:30–07:15 on Tuesday.
    const cruzBusy = [480, 625, 770].map(start => savedEntry({ section_id: IDS.mabini, room_id: IDS.r102, day_of_week: 'Monday', start_min: start, end_min: start + 80 }))
    const rizalRow = savedEntry({ section_id: IDS.rizal, subject_id: null, teacher_id: null, room_id: null, activity: 'FLAG CEREMONY', day_of_week: 'Tuesday', start_min: 390, end_min: 435 })
    const context = jhsContext({ existingEntries: [...cruzBusy, rizalRow] })
    const { generated } = planSectionWeek({ termId: 1, sectionId: IDS.rizal, context, qualified: ALL_QUALIFIED })
    assert.ok(!generated.some(entry => entry.teacher_id === IDS.cruz && entry.day_of_week === 'Monday' && entry.end_min - entry.start_min === 80))
    assert.ok(!generated.some(entry => entry.day_of_week === 'Tuesday' && entry.start_min === 390))
    assert.deepEqual(detectConflictsForEntries(generated, context).conflicts, [])
  })

  it('only adds what is missing and keeps the teacher the section already has for a subject', () => {
    const existing = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'].map(day => savedEntry({ teacher_id: IDS.cruz, subject_id: IDS.science7, day_of_week: day, start_min: 390, end_min: 435 }))
    const { generated } = planSectionWeek({ termId: 1, sectionId: IDS.rizal, context: jhsContext({ existingEntries: existing }), qualified: ALL_QUALIFIED })
    const science = generated.filter(entry => entry.subject_id === IDS.science7)
    assert.deepEqual(science.map(entry => [entry.day_of_week, entry.end_min - entry.start_min]), [['Friday', 40]], '180 of 220 minutes exist; one 40-minute Friday period is missing')
    assert.equal(science[0].teacher_id, IDS.cruz, 'Santos is also qualified, but Cruz already teaches Science 7 to Rizal')
  })

  it('reports subjects it cannot place, with the reason', () => {
    const { unfilled } = planSectionWeek({ termId: 1, sectionId: IDS.rizal, context: jhsContext(), qualified: qualifiedFor([[IDS.math7, IDS.cruz]]) })
    assert.deepEqual(unfilled.map(item => [item.subject_name, item.missing_minutes]), [['English 7', 220], ['Science 7', 220]])
    assert.match(unfilled[0].reason, /No teacher is marked as qualified/)
  })

  it('asks for weekly minutes and for a time template instead of guessing', () => {
    const noMinutes = planSectionWeek({ termId: 1, sectionId: IDS.rizal, context: makeContext({ templates: [GRADE_7_TEMPLATE] }), qualified: ALL_QUALIFIED })
    assert.deepEqual(noMinutes.generated, [])
    assert.ok(noMinutes.unfilled.every(item => /Weekly minutes are not set/.test(item.reason)))
    const noTemplate = planSectionWeek({ termId: 1, sectionId: IDS.rizal, context: makeContext({ subjectMinutes: GRADE_7_MINUTES }), qualified: ALL_QUALIFIED })
    assert.ok(noTemplate.unfilled.every(item => /Grade 7 has no time template yet/.test(item.reason)))
  })

  it('stops at the teacher load limit instead of overloading', () => {
    const context = jhsContext({ teacherOverrides: { [IDS.cruz]: { weekly_load_minutes: 300 } } })
    const { generated, unfilled } = planSectionWeek({ termId: 1, sectionId: IDS.rizal, context, qualified: qualifiedFor([[IDS.math7, IDS.cruz]]) })
    assert.ok(minutesOf(generated.filter(entry => entry.subject_id === IDS.math7)) <= 300)
    assert.ok(unfilled.find(item => item.subject_name === 'Math 7').missing_minutes > 0)
  })
})

describe('planSectionWeek – Senior High', () => {
  it('places 2-hour blocks on different days; the asynchronous window needs no room', () => {
    const context = makeContext({ templates: [SHS_TEMPLATE], subjectMinutes: { [IDS.genMath]: 240 } })
    const { generated, unfilled } = planSectionWeek({ termId: 1, sectionId: IDS.stemA, context, qualified: new Map([[IDS.genMath, [IDS.reyes]]]) })
    assert.deepEqual(unfilled, [])
    assert.deepEqual(generated.map(entry => [entry.day_of_week, entry.start_min, entry.end_min]), [['Monday', 570, 690], ['Tuesday', 570, 690]])
    assert.ok(generated.every(entry => entry.delivery_mode === 'asynchronous' && entry.room_id === null))
    assert.deepEqual(detectConflictsForEntries(generated, context).conflicts, [])
  })

  it('uses a 1-hour block when only an hour is missing', () => {
    const context = makeContext({ templates: [SHS_TEMPLATE], subjectMinutes: { [IDS.genMath]: 60 } })
    const { generated } = planSectionWeek({ termId: 1, sectionId: IDS.stemA, context, qualified: new Map([[IDS.genMath, [IDS.reyes]]]) })
    assert.deepEqual(generated.map(entry => entry.end_min - entry.start_min), [60])
  })
})
