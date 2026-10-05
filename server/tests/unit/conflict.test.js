// HIPO 3.2 – Schedule Plotter (unit tests)
// Every rule in conflict.service.js, run against an in-memory school (no database).
require('../helpers/unitTestEnv')
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  timesOverlap, daysOf, weeklyMinutesOf, detectConflicts, detectConflictsForEntries, teacherAvailability, availableRooms
} = require('../../src/modules/schedules/conflict.service')
const { IDS, GRADE_7_TEMPLATE, SHS_TEMPLATE, makeContext, classEntry, savedEntry } = require('../helpers/sampleContext')

const typesOf = conflicts => conflicts.map(conflict => conflict.type).sort()
const range = (day, start, end, extra = {}) => ({ day_of_week: day, start_min: start, end_min: end, ...extra })
const pattern = (dayPattern, start, end) => ({ day_pattern: dayPattern, start_min: start, end_min: end })

describe('the overlap rule (minute ranges, day patterns)', () => {
  it('overlaps when a.start < b.end AND b.start < a.end on the same day', () => {
    assert.equal(timesOverlap(range('Monday', 450, 495), range('Monday', 480, 525)), true)
    assert.equal(timesOverlap(range('Monday', 450, 560), range('Monday', 480, 525)), true, 'one inside the other')
  })

  it('back-to-back periods are not a conflict (07:15–08:00 then 08:00–09:20)', () => {
    assert.equal(timesOverlap(range('Monday', 435, 480), range('Monday', 480, 560)), false)
    assert.equal(timesOverlap(range('Monday', 480, 560), range('Monday', 435, 480)), false)
  })

  it('the same time on another day is not a conflict', () => {
    assert.equal(timesOverlap(range('Monday', 450, 495), range('Tuesday', 450, 495)), false)
  })

  it('a MON_THU entry overlaps Monday, Tuesday, Wednesday and Thursday', () => {
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday']) {
      assert.equal(timesOverlap(pattern('MON_THU', 390, 435), range(day, 400, 420)), true, day)
    }
  })

  it('a MON_THU entry vs. a FRI entry is not a conflict, even at the same time', () => {
    assert.equal(timesOverlap(pattern('MON_THU', 390, 435), pattern('FRI', 390, 430)), false)
    assert.equal(timesOverlap(pattern('MON_THU', 390, 435), range('Friday', 390, 430)), false)
  })

  it('counts a MON_THU entry four times in weekly minutes', () => {
    assert.deepEqual(daysOf(pattern('MON_THU', 390, 435)), ['Monday', 'Tuesday', 'Wednesday', 'Thursday'])
    assert.equal(weeklyMinutesOf(pattern('MON_THU', 390, 435)), 180)
    assert.equal(weeklyMinutesOf(range('Friday', 390, 430)), 40)
  })
})

