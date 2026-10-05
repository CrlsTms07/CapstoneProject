// HIPO 3.2 – Schedule Plotter: Auto-Generate Draft
// Fills the empty periods of one section's week with the subjects it still needs, without conflicts.
//
// The method is a simple greedy search:
//   1. Build the time slots from the department time rule (e.g. 07:00–17:00 in 45-minute periods).
//      Junior High follows the DepEd class-program layout: a slot covers Monday–Thursday together
//      (same subject, same time, 4 periods) or Friday alone. Senior High uses each day on its own.
//   2. Work out what is missing: every subject of the section's grade level needs weekly_periods
//      periods (default 5); periods the section already has are subtracted.
//   3. Pick the teacher: the one already teaching that subject to the section, otherwise qualified
//      teachers (teacher_subjects, or teachers already teaching the subject this term), lightest load first.
//   4. Fill the missing periods with the largest slots that fit, trying free slots – days without that
//      subject first – and keep the first slot + room where detectConflictsForEntries() reports nothing
//      (teacher, room, section, load and time rules: the same checks the plotter uses).
// Nothing is saved: the plotter shows the proposal and the user saves it as a normal draft.
const pool = require('../../config/database')
const { WEEK_DAYS, withTimes } = require('./schedules.validation')
const { detectConflictsForEntries, loadConflictContext, timeRuleFor, timesOverlap } = require('./conflict.service')
const { assertTermExists, assertSectionInScope, getDraftIds } = require('./schedules.service')

const DEFAULT_WEEKLY_PERIODS = 5
const MONDAY_TO_THURSDAY = WEEK_DAYS.slice(0, 4)

// Junior High: [Mon, Tue, Wed, Thu] together, then Friday (and Saturday) alone. Senior High: every day alone.
const dayGroupsFor = (level, allowedDays) => {
  if (level !== 'JHS') return allowedDays.map(day => [day])
  const together = allowedDays.filter(day => MONDAY_TO_THURSDAY.includes(day))
  const alone = allowedDays.filter(day => !MONDAY_TO_THURSDAY.includes(day)).map(day => [day])
  return together.length ? [together, ...alone] : alone
}

// Every period start of a school day, e.g. 07:00, 07:45, 08:30, ...
const periodStarts = rule => {
  const starts = []
  for (let start = rule.day_start_min; start + rule.period_minutes <= rule.day_end_min; start += rule.period_minutes) starts.push(start)
  return starts
}

// Every period of the week as separate days, e.g. Monday 07:00–07:45, Monday 07:45–08:30, ...
const buildPeriodGrid = rule => rule.allowed_days.flatMap(day =>
  periodStarts(rule).map(start => ({ day_of_week: day, start_min: start, end_min: start + rule.period_minutes })))

// Slots the planner can fill: one start time on a group of days.
const buildSlots = (rule, dayGroups) => dayGroups.flatMap(days =>
  periodStarts(rule).map(start => ({ days, start_min: start, end_min: start + rule.period_minutes })))

const periodsIn = (entry, rule) => Math.round((entry.end_min - entry.start_min) / rule.period_minutes)

const minutesTaught = (teacherId, entries) => entries
  .filter(entry => entry.teacher_id === teacherId)
  .reduce((total, entry) => total + entry.end_min - entry.start_min, 0)

// Teacher candidates for one subject in one section.
const teacherCandidates = (subjectId, sectionRows, qualified, allEntries) => {
  const current = sectionRows.find(entry => entry.subject_id === subjectId)
  if (current) return [current.teacher_id] // a subject keeps one teacher per section
  const ids = new Set(qualified.get(subjectId) || [])
  allEntries.filter(entry => entry.subject_id === subjectId && entry.teacher_id).forEach(entry => ids.add(entry.teacher_id))
  return [...ids].sort((a, b) => minutesTaught(a, allEntries) - minutesTaught(b, allEntries))
}

// Rooms the section already uses (most used first), then rooms of its department, then the rest.
const roomCandidates = (section, sectionRows, rooms) => {
  const usage = new Map()
  sectionRows.filter(entry => entry.room_id).forEach(entry => usage.set(entry.room_id, (usage.get(entry.room_id) || 0) + 1))
  const score = room => (usage.get(room.room_id) || 0) * 10 + (room.department_id === section.department_id ? 1 : 0)
  return [...rooms.values()].sort((a, b) => score(b) - score(a) || a.room_id - b.room_id).map(room => room.room_id)
}

