// HIPO 7.0 – Export PDF/CSV
// Routes: /api/document-settings
//   GET /                 every department's printed class-program settings (signed-in users, for printing)
//   GET /:departmentId    one department's settings                          (signed-in users)
//   PUT /:departmentId    save header lines, signatories, DepEd Orders, doc ref code, revision (admin)
const express = require('express')
const { getAllDocumentSettings, getDocumentSettings, saveDocumentSettings } = require('./documentSettings.controller')
const { ROLES, authenticate, authorize } = require('../../middleware/authMiddleware')

const router = express.Router()

router.use(authenticate)

router.get('/', getAllDocumentSettings)
router.get('/:departmentId', getDocumentSettings)
router.put('/:departmentId', authorize(ROLES.ADMIN), saveDocumentSettings)

module.exports = router