describe('teacher overlap', () => {
  it('reports nothing for a free period', () => {
    assert.deepEqual(detectConflicts(classEntry(), makeContext()), [])
  })

  it('names the teacher, the other section, the day and the time', () => {
    const context = makeContext({ existingEntries: [savedEntry({ section_id: IDS.mabini, room_id: IDS.r102 })] })
    const conflicts = detectConflicts(classEntry(), context)
    assert.deepEqual(typesOf(conflicts), ['teacher'])
    assert.equal(conflicts[0].message, 'Ana Cruz is already teaching Grade 7 - Mabini (Math 7) on Monday 07:30–08:15.')
    assert.equal(conflicts[0].conflicting_entry_id, context.existingEntries[0].entry_id)
    assert.equal(conflicts[0].teacher_id, IDS.cruz)
  })

  it('co-teacher conflict: the second teacher of the new entry is busy', () => {
    const context = makeContext({ existingEntries: [savedEntry({ section_id: IDS.mabini, teacher_id: IDS.santos, subject_id: IDS.english7, room_id: IDS.r102 })] })
    const conflicts = detectConflicts(classEntry({ teacher_ids: [IDS.cruz, IDS.santos] }), context)
    assert.deepEqual(typesOf(conflicts), ['teacher'])
    assert.match(conflicts[0].message, /^Ben Santos is already teaching Grade 7 - Mabini \(English 7\) on Monday/)
    assert.equal(conflicts[0].teacher_id, IDS.santos)
  })

  it('co-teacher conflict: the teacher is the co-teacher of a saved entry', () => {
    const coTaught = savedEntry({ section_id: IDS.mabini, teacher_id: IDS.santos, teacher_ids: [IDS.santos, IDS.cruz], subject_id: IDS.english7, room_id: IDS.r102 })
    assert.match(detectConflicts(classEntry(), makeContext({ existingEntries: [coTaught] }))[0].message, /^Ana Cruz is already teaching/)
  })

  it('reports both teachers when both are busy', () => {
    const coTaught = savedEntry({ section_id: IDS.mabini, teacher_id: IDS.santos, teacher_ids: [IDS.santos, IDS.cruz], subject_id: IDS.english7, room_id: IDS.r102 })
    const conflicts = detectConflicts(classEntry({ teacher_ids: [IDS.cruz, IDS.santos] }), makeContext({ existingEntries: [coTaught] }))
    assert.deepEqual(conflicts.map(conflict => conflict.teacher_id), [IDS.cruz, IDS.santos])
  })

  it('compares across grade levels (a Grade 7 class against a Grade 11 class)', () => {
    const shsClass = savedEntry({ section_id: IDS.stemA, subject_id: IDS.genMath, teacher_id: IDS.cruz, room_id: IDS.r201, start_min: 420, end_min: 480 })
    const conflicts = detectConflicts(classEntry(), makeContext({ existingEntries: [shsClass] }))
    assert.deepEqual(typesOf(conflicts), ['teacher'])
    assert.match(conflicts[0].message, /Grade 11 - STEM A \(General Mathematics\) on Monday 07:00–08:00/)
  })

  it('a MON_THU entry clashes with each busy weekday and not with Friday', () => {
    const busy = ['Tuesday', 'Thursday', 'Friday'].map(day => savedEntry({ section_id: IDS.mabini, room_id: IDS.r102, day_of_week: day, start_min: 390, end_min: 435 }))
    const conflicts = detectConflicts(classEntry({ day_of_week: undefined, day_pattern: 'MON_THU', start_min: 390, end_min: 435 }), makeContext({ existingEntries: busy }))
    assert.deepEqual(conflicts.map(conflict => conflict.message), [
      'Ana Cruz is already teaching Grade 7 - Mabini (Math 7) on Tuesday 06:30–07:15.',
      'Ana Cruz is already teaching Grade 7 - Mabini (Math 7) on Thursday 06:30–07:15.'
    ])
    assert.equal(conflicts[0].day_pattern, 'MON_THU')
  })

  it('asynchronous classes still book their teacher', () => {
    const asyncSaved = savedEntry({ section_id: IDS.mabini, subject_id: IDS.english7, room_id: null, delivery_mode: 'asynchronous' })
    assert.deepEqual(typesOf(detectConflicts(classEntry(), makeContext({ existingEntries: [asyncSaved] }))), ['teacher'])
  })

  it('does not compare an entry with its own saved version when it is being edited', () => {
    const saved = savedEntry()
    const context = makeContext({ existingEntries: [saved] })
    assert.deepEqual(detectConflicts({ ...classEntry(), entry_id: saved.entry_id, start_min: 480, end_min: 525 }, context), [])
  })
})

