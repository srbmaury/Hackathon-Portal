const express = require("express");
const router = express.Router();
const demoStageController = require("../controllers/demoStageController");
const { protect } = require("../middleware/auth");
const { videoUpload } = require("../middleware/upload");

// Schedule or create a demo session
router.post("/sessions", protect, demoStageController.createDemoSession);
// Get all demo sessions for a hackathon
router.get("/sessions/:hackathonId", demoStageController.getDemoSessions);
// Update session status (go live, complete, etc.)
router.patch("/sessions/:sessionId/status", protect, demoStageController.updateSessionStatus);
// Update session details (video URL, times, etc.)
router.patch("/sessions/:sessionId", protect, demoStageController.updateSession);
// Generate AI summary and highlights for a session
router.post("/summary/:sessionId", protect, demoStageController.generateDemoSummary);
// Upload video for a session (uses Cloudinary for video storage)
router.post("/upload-video", protect, videoUpload.single("video"), demoStageController.uploadSessionVideo);

module.exports = router;
