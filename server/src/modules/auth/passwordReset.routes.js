// HIPO 2.0 – Login (account recovery)
// Routes: POST /api/password-reset-requests (public); GET + POST /:id/:decision (admin).
const express = require("express");
const { submitRequest, getRequests, decideRequest } = require("./passwordReset.controller");
const { ROLES, authenticate, authorize } = require("../../middleware/authMiddleware");

const router = express.Router();

router.post("/", submitRequest);
router.get("/", authenticate, authorize(ROLES.ADMIN), getRequests);
router.post("/:id/:decision", authenticate, authorize(ROLES.ADMIN), decideRequest);

module.exports = router;