describe('room overlap (face_to_face only)', () => {
  it('names the room, the other section, the day and the time', () => {
    const context = makeContext({ existingEntries: [savedEntry({ section_id: IDS.mabini, teacher_id: IDS.santos, subject_id: IDS.english7 })] })
    const conflicts = detectConflicts(classEntry(), context)
    assert.deepEqual(typesOf(conflicts), ['room'])
    assert.equal(conflicts[0].message, 'JHS Building · Room 101 is already used by Grade 7 - Mabini (English 7) on Monday 07:30–08:15.')
  })

  it('asynchronous with no room: no room conflict, even next to a room user', () => {
    const roomUser = savedEntry({ section_id: IDS.mabini, teacher_id: IDS.cruz })
    const asyncNew = classEntry({ teacher_id: IDS.santos, delivery_mode: 'asynchronous', room_id: null })
    assert.deepEqual(detectConflicts(asyncNew, makeContext({ existingEntries: [roomUser] })), [])
  })

  it('an asynchronous saved class does not hold its room', () => {
    const asyncSaved = savedEntry({ section_id: IDS.mabini, teacher_id: IDS.santos, subject_id: IDS.english7, delivery_mode: 'asynchronous' })
    assert.deepEqual(detectConflicts(classEntry(), makeContext({ existingEntries: [asyncSaved] })), [])
  })

  it('lists free rooms (same department first) for a Senior High room conflict', () => {
    const context = makeContext({
      existingEntries: [
        savedEntry({ section_id: IDS.rizal, room_id: IDS.r201, start_min: 480, end_min: 525 }),
        savedEntry({ section_id: IDS.mabini, teacher_id: IDS.santos, subject_id: IDS.english7, room_id: IDS.r202, start_min: 480, end_min: 525 })
      ]
    })
    const entry = classEntry({ section_id: IDS.stemA, subject_id: IDS.genMath, teacher_id: IDS.reyes, room_id: IDS.r201, start_min: 480, end_min: 540 })
    const roomConflict = detectConflicts(entry, context).find(conflict => conflict.type === 'room')
    assert.deepEqual(roomConflict.alternative_rooms.map(room => room.room_id), [IDS.r203, IDS.r101, IDS.r102])
  })

  it('does not add alternatives for a Junior High room conflict', () => {
    const context = makeContext({ existingEntries: [savedEntry({ section_id: IDS.mabini, teacher_id: IDS.santos })] })
    assert.equal(detectConflicts(classEntry(), context).find(conflict => conflict.type === 'room').alternative_rooms, undefined)
  })
})

describe('section overlap', () => {
  it('reports what the section already has at that time', () => {
    const context = makeContext({ existingEntries: [savedEntry({ subject_id: null, teacher_id: null, room_id: null, activity: 'FLAG CEREMONY' })] })
    const conflicts = detectConflicts(classEntry(), context)
    assert.deepEqual(typesOf(conflicts), ['section'])
    assert.equal(conflicts[0].message, 'Grade 7 - Rizal already has FLAG CEREMONY on Monday 07:30–08:15.')
  })

  it('returns ALL issues at once (teacher, room and section)', () => {
    const context = makeContext({ existingEntries: [savedEntry({ start_min: 480, end_min: 525 })] })
    assert.deepEqual(typesOf(detectConflicts(classEntry(), context)), ['room', 'section', 'teacher'])
  })
})

