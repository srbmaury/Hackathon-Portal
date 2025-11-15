const Announcement = require("../models/Announcement");
const Hackathon = require("../models/Hackathon");
const { formatAnnouncement, enhanceAnnouncement } = require("../services/announcementFormattingService");
const { emitAnnouncementCreated, emitAnnouncementUpdated } = require("../socket");

class AnnouncementController {
    /**
     * Get all announcements for user's organization (across all hackathons)
     * @route GET /api/announcements
     */
    async getAll(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            // Get all announcements for user's organization
            const filter = { 
                organization: req.user.organization 
            };

            const total = await Announcement.countDocuments(filter);
            const totalPages = Math.ceil(total / limit);

            const announcements = await Announcement.find(filter)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .populate("createdBy", "name email")
                .populate("hackathon", "title") || [];

            res.json({ announcements, totalPages, total });
        } catch (err) {
            console.error(err);
            res.status(500).json({ 
                message: req.__("announcement.get_failed"), 
                error: err.message 
            });
        }
    }

    /**
     * Get announcements for a specific hackathon
     * @route GET /api/hackathons/:hackathonId/announcements
     */
    async get(req, res) {
        try {
            const { hackathonId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            // Verify hackathon exists
            const hackathon = await Hackathon.findById(hackathonId);
            if (!hackathon) {
                return res.status(404).json({ 
                    message: req.__("hackathon.not_found") 
                });
            }

            // Only announcements of this hackathon
            const filter = { 
                hackathon: hackathonId,
                organization: req.user.organization 
            };

            const total = await Announcement.countDocuments(filter);
            const totalPages = Math.ceil(total / limit);

            const announcements = await Announcement.find(filter)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .populate("createdBy", "name email")
                .populate("hackathon", "title") || [];

            res.json({ announcements, totalPages, total });
        } catch (err) {
            console.error(err);
            res.status(500).json({ 
                message: req.__("announcement.get_failed"), 
                error: err.message 
            });
        }
    }

    /**
     * Create announcement for a specific hackathon
     * @route POST /api/hackathons/:hackathonId/announcements
     */
    async create(req, res) {
        try {
            const { hackathonId } = req.params;
            let { title, message, useAIFormatting } = req.body;

            // Verify hackathon exists
            const hackathon = await Hackathon.findById(hackathonId);
            if (!hackathon) {
                return res.status(404).json({ 
                    message: req.__("hackathon.not_found") 
                });
            }

            // Verify hackathon belongs to user's organization
            if (String(hackathon.organization) !== String(req.user.organization._id)) {
                return res.status(403).json({ 
                    message: req.__("hackathon.access_denied") 
                });
            }

            // Apply AI formatting if requested
            if (useAIFormatting && process.env.AI_ENABLED !== "false") {
                try {
                    const formatted = await formatAnnouncement(title, message, hackathon.title);
                    title = formatted.title;
                    message = formatted.message;
                } catch (aiError) {
                    console.error("AI formatting error (using original):", aiError);
                    // Continue with original content if AI fails
                }
            }

            const announcement = await Announcement.create({
                title,
                message,
                createdBy: req.user._id,
                organization: req.user.organization,
                hackathon: hackathonId,
            });

            const populatedAnnouncement = await Announcement.findById(announcement._id)
                .populate("createdBy", "name email")
                .populate("hackathon", "title");

            // Emit WebSocket event for real-time updates
            const orgId = req.user.organization._id ? String(req.user.organization._id) : String(req.user.organization);
            emitAnnouncementCreated(orgId, populatedAnnouncement, hackathonId);

            res.status(201).json({
                message: req.__("announcement.created_successfully"),
                announcement: populatedAnnouncement,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                message: req.__("announcement.creation_failed"),
                error: err.message,
            });
        }
    }

    /**
     * Update announcement
     * @route PUT /api/hackathons/:hackathonId/announcements/:id
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const { title, message } = req.body;

            const announcement = await Announcement.findById(id);
            if (!announcement) {
                return res
                    .status(404)
                    .json({ message: req.__("announcement.not_found") });
            }

            // Only creator or admin can edit
            if (
                !announcement.createdBy.equals(req.user._id) &&
                req.user.role !== "admin"
            ) {
                return res
                    .status(403)
                    .json({ message: req.__("auth.forbidden") });
            }

            announcement.title = title || announcement.title;
            announcement.message = message || announcement.message;
            await announcement.save();

            const populatedAnnouncement = await Announcement.findById(announcement._id)
                .populate("createdBy", "name email")
                .populate("hackathon", "title");

            // Emit WebSocket event for real-time updates
            const orgId = req.user.organization._id ? String(req.user.organization._id) : String(req.user.organization);
            const hackathonId = announcement.hackathon ? String(announcement.hackathon) : null;
            emitAnnouncementUpdated(orgId, announcement._id, {
                title: populatedAnnouncement.title,
                message: populatedAnnouncement.message,
            }, hackathonId);

            res.json({
                message: req.__("announcement.updated_successfully"),
                announcement: populatedAnnouncement,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                message: req.__("announcement.update_failed"),
                error: err.message,
            });
        }
    }

    /**
     * Delete announcement
     * @route DELETE /api/hackathons/:hackathonId/announcements/:id
     */
    async delete(req, res) {
        try {
            const { id } = req.params;
            const announcement = await Announcement.findById(id);

            if (!announcement) {
                return res
                    .status(404)
                    .json({ message: req.__("announcement.not_found") });
            }

            if (
                !announcement.createdBy.equals(req.user._id) &&
                req.user.role !== "admin"
            ) {
                return res
                    .status(403)
                    .json({ message: req.__("auth.forbidden") });
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
    }

    /**
     * Format announcement using AI
     * @route POST /api/hackathons/:hackathonId/announcements/format
     */
    async format(req, res) {
        try {
            const { hackathonId } = req.params;
            const { title, message } = req.body;

            // Verify hackathon exists
            const hackathon = await Hackathon.findById(hackathonId);
            if (!hackathon) {
                return res.status(404).json({ 
                    message: req.__("hackathon.not_found") 
                });
            }

            if (!title || !message) {
                return res.status(400).json({
                    message: "Title and message are required",
                });
            }

            const formatted = await formatAnnouncement(title, message, hackathon.title);
            res.json({
                formattedTitle: formatted.title,
                formattedMessage: formatted.message,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                message: "Failed to format announcement",
                error: err.message,
            });
        }
    }

    /**
     * Get enhancement suggestions for announcement
     * @route POST /api/hackathons/:hackathonId/announcements/enhance
     */
    async enhance(req, res) {
        try {
            const { hackathonId } = req.params;
            const { title, message } = req.body;

            if (!title || !message) {
                return res.status(400).json({
                    message: "Title and message are required",
                });
            }

            const enhancements = await enhanceAnnouncement(title, message);
            res.json(enhancements);
        } catch (err) {
            console.error(err);
            res.status(500).json({
                message: "Failed to enhance announcement",
                error: err.message,
            });
        }
    }
}

module.exports = new AnnouncementController();
