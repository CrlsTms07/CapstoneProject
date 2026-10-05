// HIPO 3.2 – Schedule Plotter (terms)
// Routes: GET /api/terms (signed-in), POST / PUT / DELETE /api/terms/:id (admin).
const express = require('express')
const { getTerms, createTerm, updateTerm, removeTerm } = require('./terms.controller')
const { authenticateUser, authorizeRoles } = require('../../middleware/authMiddleware')

const router = express.Router()
router.use(authenticateUser)
router.get('/', getTerms)
router.post('/', authorizeRoles(1), createTerm)
router.put('/:id', authorizeRoles(1), updateTerm)
router.delete('/:id', authorizeRoles(1), removeTerm)

module.exports = router
