// HIPO 3.2 – Schedule Plotter (unit tests)
// Pure request checks in schedules.validation.js.
require('../helpers/unitTestEnv')
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { toMinutes, formatMinutes, gradeOf, schoolLevelOf, normalizeEntry, normalizeEntries } = require('../../src/modules/schedules/schedules.validation')

describe('time helpers', () => {
  it('converts between "HH:MM" and minutes after midnight', () => {
    assert.equal(toMinutes('07:30'), 450)
    assert.equal(toMinutes('07:30:00'), 450)
    assert.equal(toMinutes('24:00'), null)
    assert.equal(toMinutes('7:30'), null)
    assert.equal(formatMinutes(450), '07:30')
    assert.equal(formatMinutes(1005), '16:45')
  })

  it('reads the grade and school level from a grade-level name', () => {
    assert.equal(gradeOf('Grade 7'), 7)
    assert.equal(gradeOf('grade 11 - STEM'), 11)
    assert.equal(gradeOf('Kinder'), null)
    assert.equal(schoolLevelOf('Grade 10'), 'JHS')
    assert.equal(schoolLevelOf('Grade 12'), 'SHS')
  })
})

describe('normalizeEntry', () => {
  const ids = { termId: 1, sectionId: 5 }

  it('accepts start_time + duration_minutes (what the plotter sends)', () => {
    const entry = normalizeEntry({ day_of_week: 'Monday', start_time: '07:30', duration_minutes: 45, subject_id: '3', teacher_id: 4, room_id: 6 }, ids)
    assert.deepEqual(entry, {
      entry_id: null, term_id: 1, section_id: 5, subject_id: 3, teacher_id: 4, teacher_ids: [4], room_id: 6,
      activity: null, delivery_mode: 'face_to_face', day_of_week: 'Monday', start_min: 450, end_min: 495
    })
  })

  it('accepts start_min / end_min and activity rows', () => {
    const entry = normalizeEntry({ day_of_week: 'Friday', start_min: 600, end_min: 615, activity: ' BREAK ' }, ids)
    assert.equal(entry.activity, 'BREAK')
    assert.equal(entry.end_min, 615)
  })

  it('rejects bad rows with a readable 400 message', () => {
    const bad = [
      [{ day_of_week: 'Sunday', start_time: '07:30', duration_minutes: 45, activity: 'X' }, /weekday/],
      [{ day_of_week: 'Monday', start_time: '7am', duration_minutes: 45, activity: 'X' }, /24-hour start time/],
      [{ day_of_week: 'Monday', start_min: 500, end_min: 450, activity: 'X' }, /end time must be after/],
      [{ day_of_week: 'Monday', start_time: '07:30', duration_minutes: 45, subject_id: 3 }, /one subject and one or two teachers/],
      [{ day_of_week: 'Monday', start_time: '07:30', duration_minutes: 45, subject_id: 3, teacher_id: 4 }, /face-to-face class needs a room/],
      [{ day_of_week: 'Monday', start_time: '07:30', duration_minutes: 45, teacher_id: 3 }, /activity name and no teacher or room/],
      [{ day_of_week: 'Monday', start_time: '07:30', duration_minutes: 45, activity: 'X', room_id: 'abc' }, /not a valid id/]
    ]
    for (const [raw, message] of bad) {
      assert.throws(() => normalizeEntry(raw, ids), error => error.status === 400 && message.test(error.message))
    }
  })

  it('accepts one or two teachers (primary first) and an asynchronous class without a room', () => {
    const entry = normalizeEntry({ day_of_week: 'Monday', start_min: 750, end_min: 870, subject_id: 3, teacher_ids: ['4', 9], delivery_mode: 'asynchronous' }, ids)
    assert.deepEqual([entry.teacher_id, entry.teacher_ids, entry.room_id, entry.delivery_mode], [4, [4, 9], null, 'asynchronous'])
    assert.deepEqual(normalizeEntry({ day_of_week: 'Monday', start_min: 750, end_min: 870, subject_id: 3, teacher_id: 4, teacher_ids: [4, 9], room_id: 6 }, ids).teacher_ids, [4, 9])
  })

  it('rejects bad teacher lists and delivery modes', () => {
    const row = { day_of_week: 'Monday', start_min: 750, end_min: 870, subject_id: 3, room_id: 6 }
    const bad = [
      [{ ...row, teacher_ids: [4, 9, 11] }, /at most 2 teachers/],
      [{ ...row, teacher_ids: [4, 4] }, /same teacher is listed twice/],
      [{ ...row, teacher_ids: '4,9' }, /teacher_ids must be a list/],
      [{ ...row, teacher_ids: [] }, /one or two teachers/],
      [{ ...row, teacher_id: 9, teacher_ids: [4, 9] }, /teacher_id must be the first of teacher_ids/],
      [{ ...row, teacher_id: 4, delivery_mode: 'online' }, /delivery_mode must be one of: face_to_face, asynchronous/],
      [{ day_of_week: 'Monday', start_min: 750, end_min: 870, activity: 'BREAK', delivery_mode: 'asynchronous' }, /Only a class can be asynchronous/]
    ]
    for (const [raw, message] of bad) {
      assert.throws(() => normalizeEntry(raw, ids), error => error.status === 400 && message.test(error.message), message.source)
    }
  })

  it('requires term_id and section_id when they are not given by the route', () => {
    assert.throws(() => normalizeEntry({ day_of_week: 'Monday', start_time: '07:30', duration_minutes: 45, activity: 'X' }), /term_id is required/)
  })

  it('limits how many rows one request may send', () => {
    assert.throws(() => normalizeEntries('nope', ids), /must be an array/)
    assert.throws(() => normalizeEntries(new Array(601).fill({}), ids), /at most 600/)
  })
})
