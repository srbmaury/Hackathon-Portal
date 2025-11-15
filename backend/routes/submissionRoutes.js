const express = require("express");
const router = express.Router();
const submissionController = require("../controllers/submissionController");
const { protect } = require("../middleware/auth");
const { hackathonRoleCheck } = require("../middleware/hackathonRoleCheck");
const upload = require("../middleware/upload");

// Submit for a round (with file upload)
router.post("/:roundId", protect, upload.single("file"), submissionController.submit);

// Get my submission for a round
router.get("/:roundId/my", protect, submissionController.getMySubmission);

// Get all submissions for a round (organizer/admin only)
router.get("/:roundId/all", protect, submissionController.getAllSubmissions);

// Get standings for a round
router.get("/:roundId/standings", protect, submissionController.getStandings);

// Update submission (organizer/admin only)
router.put("/:submissionId", protect, submissionController.updateSubmission);

// AI-powered routes (role check is done in controller since we need to find hackathon from submission/round)
router.post("/:submissionId/evaluate", protect, submissionController.evaluate);
router.post("/:submissionId/generate-feedback", protect, submissionController.generateFeedback);
router.get("/:roundId/compare", protect, submissionController.compare);

module.exports = router;

