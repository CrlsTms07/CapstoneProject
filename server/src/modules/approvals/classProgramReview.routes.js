// HIPO 5.0 – Approvals (JHS class programs)
// Routes (admin only): GET /api/class-programs/pending, PUT /api/class-programs/:programId/review
// Mounted on /api/class-programs before modules/schedules/classPrograms.routes.js.
const express = require('express')
const { getPendingClassPrograms, reviewClassProgram } = require('./classProgramReview.controller')
const { authenticateUser, authorizeRoles } = require('../../middleware/authMiddleware')

const router = express.Router()
router.use(authenticateUser)
router.get('/pending', authorizeRoles(1), getPendingClassPrograms)
router.put('/:programId/review', authorizeRoles(1), reviewClassProgram)

module.exports = router
