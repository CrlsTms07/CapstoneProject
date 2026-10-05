const express = require("express");
const { submitRequest, getRequests, decideRequest } = require("../controllers/passwordResetRequestsControllers");
const { authenticateUser, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", submitRequest);
router.get("/", authenticateUser, authorizeRoles(1), getRequests);
router.post("/:id/:decision", authenticateUser, authorizeRoles(1), decideRequest);

module.exports = router;