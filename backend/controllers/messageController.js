const Message = require("../models/Message");
const Team = require("../models/Team");
const HackathonRole = require("../models/HackathonRole");
const { emitMessage } = require("../socket");
const { generateChatResponse, isAIMentioned, extractQuestion, generateMeetingSummary } = require("../services/chatAssistantService");

class MessageController {
    /**
     * Get all messages for a team
     * @route GET /api/teams/:teamId/messages
     * @access Private (Team members and mentor only)
     */
    async getMessages(req, res) {
        try {
            const { teamId } = req.params;
            const userId = req.user._id;

            // Verify user is a team member or mentor
            const team = await Team.findById(teamId)
                .populate("members", "name email")
                .populate("mentor", "name email");

            if (!team) {
                return res.status(404).json({
                    message: req.__("chat.team_not_found") || "Team not found",
                });
            }

            const isMember = team.members.some(
                (member) => String(member._id) === String(userId)
            );
            const isMentor = team.mentor && String(team.mentor._id) === String(userId);
            const isAdmin = req.user.role === "admin";
            
            // Check if user is an organizer for this hackathon
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
                    message: req.__("chat.access_denied") || "Access denied. You must be a team member, mentor, organizer, or admin.",
                });
            }

            // Get messages, sorted by creation date (oldest first)
            const messages = await Message.find({ team: teamId })
                .populate("sender", "name email")
                .sort({ createdAt: 1 })
                .limit(100); // Limit to last 100 messages

            res.json({
                messages,
                total: messages.length,
                teamName: team.name, // Include team name for frontend
            });
        } catch (error) {
            console.error("Get Messages Error:", error);
            res.status(500).json({
                message: req.__("chat.fetch_failed") || "Failed to fetch messages",
                error: error.message,
            });
        }
    }

    /**
     * Send a message to a team
     * @route POST /api/teams/:teamId/messages
     * @access Private (Team members and mentor only)
     */
    async sendMessage(req, res) {
        try {
            const { teamId } = req.params;
            const { content } = req.body;
            const userId = req.user._id;

            if (!content || !content.trim()) {
                return res.status(400).json({
                    message: req.__("chat.content_required") || "Message content is required",
                });
            }

            // Verify user is a team member or mentor
            const team = await Team.findById(teamId)
                .populate("members", "name email")
                .populate("mentor", "name email")
                .populate("organization", "_id");

            if (!team) {
                return res.status(404).json({
                    message: req.__("chat.team_not_found") || "Team not found",
                });
            }

            const isMember = team.members.some(
                (member) => String(member._id) === String(userId)
            );
            const isMentor = team.mentor && String(team.mentor._id) === String(userId);
            const isAdmin = req.user.role === "admin";
            
            // Check if user is an organizer for this hackathon
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
                    message: req.__("chat.access_denied") || "Access denied. You must be a team member, mentor, organizer, or admin.",
                });
            }

            // Create message
            const message = await Message.create({
                team: teamId,
                sender: userId,
                content: content.trim(),
                organization: team.organization._id,
            });

            // Populate sender for response
            await message.populate("sender", "name email");

            // Emit real-time message to all team members and mentor
            emitMessage(team.organization._id, teamId, {
                eventType: "new_message",
                message,
            });

            // Check if message explicitly mentions AI and generate response (async, non-blocking)
            if (isAIMentioned(content.trim())) {
                // Extract the actual question (remove AI mention)
                const question = extractQuestion(content.trim());
                
                if (question) {
                    // Get recent messages for context
                    const recentMessages = await Message.find({ team: teamId })
                        .populate("sender", "name email")
                        .sort({ createdAt: -1 })
                        .limit(10)
                        .then(msgs => msgs.reverse());

                    // Generate AI response in background (don't block the response)
                    generateChatResponse(question, teamId, recentMessages)
                        .then(async (aiResponse) => {
                            if (aiResponse) {
                                // Create AI assistant message
                                const aiMessage = await Message.create({
                                    team: teamId,
                                    sender: null, // AI has no sender
                                    content: `🤖 AI Assistant: ${aiResponse}`,
                                    organization: team.organization._id,
                                    isAI: true, // Mark as AI message
                                });

                                // Emit AI response
                                emitMessage(team.organization._id, teamId, {
                                    eventType: "new_message",
                                    message: aiMessage,
                                });
                            }
                        })
                        .catch((error) => {
                            console.error("Error generating AI chat response:", error);
                            // Fail silently - don't break user experience
                        });
                }
            }

            res.status(201).json({
                message: req.__("chat.message_sent") || "Message sent successfully",
                data: message,
            });
        } catch (error) {
            console.error("Send Message Error:", error);
            res.status(500).json({
                message: req.__("chat.send_failed") || "Failed to send message",
                error: error.message,
            });
        }
    }

    /**
     * Generate meeting summary from team chat
     * @route POST /api/teams/:teamId/messages/summary
     * @access Private (Team members and mentor only)
     */
    async generateSummary(req, res) {
        try {
            const { teamId } = req.params;
            const userId = req.user._id;

            // Verify user is a team member or mentor
            const team = await Team.findById(teamId)
                .populate("members", "name email")
                .populate("mentor", "name email");

            if (!team) {
                return res.status(404).json({
                    message: req.__("chat.team_not_found") || "Team not found",
                });
            }

            const isMember = team.members.some(
                (member) => String(member._id) === String(userId)
            );
            const isMentor = team.mentor && String(team.mentor._id) === String(userId);
            const isAdmin = req.user.role === "admin";
            
            // Check if user is an organizer for this hackathon
            let isOrganizer = false;
            if (!isMember && !isMentor && !isAdmin) {
                const HackathonRole = require("../models/HackathonRole");
                const hackathonRole = await HackathonRole.findOne({
                    user: userId,
                    hackathon: team.hackathon,
                    role: "organizer",
                });
                isOrganizer = !!hackathonRole;
            }

            if (!isMember && !isMentor && !isAdmin && !isOrganizer) {
                return res.status(403).json({
                    message: req.__("chat.access_denied") || "Access denied",
                });
            }

            // Get recent messages
            const messages = await Message.find({ team: teamId })
                .populate("sender", "name email")
                .sort({ createdAt: -1 })
                .limit(100);

            if (messages.length === 0) {
                return res.status(400).json({
                    message: req.__("chat.no_messages_for_summary") || "No messages available for summary",
                });
            }

            const summary = await generateMeetingSummary(messages);

            if (!summary) {
                return res.status(500).json({
                    message: req.__("chat.summary_failed") || "Failed to generate summary",
                });
            }

            res.json({
                summary,
            });
        } catch (error) {
            console.error("Generate Summary Error:", error);
            res.status(500).json({
                message: req.__("chat.summary_failed") || "Failed to generate summary",
                error: error.message,
            });
        }
    }
}

module.exports = new MessageController();

