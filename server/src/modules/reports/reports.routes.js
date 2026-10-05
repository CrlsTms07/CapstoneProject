// HIPO 6.0 – Reports (with HIPO 7.0 exports)
// Routes: GET /api/reports                 report types
//         GET /api/reports/:type?term_id=&section_id|teacher_id|room_id=&format=json|csv|pdf
// Admin, chair and master teacher (own department). A teacher may only get the "teacher" report,
// and reports.service.js checks that it is their own schedule.
const express = require('express')
const { getReport, getReportTypes } = require('./reports.controller')
const { ROLES, authenticate, authorize, scopeToDepartment } = require('../../middleware/authMiddleware')

const router = express.Router()
const staffOnly = authorize(ROLES.ADMIN, ROLES.CHAIR, ROLES.MASTER_TEACHER)

// Lets teachers through for their own teacher schedule only.
const staffOrOwnTeacherReport = (req, res, next) => {
  if (req.scope.role === ROLES.TEACHER && req.params.type === 'teacher') return next()
  staffOnly(req, res, next)
}

router.use(authenticate, scopeToDepartment)

router.get('/', getReportTypes)
router.get('/:type', staffOrOwnTeacherReport, getReport)

module.exports = router
