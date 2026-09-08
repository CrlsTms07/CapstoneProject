const express = require('express');
const { getPublicSchedules } = require('../controllers/publicSchedulesControllers');

const router = express.Router();

// Public access: no authentication required
router.get('/', getPublicSchedules);

module.exports = router;