describe('time slot: the entry must sit in a "class" slot of the section\'s template', () => {
  const jhs = () => makeContext({ templates: [GRADE_7_TEMPLATE] })
  const at = (day, start, end, overrides = {}) => classEntry({ day_of_week: day, start_min: start, end_min: end, ...overrides })

  it('accepts the 45- and 80-minute MON_THU periods and the 40- and 80-minute FRI periods', () => {
    assert.deepEqual(detectConflicts(at('Monday', 390, 435), jhs()), []) // 06:30–07:15
    assert.deepEqual(detectConflicts(at('Thursday', 480, 560), jhs()), []) // 08:00–09:20
    assert.deepEqual(detectConflicts(at('Friday', 390, 430), jhs()), []) // 06:30–07:10
    assert.deepEqual(detectConflicts(at('Friday', 470, 550), jhs()), []) // 07:50–09:10
  })

  it('rejects a class on BREAK or LUNCH', () => {
    const onBreak = detectConflicts(at('Tuesday', 560, 580), jhs())
    assert.deepEqual(typesOf(onBreak), ['time_slot'])
    assert.equal(onBreak[0].message, '09:20–09:40 is BREAK in the time template; no class can be placed there.')
    assert.match(detectConflicts(at('Friday', 730, 750), jhs())[0].message, /12:10–12:30 is LUNCH/)
  })

  it('lets an activity row (not a class) sit on BREAK', () => {
    const breakRow = at('Tuesday', 560, 580, { subject_id: null, teacher_id: null, room_id: null, activity: 'BREAK' })
    assert.deepEqual(detectConflicts(breakRow, jhs()), [])
  })

  it('rejects a time that is not a period, and a MON_THU period used on Friday', () => {
    assert.match(detectConflicts(at('Monday', 450, 495), jhs())[0].message, /07:30–08:15 is not a Monday period of Grade 7\. Periods: 06:30–07:15, 07:15–08:00/)
    assert.equal(detectConflicts(at('Friday', 390, 435), jhs())[0].type, 'time_slot')
  })

  it('checks a MON_THU entry against the MON_THU periods', () => {
    assert.deepEqual(detectConflicts(classEntry({ day_of_week: undefined, day_pattern: 'MON_THU', start_min: 390, end_min: 435 }), jhs()), [])
    assert.equal(detectConflicts(classEntry({ day_of_week: undefined, day_pattern: 'MON_THU', start_min: 390, end_min: 430 }), jhs())[0].type, 'time_slot')
  })

  it('reports a day without any slots (Saturday), and skips the check without a template', () => {
    assert.match(detectConflicts(at('Saturday', 390, 435), jhs())[0].message, /Grade 7 has no classes on Saturday/)
    assert.deepEqual(detectConflicts(at('Saturday', 400, 460), makeContext()), [])
  })

  describe('Senior High (30-minute grid)', () => {
    const shs = () => makeContext({ templates: [SHS_TEMPLATE] })
    const shsAt = (start, end) => classEntry({ section_id: IDS.stemA, subject_id: IDS.genMath, teacher_id: IDS.reyes, room_id: IDS.r201, day_of_week: 'Wednesday', start_min: start, end_min: end })

    it('accepts 2-hour and 1-hour blocks inside class slots, also across back-to-back slots', () => {
      assert.deepEqual(detectConflicts(shsAt(750, 870), shs()), []) // 12:30–14:30
      assert.deepEqual(detectConflicts(shsAt(1020, 1080), shs()), []) // 17:00–18:00
      assert.deepEqual(detectConflicts(shsAt(900, 1140), shs()), []) // 15:00–19:00
    })

    it('rejects the break, the no-class hour and times off the grid', () => {
      assert.match(detectConflicts(shsAt(870, 900), shs())[0].message, /14:30–15:00 is outside the Wednesday class times of Grade 11/)
      assert.equal(detectConflicts(shsAt(690, 750), shs())[0].type, 'time_slot') // 11:30–12:30 NO CLASS
      assert.match(detectConflicts(shsAt(765, 885), shs())[0].message, /30-minute grid; 12:45–14:45/)
    })
  })
})

describe('qualification (teacher_subjects)', () => {
  it('rejects a teacher who is not qualified for the subject', () => {
    const conflicts = detectConflicts(classEntry({ teacher_id: IDS.reyes }), makeContext())
    assert.deepEqual(typesOf(conflicts), ['qualification'])
    assert.equal(conflicts[0].message, "Carla Reyes is not qualified to teach Math 7 (add it to the teacher's qualified subjects first).")
  })

  it('checks the co-teacher too', () => {
    const conflicts = detectConflicts(classEntry({ teacher_ids: [IDS.cruz, IDS.reyes] }), makeContext())
    assert.deepEqual(conflicts.map(conflict => [conflict.type, conflict.teacher_id]), [['qualification', IDS.reyes]])
  })

  it('lets the class adviser teach HGP to their own section, nobody else', () => {
    const hgp = teacherId => classEntry({ subject_id: IDS.hgp7, teacher_id: teacherId, day_of_week: 'Friday' })
    assert.deepEqual(detectConflicts(hgp(IDS.santos), makeContext()), [], 'Santos advises Rizal')
    assert.deepEqual(typesOf(detectConflicts(hgp(IDS.cruz), makeContext())), ['qualification'], 'Cruz advises Mabini, not Rizal')
  })

  it('does not check activity rows', () => {
    assert.deepEqual(detectConflicts(classEntry({ subject_id: null, teacher_id: null, room_id: null, activity: 'BREAK' }), makeContext()), [])
  })
})

