const express = require("express");
const router = express.Router();
const reminderController = require("../controllers/reminderController");
const { protect } = require("../middleware/auth");

// Analyze risk for a specific team and round
router.get("/team/:teamId/round/:roundId", protect, (req, res) =>
    reminderController.analyzeTeamRisk(req, res)
);

// Get all teams at risk for a round
router.get("/round/:roundId/at-risk", protect, (req, res) =>
    reminderController.getAtRiskTeams(req, res)
);

// Send reminder message to a team
router.post("/team/:teamId/round/:roundId/send", protect, (req, res) =>
    reminderController.sendReminder(req, res)
);

module.exports = router;

