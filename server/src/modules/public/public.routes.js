// HIPO 10.0 – Guest schedule view
// Routes: GET /api/public/schedules?department_id=&section_id= (no login required).
const express = require('express');
const { getPublicSchedules } = require('./public.controller');

const router = express.Router();

// Public access: no authentication required
router.get('/', getPublicSchedules);

module.exports = router;
