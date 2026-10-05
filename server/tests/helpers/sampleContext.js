// Shared – test helper: an in-memory "school" in the same shape loadConflictContext() returns,
// so the conflict rules and Auto-Generate can be unit-tested without a database.
const { schoolLevelOf } = require('../../src/modules/schedules/schedules.validation')

const IDS = {
  jhsDept: 1, shsDept: 2,
  grade7: 7, grade11: 11,
  rizal: 101, mabini: 102, stemA: 111,
  math7: 201, english7: 202, science7: 203, genMath: 211,
  cruz: 301, santos: 302, reyes: 303,
  r101: 401, r102: 402, r201: 411, r202: 412, r203: 413
}

const makeContext = ({ existingEntries = [], teacherOverrides = {}, timeRules = [] } = {}) => {
  const section = (section_id, section_name, grade_level_id, grade_level_name, department_id) =>
    [section_id, { section_id, section_name, grade_level_id, grade_level_name, department_id, level: schoolLevelOf(grade_level_name), label: `${grade_level_name} - ${section_name}` }]
  const teacher = (teacher_id, name) =>
    [teacher_id, { teacher_id, name, max_subject_load: null, weekly_load_minutes: null, ancillary_tasks: [], ...teacherOverrides[teacher_id] }]
  const room = (room_id, room_number, building_name, department_id) =>
    [room_id, { room_id, room_number, building_name, department_id, label: `${building_name} · Room ${room_number}` }]
  const subject = (subject_id, subject_name, grade_level_id, weekly_periods = null) =>
    [subject_id, { subject_id, subject_name, grade_level_id, weekly_periods }]

  return {
    termId: 1,
    sections: new Map([
      section(IDS.rizal, 'Rizal', IDS.grade7, 'Grade 7', IDS.jhsDept),
      section(IDS.mabini, 'Mabini', IDS.grade7, 'Grade 7', IDS.jhsDept),
      section(IDS.stemA, 'STEM A', IDS.grade11, 'Grade 11', IDS.shsDept)
    ]),
    timeRules: new Map(timeRules.map(rule => [rule.department_id, rule])),
    existingEntries,
    teachers: new Map([teacher(IDS.cruz, 'Ana Cruz'), teacher(IDS.santos, 'Ben Santos'), teacher(IDS.reyes, 'Carla Reyes')]),
    rooms: new Map([
      room(IDS.r101, '101', 'JHS Building', IDS.jhsDept),
      room(IDS.r102, '102', 'JHS Building', IDS.jhsDept),
      room(IDS.r201, '201', 'SHS Building', IDS.shsDept),
      room(IDS.r202, '202', 'SHS Building', IDS.shsDept),
      room(IDS.r203, '203', 'SHS Building', IDS.shsDept)
    ]),
    subjects: new Map([
      subject(IDS.math7, 'Math 7', IDS.grade7, 4),
      subject(IDS.english7, 'English 7', IDS.grade7, 4),
      subject(IDS.science7, 'Science 7', IDS.grade7, 4),
      subject(IDS.genMath, 'General Mathematics', IDS.grade11, 4)
    ])
  }
}

// A class row; times are minutes after midnight (450 = 07:30).
let nextEntryId = 9000
const classEntry = (overrides = {}) => ({
  entry_id: null,
  term_id: 1,
  section_id: IDS.rizal,
  subject_id: IDS.math7,
  teacher_id: IDS.cruz,
  room_id: IDS.r101,
  activity: null,
  day_of_week: 'Monday',
  start_min: 450,
  end_min: 495,
  ...overrides
})
const savedEntry = overrides => classEntry({ entry_id: nextEntryId++, status: 'approved', ...overrides })

module.exports = { IDS, makeContext, classEntry, savedEntry }
