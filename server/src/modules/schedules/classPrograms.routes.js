// HIPO 3.2 – Schedule Plotter (JHS class programs, Grades 7–10)
// Routes: GET /api/class-programs/section/:sectionId, POST /validate (live conflict check), POST / (save draft / submit).
const express = require('express')
const {
  getProgramForSection,
  validateClassProgram,
  saveClassProgram,
  getPendingClassPrograms,
  reviewClassProgram
} = require('./classPrograms.controller')
const { authenticateUser, authorizeRoles } = require('../../middleware/authMiddleware')

const router = express.Router()
router.use(authenticateUser)
router.get('/pending', authorizeRoles(1), getPendingClassPrograms)
router.get('/section/:sectionId', authorizeRoles(1, 2), getProgramForSection)
router.post('/validate', authorizeRoles(1, 2), validateClassProgram)
router.post('/', authorizeRoles(1, 2), saveClassProgram)
router.put('/:programId/review', authorizeRoles(1), reviewClassProgram)

module.exports = router