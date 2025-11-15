const express = require("express");
const router = express.Router();
const { protect } = require('../middleware/auth');
const AnnouncementController = require("../controllers/announcementController");

// General announcements routes (not hackathon-specific)
router.get("/", protect, (req, res) => AnnouncementController.getAll(req, res));
router.post("/", protect, (req, res) => {
    // For general announcements, we need a hackathon ID
    // This should probably be handled differently, but for now return error
    return res.status(400).json({ 
        message: req.__("announcement.hackathon_required") || "Hackathon ID is required for announcements" 
    });
});
router.put("/:id", protect, (req, res) => {
    return res.status(400).json({ 
        message: req.__("announcement.hackathon_required") || "Hackathon ID is required for announcements" 
    });
});
router.delete("/:id", protect, async (req, res) => {
    // Allow deletion of general announcements
    const Announcement = require("../models/Announcement");
    try {
        const { id } = req.params;
        const announcement = await Announcement.findById(id);

        if (!announcement) {
            return res.status(404).json({ 
                message: req.__("announcement.not_found") 
            });
        }

        // Check if user can delete (creator or admin)
        if (
            !announcement.createdBy.equals(req.user._id) &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({ 
                message: req.__("auth.forbidden") 
            });
        }

        // Verify announcement belongs to user's organization
        if (String(announcement.organization) !== String(req.user.organization._id || req.user.organization)) {
            return res.status(403).json({ 
                message: req.__("auth.forbidden") 
            });
        }

        await Announcement.findByIdAndDelete(id);
        res.json({ message: req.__("announcement.deleted_successfully") });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: req.__("announcement.delete_failed"),
            error: err.message,
        });
    }
});

module.exports = router;

