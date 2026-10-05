// HIPO 3.2 – Schedule Plotter (unit tests)
// The conflict rules in conflict.service.js, run against an in-memory school (no database).
require('../helpers/unitTestEnv')
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { detectConflicts, detectConflictsForEntries } = require('../../src/modules/schedules/conflict.service')
const { IDS, makeContext, classEntry, savedEntry } = require('../helpers/sampleContext')

const typesOf = conflicts => conflicts.map(conflict => conflict.type).sort()

describe('detectConflicts – overlaps', () => {
  it('reports nothing for a free period', () => {
    assert.deepEqual(detectConflicts(classEntry(), makeContext()), [])
  })

  it('reports a teacher who is already teaching another section at that time', () => {
    const context = makeContext({ existingEntries: [savedEntry({ section_id: IDS.mabini, room_id: IDS.r102 })] })
    const conflicts = detectConflicts(classEntry(), context)
    assert.deepEqual(typesOf(conflicts), ['teacher'])
    assert.match(conflicts[0].message, /Ana Cruz is already teaching Grade 7 - Mabini \(Math 7\) on Monday 07:30–08:15/)
    assert.equal(conflicts[0].conflicting_entry_id, context.existingEntries[0].entry_id)
  })

  it('reports a room that is already used', () => {
    const context = makeContext({ existingEntries: [savedEntry({ section_id: IDS.mabini, teacher_id: IDS.santos, subject_id: IDS.english7 })] })
    const conflicts = detectConflicts(classEntry(), context)
    assert.deepEqual(typesOf(conflicts), ['room'])
    assert.match(conflicts[0].message, /JHS Building · Room 101 is already used by Grade 7 - Mabini \(English 7\)/)
  })

  it('reports a section that already has something at that time', () => {
    const context = makeContext({ existingEntries: [savedEntry({ subject_id: null, teacher_id: null, room_id: null, activity: 'BREAK' })] })
    const conflicts = detectConflicts(classEntry(), context)
    assert.deepEqual(typesOf(conflicts), ['section'])
    assert.match(conflicts[0].message, /Grade 7 - Rizal already has BREAK on Monday 07:30–08:15/)
  })

  it('returns ALL conflicts at once (teacher, room and section)', () => {
    const context = makeContext({ existingEntries: [savedEntry({ start_min: 480, end_min: 525 })] })
    assert.deepEqual(typesOf(detectConflicts(classEntry(), context)), ['room', 'section', 'teacher'])
  })

  it('treats back-to-back periods as no overlap (07:30–08:15 then 08:15–09:00)', () => {
    const context = makeContext({ existingEntries: [savedEntry({ start_min: 495, end_min: 540 })] })
    assert.deepEqual(detectConflicts(classEntry(), context), [])
  })

  it('ignores the same time on a different day', () => {
    const context = makeContext({ existingEntries: [savedEntry({ day_of_week: 'Tuesday' })] })
    assert.deepEqual(detectConflicts(classEntry(), context), [])
  })

  it('does not compare an entry with its own saved version when it is being edited', () => {
    const saved = savedEntry()
    const context = makeContext({ existingEntries: [saved] })
    assert.deepEqual(detectConflicts({ ...classEntry(), entry_id: saved.entry_id, start_min: 480, end_min: 525 }, context), [])
  })
})

describe('detectConflicts – Senior High room alternatives', () => {
  const shsEntry = overrides => classEntry({ section_id: IDS.stemA, subject_id: IDS.genMath, teacher_id: IDS.reyes, room_id: IDS.r201, start_min: 480, end_min: 540, ...overrides })

  it('lists free rooms (same department first) when an SHS room is taken', () => {
    const context = makeContext({
      existingEntries: [
        savedEntry({ section_id: IDS.rizal, room_id: IDS.r201, start_min: 480, end_min: 525 }), // takes 201
        savedEntry({ section_id: IDS.mabini, teacher_id: IDS.santos, subject_id: IDS.english7, room_id: IDS.r202, start_min: 480, end_min: 525 }) // takes 202
      ]
    })
    const roomConflict = detectConflicts(shsEntry(), context).find(conflict => conflict.type === 'room')
    const offered = roomConflict.alternative_rooms.map(room => room.room_id)
    assert.equal(offered[0], IDS.r203, 'the free SHS room comes first')
    assert.ok(!offered.includes(IDS.r201) && !offered.includes(IDS.r202), 'busy rooms are not offered')
    assert.deepEqual(new Set(offered), new Set([IDS.r203, IDS.r101, IDS.r102]))
  })

  it('does not add alternatives for a Junior High room conflict', () => {
    const context = makeContext({ existingEntries: [savedEntry({ section_id: IDS.mabini, teacher_id: IDS.santos })] })
    const roomConflict = detectConflicts(classEntry(), context).find(conflict => conflict.type === 'room')
    assert.equal(roomConflict.alternative_rooms, undefined)
  })
})

