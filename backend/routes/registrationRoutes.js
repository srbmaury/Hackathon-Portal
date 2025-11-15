const express = require("express");
const router = express.Router();
const registrationController = require("../controllers/registrationController");
const { protect } = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");

// Register a team for a hackathon
router.post("/:hackathonId/register", protect, (req, res) =>
    registrationController.register(req, res)
);

// Get all teams for a hackathon (public - all authenticated users)
router.get("/:hackathonId/teams/public", protect, (req, res) =>
    registrationController.getTeams(req, res)
);

// Get all teams registered for a hackathon (admin/organizer)
router.get("/:hackathonId/teams", protect, roleCheck("organizer", "admin"), (req, res) =>
    registrationController.getTeams(req, res)
);

// Withdraw a team registration
router.delete("/:hackathonId/teams/:teamId", protect, (req, res) =>
    registrationController.withdraw(req, res)
);

// Update a team registration (modify team details)
router.put("/:hackathonId/teams/:teamId", protect, (req, res) =>
    registrationController.update(req, res)
);

// Get current user's team for a hackathon
router.get("/:hackathonId/my", protect, (req, res) =>
    registrationController.getMyTeam(req, res)
);

// Get all teams for current user
router.get("/my-teams", protect, (req, res) =>
    registrationController.getMyTeams(req, res)
);

module.exports = router;
