const Notification = require("../models/Notification");
const User = require("../models/User");
const Team = require("../models/Team");
const { emitNotification } = require("../socket");

/**
 * Create a notification for a user
 * @param {Object} params - Notification parameters
 * @param {String} params.userId - User ID to notify
 * @param {String} params.type - Notification type
 * @param {String} params.title - Notification title
 * @param {String} params.message - Notification message
 * @param {Object} params.relatedEntity - Related entity info (type, id)
 * @param {String} params.organizationId - Organization ID
 */
async function createNotification({
    userId,
    type,
    title,
    message,
    relatedEntity,
    organizationId,
}) {
    try {
        // Check if user has notifications enabled (default to true if not set)
        const user = await User.findById(userId);
        if (!user) {
            return null; // User not found
        }
        // Default to true if notificationsEnabled is not set (for existing users)
        if (user.notificationsEnabled === false) {
            return null; // User has explicitly disabled notifications
        }

        const notification = await Notification.create({
            user: userId,
            type,
            title,
            message,
            relatedEntity,
            organization: organizationId,
        });

        // Emit notification via socket
        emitNotification(userId, notification);

        return notification;
    } catch (error) {
        console.error("Error creating notification:", error);
        return null;
    }
}

/**
 * Create notifications for multiple users
 * @param {Array} userIds - Array of user IDs
 * @param {Object} params - Notification parameters (same as createNotification)
 */
async function createNotificationsForUsers(userIds, params) {
    try {
        const notifications = [];
        for (const userId of userIds) {
            const notification = await createNotification({
                ...params,
                userId,
            });
            if (notification) {
                notifications.push(notification);
            }
        }
        return notifications;
    } catch (error) {
        console.error("Error creating notifications for users:", error);
        return [];
    }
}

/**
 * Create notification for new hackathon
 */
async function notifyNewHackathon(hackathon, organizationId) {
    try {
        // Get all users in the organization
        const users = await User.find({ organization: organizationId });
        const userIds = users.map((u) => u._id.toString());

        return await createNotificationsForUsers(userIds, {
            type: "new_hackathon",
            title: "New Hackathon Available",
            message: `A new hackathon "${hackathon.title}" has been created.`,
            relatedEntity: {
                type: "hackathon",
                id: hackathon._id,
            },
            organizationId,
        });
    } catch (error) {
        console.error("Error notifying new hackathon:", error);
        return [];
    }
}

/**
 * Create notification for hackathon update
 */
async function notifyHackathonUpdate(hackathon, organizationId, participantsOnly = false) {
    try {
        let userIds = [];

        if (participantsOnly) {
            // Get all users participating in this hackathon (team members)
            const teams = await Team.find({ hackathon: hackathon._id }).populate("members");
            const participantIds = new Set();
            teams.forEach((team) => {
                team.members.forEach((member) => {
                    participantIds.add(member._id.toString());
                });
            });
            userIds = Array.from(participantIds);
        } else {
            // Get all users in the organization
            const users = await User.find({ organization: organizationId });
            userIds = users.map((u) => u._id.toString());
        }

        return await createNotificationsForUsers(userIds, {
            type: "hackathon_update",
            title: "Hackathon Updated",
            message: `The hackathon "${hackathon.title}" has been updated.`,
            relatedEntity: {
                type: "hackathon",
                id: hackathon._id,
            },
            organizationId,
        });
    } catch (error) {
        console.error("Error notifying hackathon update:", error);
        return [];
    }
}

/**
 * Create notification for hackathon deadline
 */
async function notifyHackathonDeadline(hackathon, deadlineType, deadlineDate, organizationId) {
    try {
        // Get all users participating in this hackathon
        const teams = await Team.find({ hackathon: hackathon._id }).populate("members");
        const participantIds = new Set();
        teams.forEach((team) => {
            team.members.forEach((member) => {
                participantIds.add(member._id.toString());
            });
        });
        const userIds = Array.from(participantIds);

        const deadlineMessage =
            deadlineType === "round"
                ? `A round deadline is approaching for "${hackathon.title}".`
                : `The deadline for "${hackathon.title}" is approaching.`;

        return await createNotificationsForUsers(userIds, {
            type: "hackathon_deadline",
            title: "Deadline Reminder",
            message: deadlineMessage,
            relatedEntity: {
                type: "hackathon",
                id: hackathon._id,
            },
            organizationId,
        });
    } catch (error) {
        console.error("Error notifying hackathon deadline:", error);
        return [];
    }
}

/**
 * Create notification for team message
 */
async function notifyTeamMessage(teamId, senderId, messageContent, organizationId) {
    try {
        const team = await Team.findById(teamId).populate("members");
        if (!team) {
            return [];
        }

        // Notify all team members except the sender
        const recipientIds = team.members
            .filter((member) => member._id.toString() !== senderId.toString())
            .map((member) => member._id.toString());

        // Also notify mentor if exists
        if (team.mentor && team.mentor.toString() !== senderId.toString()) {
            recipientIds.push(team.mentor.toString());
        }

        return await createNotificationsForUsers(recipientIds, {
            type: "team_message",
            title: `New Message in ${team.name}`,
            message: messageContent.length > 50
                ? `${messageContent.substring(0, 50)}...`
                : messageContent,
            relatedEntity: {
                type: "team",
                id: teamId,
            },
            organizationId,
        });
    } catch (error) {
        console.error("Error notifying team message:", error);
        return [];
    }
}

/**
 * Create notification for round deadline
 */
async function notifyRoundDeadline(round, hackathon, organizationId) {
    try {
        // Get all users participating in this hackathon
        const teams = await Team.find({ hackathon: hackathon._id }).populate("members");
        const participantIds = new Set();
        teams.forEach((team) => {
            team.members.forEach((member) => {
                participantIds.add(member._id.toString());
            });
        });
        const userIds = Array.from(participantIds);

        return await createNotificationsForUsers(userIds, {
            type: "round_deadline",
            title: "Round Deadline Approaching",
            message: `The deadline for round "${round.name}" in "${hackathon.title}" is approaching.`,
            relatedEntity: {
                type: "round",
                id: round._id,
            },
            organizationId,
        });
    } catch (error) {
        console.error("Error notifying round deadline:", error);
        return [];
    }
}

/**
 * Create notification for hackathon announcement
 */
async function notifyHackathonAnnouncement(announcement, hackathonId, organizationId) {
    try {
        // Get all users participating in this hackathon (team members)
        const teams = await Team.find({ hackathon: hackathonId }).populate("members");
        const participantIds = new Set();
        teams.forEach((team) => {
            team.members.forEach((member) => {
                participantIds.add(member._id.toString());
            });
        });
        const userIds = Array.from(participantIds);

        return await createNotificationsForUsers(userIds, {
            type: "announcement",
            title: `New Announcement: ${announcement.title}`,
            message: announcement.message.length > 100
                ? `${announcement.message.substring(0, 100)}...`
                : announcement.message,
            relatedEntity: {
                type: "announcement",
                id: announcement._id,
            },
            organizationId,
        });
    } catch (error) {
        console.error("Error notifying hackathon announcement:", error);
        return [];
    }
}

module.exports = {
    createNotification,
    createNotificationsForUsers,
    notifyNewHackathon,
    notifyHackathonUpdate,
    notifyHackathonDeadline,
    notifyTeamMessage,
    notifyRoundDeadline,
    notifyHackathonAnnouncement,
};