// Tries the free slots of one size (days without this subject first), teachers and rooms until the
// checks find nothing. Returns the new entries (one per day of the slot), or null when nothing fits.
const placeOneSlot = ({ subject, teacherIds, slots, termId, section, working, sectionRows }) => {
  const subjectDays = new Set(sectionRows.filter(entry => entry.subject_id === subject.subject_id).map(entry => entry.day_of_week))
  const isFree = slot => slot.days.every(day => !sectionRows.some(entry => timesOverlap(entry, { day_of_week: day, ...slot })))
  const freeSlots = slots
    .map((slot, order) => ({ slot, order, repeats: slot.days.filter(day => subjectDays.has(day)).length }))
    .filter(item => isFree(item.slot))
    .sort((a, b) => a.repeats - b.repeats || a.order - b.order)
    .map(item => item.slot)
  const roomIds = roomCandidates(section, sectionRows, working.rooms)

  for (const slot of freeSlots) {
    for (const teacherId of teacherIds) {
      for (const roomId of roomIds) {
        const entries = slot.days.map(day => ({
          entry_id: null, term_id: termId, section_id: section.section_id, subject_id: subject.subject_id,
          teacher_id: teacherId, room_id: roomId, activity: null,
          day_of_week: day, start_min: slot.start_min, end_min: slot.end_min
        }))
        if (detectConflictsForEntries(entries, working).conflicts.length === 0) return entries
      }
    }
  }
  return null
}

// The plan itself – pure, so it can be unit-tested with an in-memory context.
const planSectionWeek = ({ termId, sectionId, context, qualified = new Map() }) => {
  const section = context.sections.get(sectionId)
  const rule = timeRuleFor(section, context.timeRules)
  const dayGroups = dayGroupsFor(section.level, rule.allowed_days)
  const slots = buildSlots(rule, dayGroups)
  const slotSizes = [...new Set(dayGroups.map(days => days.length))].sort((a, b) => b - a) // largest first
  const working = { ...context, existingEntries: [...context.existingEntries] } // grows as rows are placed
  const sectionRows = () => working.existingEntries.filter(entry => entry.section_id === sectionId)
  const generated = []
  const unfilled = []

  const subjects = [...context.subjects.values()]
    .filter(subject => subject.grade_level_id === section.grade_level_id)
    .sort((a, b) => a.subject_name.localeCompare(b.subject_name))

  for (const subject of subjects) {
    const needed = subject.weekly_periods || DEFAULT_WEEKLY_PERIODS
    const have = sectionRows().filter(entry => entry.subject_id === subject.subject_id).reduce((total, entry) => total + periodsIn(entry, rule), 0)
    let missing = needed - have
    if (missing <= 0) continue

    const teacherIds = teacherCandidates(subject.subject_id, sectionRows(), qualified, working.existingEntries)
    if (!teacherIds.length) {
      unfilled.push({ subject_id: subject.subject_id, subject_name: subject.subject_name, missing_periods: missing, reason: 'No teacher is marked as qualified for this subject.' })
      continue
    }

    // Use the largest slot that still fits (Mon–Thu = 4 periods), then smaller ones (Friday = 1).
    for (const size of slotSizes) {
      while (missing >= size) {
        const sizedSlots = slots.filter(slot => slot.days.length === size)
        const placed = placeOneSlot({ subject, teacherIds, slots: sizedSlots, termId, section, working, sectionRows: sectionRows() })
        if (!placed) break
        working.existingEntries.push(...placed)
        generated.push(...placed)
        missing -= size
      }
    }
    if (missing > 0) {
      unfilled.push({ subject_id: subject.subject_id, subject_name: subject.subject_name, missing_periods: missing, reason: 'No free slot where the section, a qualified teacher and a room are all available.' })
    }
  }
  return { generated, unfilled }
}

// API entry point. currentEntries (optional): the plotter's unsaved rows, which replace the
// section's saved drafts while planning.
const generateDraftForSection = async ({ termId, sectionId, user, currentEntries = null }) => {
  await assertTermExists(termId)
  await assertSectionInScope(sectionId, user)
  const ignoreEntryIds = currentEntries ? await getDraftIds(sectionId, termId) : []
  const context = await loadConflictContext({ termId, ignoreEntryIds })
  if (currentEntries) context.existingEntries.push(...currentEntries)

  const qualifiedRows = await pool.query('SELECT teacher_id, subject_id FROM teacher_subjects')
  const qualified = new Map()
  qualifiedRows.rows.forEach(row => qualified.set(row.subject_id, [...(qualified.get(row.subject_id) || []), row.teacher_id]))

  const { generated, unfilled } = planSectionWeek({ termId, sectionId, context, qualified })
  return { generated: generated.map(withTimes), unfilled }
}

module.exports = { DEFAULT_WEEKLY_PERIODS, dayGroupsFor, buildPeriodGrid, planSectionWeek, generateDraftForSection }
