const express = require('express')
const { getPublicRoles, getRoleById } = require('../controllers/rolesControllers')

const router = express.Router()

// Public endpoints to fetch roles (used by signup/login forms)
router.get('/', getPublicRoles)
router.get('/:id', getRoleById)

module.exports = router