describe('teacher load', () => {
  it('reports more distinct subjects than max_subject_load', () => {
    const context = makeContext({
      teacherOverrides: { [IDS.cruz]: { max_subject_load: 2 } },
      existingEntries: [savedEntry({ subject_id: IDS.english7, day_of_week: 'Tuesday' }), savedEntry({ subject_id: IDS.science7, day_of_week: 'Wednesday' })]
    })
    const conflicts = detectConflicts(classEntry({ section_id: IDS.mabini }), context)
    assert.deepEqual(typesOf(conflicts), ['teacher_load'])
    assert.equal(conflicts[0].message, 'Ana Cruz would teach 3 different subjects this term (limit 2).')
  })

  it('uses 5 subjects as the default limit', () => {
    const extra = [9001, 9002, 9003]
    const context = makeContext({
      qualified: [[IDS.math7, IDS.cruz], [IDS.english7, IDS.cruz], [IDS.science7, IDS.cruz], ...extra.map(id => [id, IDS.cruz])],
      existingEntries: [IDS.english7, IDS.science7, ...extra].map((subjectId, index) => savedEntry({ subject_id: subjectId, section_id: IDS.mabini, start_min: 600 + index * 45, end_min: 645 + index * 45 }))
    })
    extra.forEach((id, index) => context.subjects.set(id, { subject_id: id, subject_name: `Extra ${index}`, grade_level_id: IDS.grade7 }))
    assert.match(detectConflicts(classEntry(), context)[0].message, /6 different subjects this term \(limit 5\)/)
  })

  it('reports more weekly minutes than weekly_load_minutes', () => {
    const context = makeContext({ teacherOverrides: { [IDS.cruz]: { weekly_load_minutes: 60 } }, existingEntries: [savedEntry({ day_of_week: 'Friday' })] })
    const conflicts = detectConflicts(classEntry(), context)
    assert.deepEqual(typesOf(conflicts), ['teacher_load'])
    assert.equal(conflicts[0].message, 'Ana Cruz would teach 90 minutes a week (limit 60).')
  })

  it('counts a co-taught class in full for each teacher', () => {
    const context = makeContext({ teacherOverrides: { [IDS.santos]: { weekly_load_minutes: 60 } }, existingEntries: [savedEntry({ teacher_id: IDS.santos, subject_id: IDS.english7, section_id: IDS.mabini, room_id: IDS.r102, day_of_week: 'Friday' })] })
    const conflicts = detectConflicts(classEntry({ teacher_ids: [IDS.cruz, IDS.santos] }), context)
    assert.deepEqual(typesOf(conflicts), ['teacher_load'])
    assert.match(conflicts[0].message, /Ben Santos would teach 90 minutes a week \(limit 60\)/)
  })

  it('counts a MON_THU entry as four days', () => {
    const context = makeContext({ teacherOverrides: { [IDS.cruz]: { weekly_load_minutes: 179 } } })
    assert.match(detectConflicts(classEntry({ day_of_week: undefined, day_pattern: 'MON_THU' }), context)[0].message, /180 minutes a week \(limit 179\)/)
  })
})

