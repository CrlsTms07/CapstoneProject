const express = require('express')
const { getRoles, getRoleById } = require('../controllers/rolesControllers')

const router = express.Router()

// Public endpoints to fetch roles (used by signup/login forms)
router.get('/', getRoles)
router.get('/:id', getRoleById)

module.exports = router
