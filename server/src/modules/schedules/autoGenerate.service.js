// HIPO 3.2 – Schedule Plotter: Auto-Generate Draft
// Proposes a conflict-free week for one section from its grade level's time template. Nothing is saved:
// the plotter shows the proposal and the user saves it as a normal draft.
//
// Junior High (MON_THU + FRI):
//   the n-th class period of MON_THU and the n-th class period of FRI form one placement, so a subject keeps
//   its place in the order every day and Friday mirrors Monday–Thursday. Friday's extra period at the end
//   (HGP) is kept for the homeroom subject, taught by the section's class adviser.
// Senior High (one pattern per weekday):
//   2-hour and 1-hour blocks inside every class slot, on the 30-minute grid. The asynchronous window keeps
//   its delivery mode and needs no room. Homeroom is placed first, then PE, then the remaining subjects.
// Both:
//   subjects go largest weekly_minutes first. For each one the planner tries the free placements (largest
//   that still fits, days without that subject first), then the teacher(s), then the rooms, and keeps the
//   first combination that detectConflictsForEntries() – the same checks as the plotter – finds nothing
//   wrong with. So the proposal can never contain a conflict; what does not fit is listed in `unfilled`.
const { WEEK_DAYS, withTimes } = require('./schedules.validation')
const { detectConflictsForEntries, loadConflictContext, templateFor, daySlotsFor, timesOverlap, teacherIdsOf, weeklyMinutesOf, isHomeroomSubject, SHS_GRID_MINUTES } = require('./conflict.service')
const { assertTermExists, assertSectionInScope, getDraftIds } = require('./schedules.service')

const SHS_BLOCK_MINUTES = 120
const SHS_SHORT_BLOCK_MINUTES = 60
const SCHOOL_DAYS = WEEK_DAYS.slice(0, 5)
const MONDAY_TO_THURSDAY = WEEK_DAYS.slice(0, 4)

const isPeSubject = subject => /\b(p\.?e\.?|physical education)(?=\W|$)/i.test(subject.subject_name)
const classSlotsOf = (template, day) => daySlotsFor(template, day).filter(slot => slot.slot_type === 'class')
const partsMinutes = parts => parts.reduce((total, part) => total + part.end_min - part.start_min, 0)
const partOf = (day, slot, extra = {}) => ({ day_of_week: day, start_min: slot.start_min, end_min: slot.end_min, ...extra })

// ---------------------------------------------------------------------------------------------
// Placements: where a subject may go. { parts: [{ day_of_week, start_min, end_min, delivery_mode? }], homeroom }
// ---------------------------------------------------------------------------------------------

// Junior High: MON_THU period n mirrored to FRI period n. Friday periods without a partner are for HGP.
const jhsPlacements = template => {
  const monThu = classSlotsOf(template, 'Monday')
  const friday = classSlotsOf(template, 'Friday')
  const paired = monThu.map((slot, index) => ({
    parts: [...MONDAY_TO_THURSDAY.map(day => partOf(day, slot)), ...(friday[index] ? [partOf('Friday', friday[index])] : [])],
    homeroom: false
  }))
  const extraFriday = friday.slice(monThu.length).map(slot => ({ parts: [partOf('Friday', slot)], homeroom: true }))
  return [...paired, ...extraFriday]
}

// Senior High: 2-hour and 1-hour blocks inside each class slot of each day. A shorter slot is offered whole.
const shsPlacements = template => SCHOOL_DAYS.flatMap(day => classSlotsOf(template, day).flatMap(slot => {
  const blocks = []
  const add = (start, end) => blocks.push({
    parts: [partOf(day, { start_min: start, end_min: end }, { delivery_mode: slot.default_delivery_mode || 'face_to_face' })],
    homeroom: false
  })
  const length = slot.end_min - slot.start_min
  if (length < SHS_SHORT_BLOCK_MINUTES && length % SHS_GRID_MINUTES === 0) add(slot.start_min, slot.end_min)
  for (const size of [SHS_BLOCK_MINUTES, SHS_SHORT_BLOCK_MINUTES]) {
    for (let start = slot.start_min; start + size <= slot.end_min; start += size) add(start, start + size)
  }
  return blocks
}))