describe('subject weekly minutes', () => {
  const context = existingEntries => makeContext({ subjectMinutes: { [IDS.math7]: 90 }, existingEntries })

  it('reports a section that would get more minutes of a subject than weekly_minutes', () => {
    const conflicts = detectConflicts(classEntry(), context([savedEntry({ day_of_week: 'Tuesday' }), savedEntry({ day_of_week: 'Wednesday' })]))
    assert.deepEqual(typesOf(conflicts), ['weekly_minutes'])
    assert.equal(conflicts[0].message, 'Grade 7 - Rizal would have 135 minutes of Math 7 a week (limit 90).')
  })

  it('accepts exactly weekly_minutes', () => {
    assert.deepEqual(detectConflicts(classEntry(), context([savedEntry({ day_of_week: 'Tuesday' })])), [])
  })

  it('counts only the same section', () => {
    const otherSection = ['Tuesday', 'Wednesday'].map(day => savedEntry({ section_id: IDS.mabini, room_id: IDS.r102, day_of_week: day }))
    assert.deepEqual(detectConflicts(classEntry(), context(otherSection)), [])
  })

  it('has no limit when weekly_minutes is not set', () => {
    const many = ['Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => savedEntry({ day_of_week: day }))
    assert.deepEqual(detectConflicts(classEntry(), makeContext({ existingEntries: many })), [])
  })
})

describe('subject and data checks', () => {
  it('keeps one teacher per subject per section for the whole week', () => {
    const conflicts = detectConflicts(classEntry({ teacher_id: IDS.santos }), makeContext({ existingEntries: [savedEntry({ day_of_week: 'Tuesday' })] }))
    assert.deepEqual(typesOf(conflicts), ['subject_teacher'])
    assert.match(conflicts[0].message, /Math 7 in Grade 7 - Rizal is already taught by Ana Cruz \(Tuesday 07:30–08:15\)/)
  })

  it('treats the same co-teaching pair in another order as the same teachers', () => {
    const pair = savedEntry({ teacher_id: IDS.cruz, teacher_ids: [IDS.cruz, IDS.santos], day_of_week: 'Tuesday' })
    assert.deepEqual(detectConflicts(classEntry({ teacher_ids: [IDS.santos, IDS.cruz] }), makeContext({ existingEntries: [pair] })), [])
  })

  it('rejects a subject from another grade level', () => {
    const conflicts = detectConflicts(classEntry({ subject_id: IDS.genMath, teacher_id: IDS.reyes }), makeContext())
    assert.deepEqual(typesOf(conflicts), ['subject'])
    assert.equal(conflicts[0].message, 'General Mathematics is not a subject of Grade 7.')
  })

  it('reports ids that do not exist instead of failing later', () => {
    const conflicts = detectConflicts(classEntry({ teacher_ids: [IDS.cruz, 999], room_id: 998 }), makeContext())
    assert.deepEqual(conflicts.map(conflict => conflict.message), ['Teacher #999 does not exist.', 'Room #998 does not exist.'])
  })
})

describe('detectConflictsForEntries – a whole week from the plotter', () => {
  it('reports a clash between two new rows once, on the later row', () => {
    const { conflicts } = detectConflictsForEntries([classEntry(), classEntry({ section_id: IDS.mabini, room_id: IDS.r102 })], makeContext())
    assert.deepEqual(conflicts.map(conflict => [conflict.type, conflict.entry_index]), [['teacher', 1]])
  })

  it('checks teacher load once over all rows and returns a load summary', () => {
    const rows = [
      classEntry(),
      classEntry({ subject_id: IDS.english7, day_of_week: 'Tuesday' }),
      classEntry({ subject_id: IDS.science7, day_of_week: 'Wednesday', section_id: IDS.mabini })
    ]
    const { conflicts, teacherLoads } = detectConflictsForEntries(rows, makeContext({ teacherOverrides: { [IDS.cruz]: { max_subject_load: 1 } } }))
    assert.deepEqual(conflicts.map(conflict => conflict.type), ['teacher_load'])
    assert.deepEqual(teacherLoads.map(load => [load.teacher_name, load.subject_count, load.weekly_minutes, load.overloaded]), [['Ana Cruz', 3, 135, true]])
  })

  it('checks subject weekly minutes once over all rows', () => {
    const rows = ['Monday', 'Tuesday', 'Wednesday'].map(day => classEntry({ day_of_week: day }))
    const { conflicts } = detectConflictsForEntries(rows, makeContext({ subjectMinutes: { [IDS.math7]: 90 } }))
    assert.deepEqual(conflicts.map(conflict => [conflict.type, conflict.entry_index]), [['weekly_minutes', 0]])
  })
})

describe('teacherAvailability – green/red hints', () => {
  const busy = [
    savedEntry({ section_id: IDS.mabini, room_id: IDS.r102, day_of_week: 'Wednesday', start_min: 480, end_min: 560 }),
    savedEntry({ section_id: IDS.mabini, room_id: IDS.r102, day_of_week: 'Monday', start_min: 390, end_min: 435 }),
    savedEntry({ section_id: IDS.mabini, room_id: IDS.r102, day_of_week: 'Friday', start_min: 390, end_min: 430 })
  ]
  const context = () => makeContext({ templates: [GRADE_7_TEMPLATE], existingEntries: busy })

  it('lists the teacher\'s classes on Monday–Thursday for MON_THU, in day order, without Friday', () => {
    const result = teacherAvailability(IDS.cruz, 'MON_THU', context())
    assert.deepEqual(result.days, ['Monday', 'Tuesday', 'Wednesday', 'Thursday'])
    assert.deepEqual(result.busy.map(item => [item.day_of_week, item.start_time, item.description]), [
      ['Monday', '06:30', 'Grade 7 - Mabini (Math 7)'],
      ['Wednesday', '08:00', 'Grade 7 - Mabini (Math 7)']
    ])
    assert.equal(result.load.weekly_minutes, 165)
  })

  it('marks the section\'s class slots red where the teacher is busy and green elsewhere', () => {
    const { slots } = teacherAvailability(IDS.cruz, 'MON_THU', context(), { sectionId: IDS.rizal })
    assert.equal(slots.length, 10, 'class periods only, no BREAK or LUNCH')
    assert.deepEqual(slots.filter(slot => !slot.available).map(slot => [slot.start_time, slot.busy_with]), [
      ['06:30', 'Grade 7 - Mabini (Math 7) on Monday'],
      ['08:00', 'Grade 7 - Mabini (Math 7) on Wednesday']
    ])
    assert.equal(slots[1].available, true, '07:15–08:00 is back-to-back with the busy 06:30–07:15')
  })

  it('looks only at Friday for FRI', () => {
    const result = teacherAvailability(IDS.cruz, 'FRI', context(), { sectionId: IDS.rizal })
    assert.deepEqual(result.busy.map(item => item.day_of_week), ['Friday'])
    assert.equal(result.slots.find(slot => slot.label === 'HGP').available, true)
  })
})

describe('availableRooms – room suggestions', () => {
  const slot = (overrides = {}) => ({ section_id: IDS.stemA, day_of_week: 'Monday', start_min: 450, end_min: 495, ...overrides })

  it('leaves out rooms used face-to-face at that time, own department first', () => {
    const context = makeContext({ existingEntries: [savedEntry({ room_id: IDS.r201 }), savedEntry({ section_id: IDS.mabini, teacher_id: IDS.santos, room_id: IDS.r101 })] })
    assert.deepEqual(availableRooms(slot(), context.existingEntries, context).map(room => room.room_id), [IDS.r202, IDS.r203, IDS.r102])
  })

  it('offers a room whose class is asynchronous, back-to-back or on another day', () => {
    const entries = [
      savedEntry({ room_id: IDS.r201, delivery_mode: 'asynchronous' }),
      savedEntry({ room_id: IDS.r202, start_min: 495, end_min: 540 }),
      savedEntry({ room_id: IDS.r203, day_of_week: 'Friday' })
    ]
    const context = makeContext({ existingEntries: entries })
    assert.deepEqual(availableRooms(slot(), entries, context).slice(0, 3).map(room => room.room_id), [IDS.r201, IDS.r202, IDS.r203])
  })

  it('treats a MON_THU slot as busy when the room is used on any of those days', () => {
    const context = makeContext({ existingEntries: [savedEntry({ room_id: IDS.r101, day_of_week: 'Thursday' })] })
    const rooms = availableRooms(slot({ section_id: IDS.rizal, day_of_week: undefined, day_pattern: 'MON_THU' }), context.existingEntries, context)
    assert.deepEqual(rooms.map(room => room.room_id), [IDS.r102, IDS.r201, IDS.r202, IDS.r203])
  })

  it('ignores the entry being edited', () => {
    const saved = savedEntry({ room_id: IDS.r101 })
    const context = makeContext({ existingEntries: [saved] })
    assert.ok(availableRooms(slot({ entry_id: saved.entry_id }), context.existingEntries, context).some(room => room.room_id === IDS.r101))
  })
})
