const express = require("express");
const router = express.Router();
const demoStageController = require("../controllers/demoStageController");
const { protect } = require("../middleware/auth");
const { videoUpload } = require("../middleware/upload");

// Schedule or create a demo session
router.post("/sessions", protect, demoStageController.createDemoSession);
// Get all demo sessions for a hackathon
router.get("/sessions/:hackathonId", demoStageController.getDemoSessions);
// Update session details (video URL, times, etc.)
router.patch("/sessions/:sessionId", protect, demoStageController.updateSession);
// Generate AI summary and highlights for a session
router.post("/summary/:sessionId", protect, demoStageController.generateDemoSummary);
// Upload video for a session (uses Cloudinary for video storage)
router.post("/upload-video", protect, videoUpload.single("video"), demoStageController.uploadSessionVideo);
// Step 1: Generate schedule preview using AI
router.post("/sessions/ai-generate-preview", protect, demoStageController.generateDemoScheduleAI);
// Step 2: Confirm and create sessions from schedule
router.post("/sessions/ai-generate-confirm", protect, demoStageController.confirmDemoScheduleAI);
// Delete a demo session (organizer only)
router.delete("/sessions/:sessionId", protect, demoStageController.deleteDemoSession);
// Reschedule a demo session (organizer only)
router.patch("/sessions/:sessionId/reschedule", protect, demoStageController.rescheduleDemoSession);
module.exports = router;
