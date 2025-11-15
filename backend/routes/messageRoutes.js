const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const { protect } = require("../middleware/auth");

// Get all messages for a team
router.get("/:teamId/messages", protect, (req, res) =>
    messageController.getMessages(req, res)
);

// Send a message to a team
router.post("/:teamId/messages", protect, (req, res) =>
    messageController.sendMessage(req, res)
);

// Generate meeting summary from team chat
router.post("/:teamId/messages/summary", protect, (req, res) =>
    messageController.generateSummary(req, res)
);

module.exports = router;

