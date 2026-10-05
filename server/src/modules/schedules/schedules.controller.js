// HIPO 3.2 – Schedule Plotter (also HIPO 8.0: a teacher sees only their own approved classes)
// HTTP handlers for /api/schedules: list / read entries, live conflict check, the plotter's
// section week (load and save), Auto-Generate Draft, and single-entry create / update / delete.
const { HttpError, handle } = require('../../utils/httpError')
const { ROLES } = require('../../middleware/authMiddleware')
const { ENTRY_STATUSES, positiveIdOrNull, requireId, normalizeEntry, normalizeEntries } = require('./schedules.validation')
const { checkConflictsForEntries } = require('./conflict.service')
const { generateDraftForSection } = require('./autoGenerate.service')
const {
  assertTermExists, assertSectionInScope, getDraftIds,
  listEntries, getEntry, getSectionTimetable, saveSectionDraft, createEntry, updateEntry, deleteEntry
} = require('./schedules.service')

// Who is acting: the user id (for created_by) and what they may plan (req.scope from scopeToDepartment).
const actorOf = req => ({ userId: req.session.user.user_id, scope: req.scope })
const isTeacher = req => req.scope.role === ROLES.TEACHER

// GET /api/schedules?term_id=&section_id=&teacher_id=&room_id=&status=
const getSchedules = handle(async (req, res) => {
  const status = req.query.status ? String(req.query.status) : null
  if (status && !ENTRY_STATUSES.includes(status)) throw new HttpError(400, `status must be one of: ${ENTRY_STATUSES.join(', ')}.`)
  const filters = {
    termId: positiveIdOrNull(req.query.term_id),
    sectionId: positiveIdOrNull(req.query.section_id),
    teacherId: positiveIdOrNull(req.query.teacher_id),
    roomId: positiveIdOrNull(req.query.room_id),
    statuses: status ? [status] : null
  }
  if (isTeacher(req)) {
    // Teachers only ever see their own approved classes.
    if (!req.scope.teacherId) return res.json([])
    Object.assign(filters, { teacherId: req.scope.teacherId, statuses: ['approved'] })
  } else if (!req.scope.isAdmin) {
    // Chairpersons and master teachers see their own department.
    filters.departmentId = req.scope.departmentId
  }
  res.json(await listEntries(filters))
})

// GET /api/schedules/:id
const getScheduleById = handle(async (req, res) => {
  const entry = await getEntry(requireId(req.params.id, 'Schedule entry id'))
  const hidden = isTeacher(req)
    ? entry?.status !== 'approved' || entry?.teacher_id !== req.scope.teacherId
    : !req.scope.isAdmin && entry?.department_id !== req.scope.departmentId
  if (!entry || hidden) throw new HttpError(404, 'Schedule entry not found.')
  res.json(entry)
})

// POST /api/schedules/check-conflicts – the plotter calls this on every change (debounced).
// Body: { term_id, section_id, entries: [...] }. The rows replace the section's saved drafts.
const checkScheduleConflicts = handle(async (req, res) => {
  const termId = requireId(req.body.term_id, 'term_id')
  const sectionId = requireId(req.body.section_id, 'section_id')
  await assertTermExists(termId)
  await assertSectionInScope(sectionId, req.scope)
  const entries = normalizeEntries(req.body.entries, { termId, sectionId })
  const ignoreEntryIds = await getDraftIds(sectionId, termId)
  const { conflicts, teacherLoads } = await checkConflictsForEntries(entries, { termId, ignoreEntryIds })
  res.json({ conflicts, teacher_loads: teacherLoads })
})

// GET /api/schedules/section/:sectionId?term_id=
const getSectionSchedule = handle(async (req, res) => {
  const sectionId = requireId(req.params.sectionId, 'Section id')
  const termId = requireId(req.query.term_id, 'term_id')
  await assertTermExists(termId)
  await assertSectionInScope(sectionId, req.scope)
  res.json(await getSectionTimetable(sectionId, termId))
})

// PUT /api/schedules/section/:sectionId – save the plotter's week as drafts.
// Body: { term_id, header, entries }. 409 with the full conflict list when anything clashes.
const saveSectionSchedule = handle(async (req, res) => {
  const sectionId = requireId(req.params.sectionId, 'Section id')
  const termId = requireId(req.body.term_id, 'term_id')
  const entries = normalizeEntries(req.body.entries, { termId, sectionId })
  const header = req.body.header && typeof req.body.header === 'object' && !Array.isArray(req.body.header) ? req.body.header : {}
  const { timetable, teacherLoads } = await saveSectionDraft({ sectionId, termId, header, entries, actor: actorOf(req) })
  res.json({ ...timetable, teacher_loads: teacherLoads })
})

// POST /api/schedules/auto-generate – propose rows for the section's empty periods (not saved).
// Body: { term_id, section_id, entries? } – entries are the plotter's current unsaved rows.
const autoGenerateSchedule = handle(async (req, res) => {
  const termId = requireId(req.body.term_id, 'term_id')
  const sectionId = requireId(req.body.section_id, 'section_id')
  const currentEntries = req.body.entries ? normalizeEntries(req.body.entries, { termId, sectionId }) : null
  res.json(await generateDraftForSection({ termId, sectionId, scope: req.scope, currentEntries }))
})

// POST /api/schedules – one draft entry.
const createSchedule = handle(async (req, res) => {
  res.status(201).json(await createEntry(normalizeEntry(req.body), actorOf(req)))
})

// PUT /api/schedules/:id – edit a draft or rejected entry (it becomes a draft again).
const updateSchedule = handle(async (req, res) => {
  const entryId = requireId(req.params.id, 'Schedule entry id')
  res.json(await updateEntry(entryId, normalizeEntry(req.body), actorOf(req)))
})

// DELETE /api/schedules/:id – 409 when the entry is pending / approved or has approval history.
const deleteSchedule = handle(async (req, res) => {
  const entry = await deleteEntry(requireId(req.params.id, 'Schedule entry id'), actorOf(req))
  res.json({ message: 'Schedule entry deleted.', entry })
}, { action: 'delete' })

module.exports = {
  getSchedules,
  getScheduleById,
  checkScheduleConflicts,
  getSectionSchedule,
  saveSectionSchedule,
  autoGenerateSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule
}
