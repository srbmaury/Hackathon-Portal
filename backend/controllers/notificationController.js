const Notification = require("../models/Notification");
const User = require("../models/User");

class NotificationController {
    /**
     * Get all notifications for the current user
     * @route GET /api/notifications
     * @access Private
     */
    async getAll(req, res) {
        try {
            const userId = req.user.id;
            const { limit = 50, unreadOnly = false } = req.query;

            const filter = { user: userId };
            if (unreadOnly === "true") {
                filter.read = false;
            }

            const notifications = await Notification.find(filter)
                .sort({ createdAt: -1 })
                .limit(parseInt(limit));

            const unreadCount = await Notification.countDocuments({
                user: userId,
                read: false,
            });

            res.json({
                notifications,
                unreadCount,
                total: notifications.length,
            });
        } catch (error) {
            console.error("Get Notifications Error:", error);
            res.status(500).json({
                message: req.__("notification.fetch_failed") || "Failed to fetch notifications",
                error: error.message,
            });
        }
    }

    /**
     * Mark notification as read
     * @route PATCH /api/notifications/:id/read
     * @access Private
     */
    async markAsRead(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const notification = await Notification.findOne({
                _id: id,
                user: userId,
            });

            if (!notification) {
                return res.status(404).json({
                    message: req.__("notification.not_found") || "Notification not found",
                });
            }

            notification.read = true;
            await notification.save();

            res.json({
                message: req.__("notification.marked_read") || "Notification marked as read",
                notification,
            });
        } catch (error) {
            console.error("Mark Notification Read Error:", error);
            res.status(500).json({
                message: req.__("notification.update_failed") || "Failed to update notification",
                error: error.message,
            });
        }
    }

    /**
     * Mark all notifications as read
     * @route PATCH /api/notifications/read-all
     * @access Private
     */
    async markAllAsRead(req, res) {
        try {
            const userId = req.user.id;

            await Notification.updateMany(
                { user: userId, read: false },
                { read: true }
            );

            res.json({
                message: req.__("notification.all_marked_read") || "All notifications marked as read",
            });
        } catch (error) {
            console.error("Mark All Notifications Read Error:", error);
            res.status(500).json({
                message: req.__("notification.update_failed") || "Failed to update notifications",
                error: error.message,
            });
        }
    }

    /**
     * Delete a notification
     * @route DELETE /api/notifications/:id
     * @access Private
     */
    async delete(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const notification = await Notification.findOneAndDelete({
                _id: id,
                user: userId,
            });

            if (!notification) {
                return res.status(404).json({
                    message: req.__("notification.not_found") || "Notification not found",
                });
            }

            res.json({
                message: req.__("notification.deleted") || "Notification deleted",
            });
        } catch (error) {
            console.error("Delete Notification Error:", error);
            res.status(500).json({
                message: req.__("notification.delete_failed") || "Failed to delete notification",
                error: error.message,
            });
        }
    }

    /**
     * Get unread notification count
     * @route GET /api/notifications/unread-count
     * @access Private
     */
    async getUnreadCount(req, res) {
        try {
            const userId = req.user.id;

            const count = await Notification.countDocuments({
                user: userId,
                read: false,
            });

            res.json({ unreadCount: count });
        } catch (error) {
            console.error("Get Unread Count Error:", error);
            res.status(500).json({
                message: req.__("notification.fetch_failed") || "Failed to fetch unread count",
                error: error.message,
            });
        }
    }
}

module.exports = new NotificationController();