const buildPlacements = (template, level) => (level === 'SHS' ? shsPlacements(template) : jhsPlacements(template))
  .map((placement, order) => ({ ...placement, minutes: partsMinutes(placement.parts), order }))

// Junior High keeps the extra Friday period for HGP and HGP out of the mirrored periods.
const placementsFor = (subject, level, placements) => level === 'SHS'
  ? placements
  : placements.filter(placement => placement.homeroom === isHomeroomSubject(subject))

// The parts of a placement the section still has free. A placement that is partly filled by THIS
// subject is completed (e.g. only Friday is missing); one that holds anything else is skipped.
const freePartsOf = (placement, subjectId, sectionRows) => {
  const free = []
  for (const part of placement.parts) {
    const taken = sectionRows.filter(entry => timesOverlap(entry, part))
    if (!taken.length) free.push(part)
    else if (taken.some(entry => entry.subject_id !== subjectId)) return []
  }
  return free
}

// ---------------------------------------------------------------------------------------------
// Order of subjects, teachers and rooms
// ---------------------------------------------------------------------------------------------

// Senior High: Homeroom, then PE, then the rest. Within a group: most weekly minutes first.
const subjectQueue = (subjects, level) => {
  const group = subject => level !== 'SHS' ? 0 : isHomeroomSubject(subject) ? 0 : isPeSubject(subject) ? 1 : 2
  return [...subjects].sort((a, b) => group(a) - group(b) ||
    (b.weekly_minutes || 0) - (a.weekly_minutes || 0) || a.subject_name.localeCompare(b.subject_name))
}

const minutesTaught = (teacherId, entries) => entries
  .filter(entry => teacherIdsOf(entry).includes(teacherId))
  .reduce((total, entry) => total + weeklyMinutesOf(entry), 0)

// Teacher sets (primary first) to try for one subject in one section:
//   the teacher(s) the section already has for it → the class adviser for HGP / Homeroom →
//   teachers qualified in teacher_subjects, lightest load first.
const teacherCandidates = (subject, section, sectionRows, context) => {
  const current = sectionRows.find(entry => entry.subject_id === subject.subject_id)
  if (current) return [teacherIdsOf(current)]
  if (isHomeroomSubject(subject)) return section.adviser_id ? [[section.adviser_id]] : []
  return [...(context.qualified?.get(subject.subject_id) || [])]
    .sort((a, b) => minutesTaught(a, context.existingEntries) - minutesTaught(b, context.existingEntries) || a - b)
    .map(id => [id])
}

// Rooms the section already uses (most used first), then rooms of its department, then the rest.
const roomCandidates = (section, sectionRows, rooms) => {
  const usage = new Map()
  sectionRows.filter(entry => entry.room_id).forEach(entry => usage.set(entry.room_id, (usage.get(entry.room_id) || 0) + 1))
  const score = room => (usage.get(room.room_id) || 0) * 10 + (room.department_id === section.department_id ? 1 : 0)
  return [...rooms.values()].sort((a, b) => score(b) - score(a) || a.room_id - b.room_id).map(room => room.room_id)
}

const noTeacherReason = (subject, section) => isHomeroomSubject(subject)
  ? `${section.label} has no class adviser to teach ${subject.subject_name}.`
  : 'No teacher is marked as qualified for this subject.'

// ---------------------------------------------------------------------------------------------
// Placing one subject
// ---------------------------------------------------------------------------------------------

const entriesFor = ({ parts, subject, teacherIds, roomId, termId, section }) => {
  const asynchronous = parts.every(part => part.delivery_mode === 'asynchronous')
  return parts.map(part => ({
    entry_id: null, term_id: termId, section_id: section.section_id, subject_id: subject.subject_id,
    teacher_id: teacherIds[0], teacher_ids: teacherIds, room_id: asynchronous ? null : roomId, activity: null,
    delivery_mode: asynchronous ? 'asynchronous' : 'face_to_face',
    day_of_week: part.day_of_week, start_min: part.start_min, end_min: part.end_min
  }))
}

