// HIPO 10.0 – Guest schedule view
// HTTP handlers for /api/public (no login, read-only, approved schedules only).
const { handle } = require('../../utils/httpError')
const { positiveIdOrNull } = require('../schedules/schedules.validation')
const { readScheduleFilters } = require('./public.validation')
const { listTerms, listDepartments, listSections, listApprovedSchedules } = require('./public.service')

const getTerms = handle(async (req, res) => res.json(await listTerms()))
const getDepartments = handle(async (req, res) => res.json(await listDepartments()))
const getSections = handle(async (req, res) => res.json(await listSections(positiveIdOrNull(req.query.department_id))))
const getSchedules = handle(async (req, res) => res.json(await listApprovedSchedules(readScheduleFilters(req.query))))

module.exports = { getTerms, getDepartments, getSections, getSchedules }
