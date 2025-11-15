const express = require("express");
const router = express.Router();
const hackathonController = require("../controllers/hackathonController");
const { protect } = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const { hackathonRoleCheck, isHackathonMember } = require("../middleware/hackathonRoleCheck");
const announcementRoutes = require("./announcementRoutes");

// Format hackathon description using AI (hackathon_creator/admin only)
router.post("/format", protect, roleCheck("hackathon_creator", "admin"), (req, res) =>
    hackathonController.format(req, res)
);

// Suggest round structure using AI (hackathon_creator/admin only)
router.post("/suggest-round", protect, roleCheck("hackathon_creator", "admin"), (req, res) =>
    hackathonController.suggestRound(req, res)
);

// Suggest multiple rounds using AI (hackathon_creator/admin only)
router.post("/suggest-rounds", protect, roleCheck("hackathon_creator", "admin"), (req, res) =>
    hackathonController.suggestRounds(req, res)
);

// Create new hackathon (hackathon_creator/admin only)
router.post("/", protect, roleCheck("hackathon_creator", "admin"), (req, res) =>
    hackathonController.create(req, res)
);

// Get all hackathons (active visible to all, inactive visible to hackathon_creator/admin)
router.get("/", protect, (req, res) => hackathonController.getAll(req, res));

// Get specific hackathon by ID (respect visibility rule)
router.get("/:id", protect, (req, res) => hackathonController.getById(req, res));

// Update hackathon (admin or hackathon organizer only)
router.put("/:id", protect, hackathonRoleCheck("organizer"), (req, res) =>
    hackathonController.update(req, res)
);

// Delete hackathon (admin or hackathon organizer only)
router.delete("/:id", protect, hackathonRoleCheck("organizer"), (req, res) =>
    hackathonController.delete(req, res)
);

// === Role Management Routes ===

// Assign role to user in hackathon (organizer/admin only)
router.post("/:id/roles", protect, hackathonRoleCheck("organizer"), (req, res) =>
    hackathonController.assignRole(req, res)
);

// Remove role from user in hackathon (organizer/admin only)
router.delete("/:id/roles/:userId", protect, hackathonRoleCheck("organizer"), (req, res) =>
    hackathonController.removeRole(req, res)
);

// Get all members of a hackathon (any member can view)
router.get("/:id/members", protect, isHackathonMember, (req, res) =>
    hackathonController.getMembers(req, res)
);

// Get current user's role in a hackathon
router.get("/:id/my-role", protect, (req, res) =>
    hackathonController.getMyRole(req, res)
);

// Assign teams to mentors using AI (organizer/admin only)
router.post("/:id/assign-mentors", protect, hackathonRoleCheck("organizer"), (req, res) =>
    hackathonController.assignMentors(req, res)
);

// === Nested Routes ===

// Announcements for a specific hackathon
router.use("/:hackathonId/announcements", announcementRoutes);

module.exports = router;
