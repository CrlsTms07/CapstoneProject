// Shared – test helper: an in-memory "school" in the same shape loadConflictContext() returns,
// so the conflict rules and Auto-Generate can be unit-tested without a database.
// Time templates are off by default; pass templates: [GRADE_7_TEMPLATE] etc. to switch them on.
// Advisers: Rizal – Ben Santos, Mabini – Ana Cruz, STEM A – Carla Reyes.
// Qualified (teacher_subjects): Cruz and Santos for Math / English / Science 7, Reyes for the Grade 11
// subjects; nobody for HGP 7 or Homeroom (the class adviser teaches those). Override with qualified: [[subject, teacher], ...].
const { schoolLevelOf } = require('../../src/modules/schedules/schedules.validation')
const { GRADE_7_SLOTS, GRADE_12_SLOTS } = require('../../src/db/migrations/timeTemplates.migration')

const IDS = {
  jhsDept: 1, shsDept: 2,
  grade7: 7, grade11: 11,
  rizal: 101, mabini: 102, stemA: 111,
  math7: 201, english7: 202, science7: 203, hgp7: 204, genMath: 211, homeroom11: 212, pe11: 213,
  cruz: 301, santos: 302, reyes: 303,
  r101: 401, r102: 402, r201: 411, r202: 412, r203: 413
}

// The seeded templates (CLAUDE.md "Scheduling Rules"); the SHS one is attached to Grade 11 here.
const withSlotIds = (slots, firstId) => slots.map((slot, index) => ({ slot_id: firstId + index, ...slot }))
const GRADE_7_TEMPLATE = { template_id: 1, template_name: 'Grade 7 Class Program', grade_level_id: IDS.grade7, department_id: IDS.jhsDept, slots: withSlotIds(GRADE_7_SLOTS, 1000) }
const SHS_TEMPLATE = { template_id: 2, template_name: 'Grade 12 Class Program', grade_level_id: IDS.grade11, department_id: IDS.shsDept, slots: withSlotIds(GRADE_12_SLOTS, 2000) }

const DEFAULT_QUALIFIED = [
  [IDS.math7, IDS.cruz], [IDS.english7, IDS.cruz], [IDS.science7, IDS.cruz],
  [IDS.math7, IDS.santos], [IDS.english7, IDS.santos], [IDS.science7, IDS.santos],
  [IDS.genMath, IDS.reyes], [IDS.pe11, IDS.reyes]
]

// [[subjectId, teacherId], ...] -> subject_id -> Set of teacher ids (the shape loadConflictContext() returns).
const qualifiedMap = pairs => {
  const map = new Map()
  pairs.forEach(([subjectId, teacherId]) => map.set(subjectId, new Set([...(map.get(subjectId) || []), teacherId])))
  return map
}

const makeContext = ({ existingEntries = [], teacherOverrides = {}, sectionOverrides = {}, templates = [], subjectMinutes = {}, qualified = DEFAULT_QUALIFIED } = {}) => {
  const section = (section_id, section_name, grade_level_id, grade_level_name, department_id, adviser_id) =>
    [section_id, { section_id, section_name, grade_level_id, grade_level_name, department_id, adviser_id, level: schoolLevelOf(grade_level_name), label: `${grade_level_name} - ${section_name}`, ...sectionOverrides[section_id] }]
  const teacher = (teacher_id, name) =>
    [teacher_id, { teacher_id, name, max_subject_load: null, weekly_load_minutes: null, ancillary_tasks: [], ...teacherOverrides[teacher_id] }]
  const room = (room_id, room_number, building_name, department_id) =>
    [room_id, { room_id, room_number, building_name, department_id, label: `${building_name} · Room ${room_number}` }]
  const subject = (subject_id, subject_name, grade_level_id) =>
    [subject_id, { subject_id, subject_name, grade_level_id, weekly_minutes: subjectMinutes[subject_id] ?? null, color: null }]

  return {
    termId: 1,
    sections: new Map([
      section(IDS.rizal, 'Rizal', IDS.grade7, 'Grade 7', IDS.jhsDept, IDS.santos),
      section(IDS.mabini, 'Mabini', IDS.grade7, 'Grade 7', IDS.jhsDept, IDS.cruz),
      section(IDS.stemA, 'STEM A', IDS.grade11, 'Grade 11', IDS.shsDept, IDS.reyes)
    ]),
    templates: new Map(templates.map(template => [template.grade_level_id, template])),
    qualified: qualifiedMap(qualified),
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
      subject(IDS.math7, 'Math 7', IDS.grade7),
      subject(IDS.english7, 'English 7', IDS.grade7),
      subject(IDS.science7, 'Science 7', IDS.grade7),
      subject(IDS.hgp7, 'HGP 7', IDS.grade7),
      subject(IDS.genMath, 'General Mathematics', IDS.grade11),
      subject(IDS.homeroom11, 'Homeroom', IDS.grade11),
      subject(IDS.pe11, 'Physical Education 11', IDS.grade11)
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
  delivery_mode: 'face_to_face',
  day_of_week: 'Monday',
  start_min: 450,
  end_min: 495,
  ...overrides
})
const savedEntry = overrides => classEntry({ entry_id: nextEntryId++, status: 'approved', ...overrides })

module.exports = { IDS, GRADE_7_TEMPLATE, SHS_TEMPLATE, makeContext, classEntry, savedEntry }
