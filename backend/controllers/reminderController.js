const { analyzeTeamRisk, getAtRiskTeams, generateReminderMessage } = require("../services/smartReminderService");
const Team = require("../models/Team");
const Round = require("../models/Round");
const Hackathon = require("../models/Hackathon");
const HackathonRole = require("../models/HackathonRole");
const { emitMessage } = require("../socket");
const Message = require("../models/Message");

class ReminderController {
    /**
     * Analyze risk for a specific team and round
     * @route GET /api/reminders/team/:teamId/round/:roundId
     * @access Private (Team members, mentor, organizer, admin)
     */
    async analyzeTeamRisk(req, res) {
        try {
            const { teamId, roundId } = req.params;
            const userId = req.user._id;

            // Verify user has access
            const team = await Team.findById(teamId)
                .populate("members", "name email")
                .populate("mentor", "name email");

            if (!team) {
                return res.status(404).json({
                    message: req.__("reminder.team_not_found") || "Team not found",
                });
            }

            const isMember = team.members.some(
                (member) => String(member._id) === String(userId)
            );
            const isMentor = team.mentor && String(team.mentor._id) === String(userId);
            const isAdmin = req.user.role === "admin";
            
            let isOrganizer = false;
            if (!isMember && !isMentor && !isAdmin) {
                const hackathonRole = await HackathonRole.findOne({
                    user: userId,
                    hackathon: team.hackathon,
                    role: "organizer",
                });
                isOrganizer = !!hackathonRole;
            }

            if (!isMember && !isMentor && !isAdmin && !isOrganizer) {
                return res.status(403).json({
                    message: req.__("reminder.access_denied") || "Access denied",
                });
            }

            const analysis = await analyzeTeamRisk(teamId, roundId);

            res.json({
                analysis,
            });
        } catch (error) {
            console.error("Analyze Team Risk Error:", error);
            res.status(500).json({
                message: req.__("reminder.analysis_failed") || "Failed to analyze team risk",
                error: error.message,
            });
        }
    }

    /**
     * Get all teams at risk for a round
     * @route GET /api/reminders/round/:roundId/at-risk
     * @access Private (Organizer, admin only)
     */
    async getAtRiskTeams(req, res) {
        try {
            const { roundId } = req.params;
            const userId = req.user._id;

            const round = await Round.findById(roundId);
            if (!round) {
                return res.status(404).json({
                    message: req.__("reminder.round_not_found") || "Round not found",
                });
            }

            const hackathon = await Hackathon.findOne({ rounds: roundId });
            if (!hackathon) {
                return res.status(404).json({
                    message: req.__("reminder.hackathon_not_found") || "Hackathon not found",
                });
            }

            // Check if user is organizer or admin
            const isAdmin = req.user.role === "admin";
            const hackathonRole = await HackathonRole.findOne({
                user: userId,
                hackathon: hackathon._id,
                role: "organizer",
            });
            const isOrganizer = !!hackathonRole;

            if (!isAdmin && !isOrganizer) {
                return res.status(403).json({
                    message: req.__("reminder.access_denied") || "Access denied. Organizer or admin only.",
                });
            }

            const threshold = parseInt(req.query.threshold) || 50;
            const atRiskTeams = await getAtRiskTeams(roundId, threshold);

            res.json({
                round: {
                    _id: round._id,
                    name: round.name,
                    endDate: round.endDate,
                },
                atRiskTeams,
                threshold,
            });
        } catch (error) {
            console.error("Get At Risk Teams Error:", error);
            res.status(500).json({
                message: req.__("reminder.fetch_failed") || "Failed to fetch at-risk teams",
                error: error.message,
            });
        }
    }

    /**
     * Generate and send reminder message to a team
     * @route POST /api/reminders/team/:teamId/round/:roundId/send
     * @access Private (Organizer, admin only)
     */
    async sendReminder(req, res) {
        try {
            const { teamId, roundId } = req.params;
            const userId = req.user._id;

            const team = await Team.findById(teamId)
                .populate("organization", "_id")
                .populate("hackathon", "_id");

            if (!team) {
                return res.status(404).json({
                    message: req.__("reminder.team_not_found") || "Team not found",
                });
            }

            // Check if user is organizer or admin
            const isAdmin = req.user.role === "admin";
            const hackathonRole = await HackathonRole.findOne({
                user: userId,
                hackathon: team.hackathon._id,
                role: "organizer",
            });
            const isOrganizer = !!hackathonRole;

            if (!isAdmin && !isOrganizer) {
                return res.status(403).json({
                    message: req.__("reminder.access_denied") || "Access denied. Organizer or admin only.",
                });
            }

            const reminderMessage = await generateReminderMessage(teamId, roundId);

            // Create and send message to team chat
            const message = await Message.create({
                team: teamId,
                sender: null, // System message
                content: `⏰ Reminder: ${reminderMessage}`,
                organization: team.organization._id,
                isAI: true,
            });

            // Emit real-time message
            emitMessage(team.organization._id, teamId, {
                eventType: "new_message",
                message,
            });

            res.json({
                message: req.__("reminder.sent_successfully") || "Reminder sent successfully",
                data: message,
            });
        } catch (error) {
            console.error("Send Reminder Error:", error);
            res.status(500).json({
                message: req.__("reminder.send_failed") || "Failed to send reminder",
                error: error.message,
            });
        }
    }
}

module.exports = new ReminderController();