// Free placements that fit in the missing minutes: largest first, days without this subject first.
const candidatePartsFor = (subject, placements, missing, sectionRows) => {
  const subjectDays = new Set(sectionRows.filter(entry => entry.subject_id === subject.subject_id).map(entry => entry.day_of_week))
  return placements
    .map(placement => ({ order: placement.order, parts: freePartsOf(placement, subject.subject_id, sectionRows) }))
    .filter(item => item.parts.length && partsMinutes(item.parts) <= missing)
    .map(item => ({ ...item, minutes: partsMinutes(item.parts), repeats: item.parts.filter(part => subjectDays.has(part.day_of_week)).length }))
    .sort((a, b) => b.minutes - a.minutes || a.repeats - b.repeats || a.order - b.order)
    .map(item => item.parts)
}

// The first placement + teacher(s) + room with no conflict at all, or null.
const placeOnce = ({ subject, teacherSets, placements, missing, termId, section, working, sectionRows }) => {
  const roomIds = roomCandidates(section, sectionRows, working.rooms)
  for (const parts of candidatePartsFor(subject, placements, missing, sectionRows)) {
    const asynchronous = parts.every(part => part.delivery_mode === 'asynchronous')
    for (const teacherIds of teacherSets) {
      for (const roomId of asynchronous ? [null] : roomIds) {
        const entries = entriesFor({ parts, subject, teacherIds, roomId, termId, section })
        if (detectConflictsForEntries(entries, working).conflicts.length === 0) return entries
      }
    }
  }
  return null
}

const unfilledOf = (subject, missing, reason) => ({ subject_id: subject.subject_id, subject_name: subject.subject_name, missing_minutes: missing, reason })

// ---------------------------------------------------------------------------------------------
// planSectionWeek – the whole plan (pure, unit-tested with an in-memory context)
// ---------------------------------------------------------------------------------------------
const planSectionWeek = ({ termId, sectionId, context }) => {
  const section = context.sections.get(sectionId)
  const template = templateFor(section, context.templates)
  const subjects = subjectQueue([...context.subjects.values()].filter(subject => subject.grade_level_id === section.grade_level_id), section.level)
  if (!template) {
    return { generated: [], unfilled: subjects.map(subject => unfilledOf(subject, subject.weekly_minutes || null, `${section.grade_level_name} has no time template yet.`)) }
  }

  const placements = buildPlacements(template, section.level)
  const working = { ...context, existingEntries: [...context.existingEntries] } // grows as rows are placed
  const sectionRows = () => working.existingEntries.filter(entry => entry.section_id === sectionId)
  const generated = []
  const unfilled = []

  for (const subject of subjects) {
    if (!subject.weekly_minutes) {
      unfilled.push(unfilledOf(subject, null, 'Weekly minutes are not set for this subject.'))
      continue
    }
    const have = sectionRows().filter(entry => entry.subject_id === subject.subject_id).reduce((total, entry) => total + weeklyMinutesOf(entry), 0)
    let missing = subject.weekly_minutes - have
    if (missing <= 0) continue

    const teacherSets = teacherCandidates(subject, section, sectionRows(), working)
    if (!teacherSets.length) {
      unfilled.push(unfilledOf(subject, missing, noTeacherReason(subject, section)))
      continue
    }

    const allowed = placementsFor(subject, section.level, placements)
    while (missing > 0) {
      const placed = placeOnce({ subject, teacherSets, placements: allowed, missing, termId, section, working, sectionRows: sectionRows() })
      if (!placed) break
      working.existingEntries.push(...placed)
      generated.push(...placed)
      missing -= partsMinutes(placed)
    }
    if (missing > 0) {
      unfilled.push(unfilledOf(subject, missing, 'No free class slot where the section, a qualified teacher and a room are all available.'))
    }
  }
  return { generated, unfilled }
}

// API entry point. currentEntries (optional): the plotter's unsaved rows, which replace the
// section's saved drafts while planning.
const generateDraftForSection = async ({ termId, sectionId, scope, currentEntries = null }) => {
  await assertTermExists(termId)
  await assertSectionInScope(sectionId, scope)
  const ignoreEntryIds = currentEntries ? await getDraftIds(sectionId, termId) : []
  const context = await loadConflictContext({ termId, ignoreEntryIds })
  if (currentEntries) context.existingEntries.push(...currentEntries)

  const { generated, unfilled } = planSectionWeek({ termId, sectionId, context })
  return { generated: generated.map(withTimes), unfilled }
}

module.exports = { SHS_BLOCK_MINUTES, buildPlacements, subjectQueue, isPeSubject, planSectionWeek, generateDraftForSection }