describe('detectConflicts – teacher load', () => {
  it('reports more distinct subjects than max_subject_load', () => {
    const context = makeContext({
      teacherOverrides: { [IDS.cruz]: { max_subject_load: 2 } },
      existingEntries: [
        savedEntry({ subject_id: IDS.english7, day_of_week: 'Tuesday' }),
        savedEntry({ subject_id: IDS.science7, day_of_week: 'Wednesday' })
      ]
    })
    const conflicts = detectConflicts(classEntry({ section_id: IDS.mabini }), context)
    assert.deepEqual(typesOf(conflicts), ['teacher_load'])
    assert.match(conflicts[0].message, /Ana Cruz would teach 3 different subjects this term \(limit 2\)/)
  })

  it('uses 5 subjects as the default limit', () => {
    const subjects = [IDS.english7, IDS.science7, 9001, 9002, 9003]
    const context = makeContext({ existingEntries: subjects.map((subjectId, index) => savedEntry({ subject_id: subjectId, start_min: 600 + index * 45, end_min: 645 + index * 45, section_id: IDS.mabini })) })
    context.subjects.set(9001, { subject_id: 9001, subject_name: 'Filipino 7', grade_level_id: IDS.grade7 })
    context.subjects.set(9002, { subject_id: 9002, subject_name: 'AP 7', grade_level_id: IDS.grade7 })
    context.subjects.set(9003, { subject_id: 9003, subject_name: 'MAPEH 7', grade_level_id: IDS.grade7 })
    assert.match(detectConflicts(classEntry(), context)[0].message, /6 different subjects this term \(limit 5\)/)
  })

  it('reports more weekly minutes than weekly_load_minutes', () => {
    const context = makeContext({
      teacherOverrides: { [IDS.cruz]: { weekly_load_minutes: 60 } },
      existingEntries: [savedEntry({ day_of_week: 'Friday' })]
    })
    const conflicts = detectConflicts(classEntry(), context)
    assert.deepEqual(typesOf(conflicts), ['teacher_load'])
    assert.match(conflicts[0].message, /90 minutes a week \(limit 60\)/)
  })
})

describe('detectConflicts – department time rules', () => {
  it('uses the Junior High defaults: Monday–Friday, 07:00–17:00, 45-minute periods', () => {
    const conflicts = detectConflicts(classEntry({ day_of_week: 'Saturday', start_min: 400, end_min: 460 }), makeContext())
    const messages = conflicts.map(conflict => conflict.message).join(' | ')
    assert.deepEqual(typesOf(conflicts), ['time_rule', 'time_rule', 'time_rule'])
    assert.match(messages, /only scheduled on Monday, Tuesday, Wednesday, Thursday, Friday/)
    assert.match(messages, /must be between 07:00 and 17:00/)
    assert.match(messages, /45-minute periods; this row is 60 minutes long/)
  })

  it('uses 60-minute periods for Senior High by default', () => {
    const entry = classEntry({ section_id: IDS.stemA, subject_id: IDS.genMath, teacher_id: IDS.reyes, room_id: IDS.r201, start_min: 480, end_min: 525 })
    assert.match(detectConflicts(entry, makeContext())[0].message, /Senior High School classes use 60-minute periods/)
  })

  it('lets a department rule override the defaults', () => {
    const context = makeContext({ timeRules: [{ department_id: IDS.jhsDept, period_minutes: 50, day_start_min: 360, day_end_min: 720, allowed_days: ['Monday', 'Saturday'] }] })
    assert.deepEqual(detectConflicts(classEntry({ day_of_week: 'Saturday', start_min: 360, end_min: 410 }), context), [])
    assert.equal(detectConflicts(classEntry({ start_min: 700, end_min: 750 }), context)[0].type, 'time_rule')
  })
})

describe('detectConflicts – data checks', () => {
  it('rejects a subject from another grade level', () => {
    const conflicts = detectConflicts(classEntry({ subject_id: IDS.genMath }), makeContext())
    assert.deepEqual(typesOf(conflicts), ['subject'])
    assert.match(conflicts[0].message, /General Mathematics is not a subject of Grade 7/)
  })

  it('keeps one teacher per subject per section', () => {
    const context = makeContext({ existingEntries: [savedEntry({ day_of_week: 'Tuesday' })] })
    const conflicts = detectConflicts(classEntry({ teacher_id: IDS.santos }), context)
    assert.deepEqual(typesOf(conflicts), ['section'])
    assert.match(conflicts[0].message, /Math 7 in this section is already taught by Ana Cruz/)
  })

  it('reports ids that do not exist instead of failing later', () => {
    const conflicts = detectConflicts(classEntry({ teacher_id: 999, room_id: 998 }), makeContext())
    assert.deepEqual(conflicts.map(conflict => conflict.message), ['Teacher #999 does not exist.', 'Room #998 does not exist.'])
  })
})

describe('detectConflictsForEntries – a whole week from the plotter', () => {
  it('reports a clash between two new rows once, on the later row', () => {
    const rows = [classEntry(), classEntry({ section_id: IDS.mabini, room_id: IDS.r102 })]
    const { conflicts } = detectConflictsForEntries(rows, makeContext())
    assert.equal(conflicts.length, 1)
    assert.equal(conflicts[0].type, 'teacher')
    assert.equal(conflicts[0].entry_index, 1)
  })

  it('checks teacher load once over all rows and returns a load summary', () => {
    const context = makeContext({ teacherOverrides: { [IDS.cruz]: { max_subject_load: 1 } } })
    const rows = [
      classEntry(),
      classEntry({ subject_id: IDS.english7, day_of_week: 'Tuesday' }),
      classEntry({ subject_id: IDS.science7, day_of_week: 'Wednesday', section_id: IDS.mabini })
    ]
    const { conflicts, teacherLoads } = detectConflictsForEntries(rows, context)
    assert.deepEqual(conflicts.map(conflict => conflict.type), ['teacher_load'])
    assert.match(conflicts[0].message, /3 different subjects this term \(limit 1\)/)
    assert.deepEqual(teacherLoads.map(load => [load.teacher_name, load.subject_count, load.weekly_minutes, load.overloaded]), [['Ana Cruz', 3, 135, true]])
  })
})
