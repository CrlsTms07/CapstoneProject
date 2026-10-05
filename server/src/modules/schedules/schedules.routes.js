// HIPO 3.2 – Schedule Plotter (also HIPO 8.0: teachers only see their own approved classes)
// Routes: /api/schedules
//   GET    /                       list entries (signed-in; teachers get their own approved ones)
//   GET    /:id                    one entry
//   POST   /check-conflicts        live conflict check for the plotter      (admin, chair, master teacher)
//   POST   /auto-generate          propose rows for empty periods           (admin, chair, master teacher)
//   GET    /section/:sectionId     a section's week for one term            (admin, chair, master teacher)
//   PUT    /section/:sectionId     save a section's week as drafts          (admin, chair, master teacher)
//   POST   /                       create one draft entry                   (admin, chair, master teacher)
//   PUT    /:id                    edit a draft / rejected entry            (admin, chair, master teacher)
//   DELETE /:id                    delete a draft / rejected entry          (admin, chair, master teacher)
// scopeToDepartment limits chairs to their grade level and master teachers to their department.
const express = require('express')
const {
  getSchedules,
  getScheduleById,
  checkScheduleConflicts,
  getSectionSchedule,
  saveSectionSchedule,
  autoGenerateSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule
} = require('./schedules.controller')
const { ROLES, authenticate, authorize, scopeToDepartment } = require('../../middleware/authMiddleware')

const router = express.Router()
const planners = authorize(ROLES.ADMIN, ROLES.CHAIR, ROLES.MASTER_TEACHER)

router.use(authenticate, scopeToDepartment)

router.get('/', getSchedules)
router.post('/check-conflicts', planners, checkScheduleConflicts)
router.post('/auto-generate', planners, autoGenerateSchedule)
router.get('/section/:sectionId', planners, getSectionSchedule)
router.put('/section/:sectionId', planners, saveSectionSchedule)
router.get('/:id', getScheduleById)
router.post('/', planners, createSchedule)
router.put('/:id', planners, updateSchedule)
router.delete('/:id', planners, deleteSchedule)

module.exports = router
