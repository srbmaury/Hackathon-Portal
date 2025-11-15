const express = require("express");
const router = express.Router({ mergeParams: true }); // mergeParams to access :hackathonId from parent router
const { protect } = require('../middleware/auth'); // JWT auth middleware
const { hackathonRoleCheck, isHackathonMember } = require("../middleware/hackathonRoleCheck");
const AnnouncementController = require("../controllers/announcementController");

// All routes are prefixed with /api/hackathons/:hackathonId/announcements
router.get("/", protect, isHackathonMember, (req, res) => AnnouncementController.get(req, res));
router.post("/", protect, hackathonRoleCheck("organizer"), (req, res) => AnnouncementController.create(req, res));
router.put("/:id", protect, hackathonRoleCheck("organizer"), (req, res) => AnnouncementController.update(req, res));
router.delete("/:id", protect, hackathonRoleCheck("organizer"), (req, res) => AnnouncementController.delete(req, res));

// AI-powered routes
router.post("/format", protect, hackathonRoleCheck("organizer"), (req, res) => AnnouncementController.format(req, res));
router.post("/enhance", protect, hackathonRoleCheck("organizer"), (req, res) => AnnouncementController.enhance(req, res));

module.exports = router;
