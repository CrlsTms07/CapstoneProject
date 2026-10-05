// HIPO 3.2 – Schedule Plotter (terms)
// Routes: GET /api/terms (signed-in), POST / PUT / DELETE /api/terms/:id (admin).
const express = require('express')
const { getTerms, createTerm, updateTerm, removeTerm } = require('./terms.controller')
const { ROLES, authenticate, authorize } = require('../../middleware/authMiddleware')

const router = express.Router()
router.use(authenticate)
router.get('/', getTerms)
router.post('/', authorize(ROLES.ADMIN), createTerm)
router.put('/:id', authorize(ROLES.ADMIN), updateTerm)
router.delete('/:id', authorize(ROLES.ADMIN), removeTerm)

module.exports = router
