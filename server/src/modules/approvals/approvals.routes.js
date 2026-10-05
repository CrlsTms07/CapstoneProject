// HIPO 5.0 – Approvals
// Routes: /api/approvals
//   POST /submit        draft -> pending                     (admin, chair, master teacher; own scope)
//   POST /review        pending -> approved / rejected       (admin)
//   GET  /submissions   section weeks and their status       (admin, chair, master teacher; own scope)
//   GET  /logs          audit trail (approval_logs)          (admin, chair, master teacher; own scope)
const express = require('express')
const { submit, review, getSubmissions, getLogs } = require('./approvals.controller')
const { ROLES, authenticate, authorize, scopeToDepartment } = require('../../middleware/authMiddleware')

const router = express.Router()
const planners = authorize(ROLES.ADMIN, ROLES.CHAIR, ROLES.MASTER_TEACHER)

router.use(authenticate, scopeToDepartment)

router.post('/submit', planners, submit)
router.post('/review', authorize(ROLES.ADMIN), review)
router.get('/submissions', planners, getSubmissions)
router.get('/logs', planners, getLogs)

module.exports = router
