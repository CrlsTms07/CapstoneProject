// HIPO 10.0 – Guest schedule view
// Routes (no login): GET /api/public/terms, /departments, /sections?department_id=,
// /schedules?term_id=&department_id=&section_id= (approved entries of the active term by default).
// Read-only: any other method gets 405.
const express = require('express')
const { getTerms, getDepartments, getSections, getSchedules } = require('./public.controller')

const router = express.Router()

router.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next()
  res.status(405).json({ error: 'The guest view is read-only.' })
})

router.get('/terms', getTerms)
router.get('/departments', getDepartments)
router.get('/sections', getSections)
router.get('/schedules', getSchedules)

module.exports = router
