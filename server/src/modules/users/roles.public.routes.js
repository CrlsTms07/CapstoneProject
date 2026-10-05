// HIPO 4.3 – Users & Roles
// Routes: GET /api/roles/public, /api/roles/public/:id (no login; used by the sign-up form).
const express = require('express')
const { getPublicRoles, getRoleById } = require('./roles.controller')

const router = express.Router()

// Public endpoints to fetch roles (used by signup/login forms)
router.get('/', getPublicRoles)
router.get('/:id', getRoleById)

module.exports = router
