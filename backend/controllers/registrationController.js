const Hackathon = require("../models/Hackathon");
const Team = require("../models/Team");
const Idea = require("../models/Idea");
const HackathonRole = require("../models/HackathonRole");
const { emitTeamUpdate } = require("../socket");

class RegistrationController {
    /**
     * Register a team for a hackathon
     * @route POST /api/hackathons/:hackathonId/register
     * @access Private (Participants)
     */
    async register(req, res) {
        try {
            const { hackathonId } = req.params;
            const { teamName, ideaId, memberIds: rawMemberIds } = req.body;

            // Ensure memberIds is an array and include the requesting user
            const memberIds = Array.isArray(rawMemberIds) ? [...rawMemberIds] : [];
            // Add the current user as a member (and leader) if not already present
            if (!memberIds.some((m) => String(m) === String(req.user._id))) {
                memberIds.push(req.user._id);
            }

            // Validate inputs
            if (!teamName || !ideaId || !Array.isArray(memberIds) || memberIds.length === 0) {
                return res.status(400).json({
                    message: req.__("registration.validation_failed"),
                    error: "Team name, ideaId, and members are required.",
                });
            }

            // Fetch hackathon
            const hackathon = await Hackathon.findById(hackathonId);
            if (!hackathon) {
                return res.status(404).json({ message: req.__("hackathon.not_found") });
            }

            // Ensure hackathon belongs to the same organization
            if (String(hackathon.organization) !== String(req.user.organization._id)) {
                return res.status(403).json({ message: req.__("hackathon.access_denied") });
            }

            // Ensure hackathon is active
            if (!hackathon.isActive) {
                return res.status(400).json({ message: req.__("registration.hackathon_closed") });
            }

            // Validate team size (including the current user)
            const size = memberIds.length;
            if (size < hackathon.mnimumTeamSize || size > hackathon.maximumTeamSize) {
                return res.status(400).json({
                    message: req.__("registration.invalid_team_size"),
                    error: `Team size must be between ${hackathon.mnimumTeamSize} and ${hackathon.maximumTeamSize}.`,
                });
            }

            // Ensure idea exists
            const idea = await Idea.findById(ideaId);
            if (!idea) {
                return res.status(404).json({ message: req.__("idea.not_found") });
            }

            // Check if any member is already registered in this hackathon
            const existingTeam = await Team.findOne({
                hackathon: hackathonId,
                members: { $in: memberIds },
            });
            if (existingTeam) {
                return res.status(400).json({
                    message: req.__("registration.already_registered"),
                    error: "One or more members are already registered for this hackathon.",
                });
            }

            // Create the team and set the registering user as leader
            const team = await Team.create({
                name: teamName,
                idea: ideaId,
                members: memberIds,
                leader: req.user._id,
                organization: req.user.organization._id,
                hackathon: hackathon._id,
            });

            // Assign "participant" role to all team members
            for (const memberId of memberIds) {
                try {
                    await HackathonRole.findOneAndUpdate(
                        { user: memberId, hackathon: hackathonId },
                        {
                            user: memberId,
                            hackathon: hackathonId,
                            role: "participant",
                            assignedBy: req.user._id,
                        },
                        { upsert: true, new: true }
                    );
                } catch (err) {
                    // If role already exists, continue (unique constraint)
                    console.log(`Role already exists for user ${memberId}`);
                }
            }

            // Populate response
            const populatedTeam = await Team.findById(team._id)
                .populate("idea", "title description")
                .populate("members", "name email")
                .populate("hackathon", "title")
                .populate("organization", "name");

            // Emit team created event
            emitTeamUpdate(
                req.user.organization._id.toString(),
                "created",
                populatedTeam
            );

            res.status(201).json({
                message: req.__("registration.success"),
                team: populatedTeam,
            });
        } catch (err) {
            console.error("Register Team Error:", err);
            res.status(500).json({
                message: req.__("registration.failed"),
                error: err.message,
            });
        }
    }

    /**
     * Get all teams registered for a hackathon
     * @route GET /api/hackathons/:hackathonId/teams
     * @access Private (Organizer/Admin of same org)
     */
    async getTeams(req, res) {
        try {
            const { hackathonId } = req.params;

            const hackathon = await Hackathon.findById(hackathonId);
            if (!hackathon) {
                return res.status(404).json({ message: req.__("hackathon.not_found") });
            }

            if (String(hackathon.organization) !== String(req.user.organization._id)) {
                return res.status(403).json({ message: req.__("hackathon.access_denied") });
            }

            const teams = await Team.find({ hackathon: hackathonId })
                .populate("idea", "title description")
                .populate("members", "name email")
                .populate("mentor", "name email")
                .populate("organization", "name")
                .sort({ createdAt: -1 });

            res.json({
                teams,
                total: teams.length,
                message: req.__("registration.fetch_success"),
            });
        } catch (err) {
            console.error("Get Teams Error:", err);
            res.status(500).json({
                message: req.__("registration.fetch_failed"),
                error: err.message,
            });
        }
    }

    /**
     * Get current user's team for a hackathon
     * @route GET /api/register/:hackathonId/my
     * @access Private (Participants)
     */
    async getMyTeam(req, res) {
        try {
            const { hackathonId } = req.params;

            const team = await Team.findOne({ hackathon: hackathonId, members: req.user._id })
                .populate("idea", "title description")
                .populate("members", "name email")
                .populate("hackathon", "title")
                .populate("organization", "name");

            if (!team) {
                return res.status(404).json({ message: req.__("registration.team_not_found") });
            }

            res.json({ team, message: req.__("registration.fetch_success") });
        } catch (err) {
            console.error("Get My Team Error:", err);
            res.status(500).json({ message: req.__("registration.fetch_failed"), error: err.message });
        }
    }

    /**
     * Get all teams for the current user across hackathons
     * @route GET /api/register/my-teams
     * @access Private
     */
    async getMyTeams(req, res) {
        try {
            const teams = await Team.find({ members: req.user._id })
                .populate("idea", "title description")
                .populate("members", "name email")
                .populate("hackathon", "title")
                .populate("organization", "name")
                .sort({ createdAt: -1 });

            res.json({ teams, total: teams.length, message: req.__("registration.fetch_success") });
        } catch (err) {
            console.error("Get My Teams Error:", err);
            res.status(500).json({ message: req.__("registration.fetch_failed"), error: err.message });
        }
    }

    /**
     * Withdraw a team registration
     * @route DELETE /api/hackathons/:hackathonId/teams/:teamId
     * @access Private (Team Members or Organizer/Admin)
     */
    async withdraw(req, res) {
        try {
            const { hackathonId, teamId } = req.params;

            const team = await Team.findById(teamId);
            if (!team) {
                return res.status(404).json({ message: req.__("registration.team_not_found") });
            }

            // Check hackathon ownership match
            if (String(team.hackathon) !== String(hackathonId)) {
                return res.status(400).json({ message: req.__("registration.mismatched_hackathon") });
            }

            // Access control
            const isAdminOrOrganizer = ["admin", "organizer"].includes(req.user.role);
            const isMember = team.members.some(
                (m) => String(m) === String(req.user._id)
            );

            if (!isAdminOrOrganizer && !isMember) {
                return res.status(403).json({
                    message: req.__("registration.access_denied"),
                });
            }

            // Populate team before deletion for event
            const populatedTeam = await Team.findById(teamId)
                .populate("idea", "title description")
                .populate("members", "name email")
                .populate("hackathon", "title")
                .populate("organization", "name");

            // Remove participant roles for all team members when team is withdrawn
            // This effectively changes their hackathon role from "participant" to no role (regular user)
            // Only removes "participant" roles, preserving organizer/judge/mentor roles if they exist
            for (const memberId of team.members) {
                try {
                    const hackathonRole = await HackathonRole.findOne({
                        user: memberId,
                        hackathon: hackathonId,
                        role: "participant"
                    });
                    if (hackathonRole) {
                        await HackathonRole.findByIdAndDelete(hackathonRole._id);
                    }
                } catch (err) {
                    console.log(`Error removing participant role for user ${memberId}:`, err.message);
                }
            }

            // Emit team deleted event before deletion
            emitTeamUpdate(
                req.user.organization._id.toString(),
                "deleted",
                populatedTeam
            );

            await Team.findByIdAndDelete(teamId);

            res.json({
                message: req.__("registration.withdraw_success"),
            });
        } catch (err) {
            console.error("Withdraw Team Error:", err);
            res.status(500).json({
                message: req.__("registration.withdraw_failed"),
                error: err.message,
            });
        }
    }

    /**
     * Update a team registration (modify team details)
     * @route PUT /api/hackathons/:hackathonId/teams/:teamId
     * @access Private (Team leader or Organizer/Admin)
     */
    async update(req, res) {
        try {
            const { hackathonId, teamId } = req.params;
            const { teamName, ideaId, memberIds: rawMemberIds } = req.body;

            const team = await Team.findById(teamId);
            if (!team) {
                return res.status(404).json({ message: req.__("registration.team_not_found") });
            }

            // Check hackathon ownership match
            if (String(team.hackathon) !== String(hackathonId)) {
                return res.status(400).json({ message: req.__("registration.mismatched_hackathon") });
            }

            // Access control: only leader, organizer, or admin can edit
            const isAdminOrOrganizer = ["admin", "organizer"].includes(req.user.role);
            const isLeader = String(team.leader) === String(req.user._id);
            if (!isAdminOrOrganizer && !isLeader) {
                return res.status(403).json({ message: req.__("registration.access_denied") });
            }

            // Prepare members (ensure array) and include requesting user
            const memberIds = Array.isArray(rawMemberIds) ? [...rawMemberIds] : [];
            if (!memberIds.some((m) => String(m) === String(req.user._id))) {
                memberIds.push(req.user._id);
            }

            // Validate inputs
            if (!teamName || !ideaId || !Array.isArray(memberIds) || memberIds.length === 0) {
                return res.status(400).json({
                    message: req.__("registration.validation_failed"),
                    error: "Team name, ideaId, and members are required.",
                });
            }

            // Validate hackathon exists and belongs to same org
            const hackathon = await Hackathon.findById(hackathonId);
            if (!hackathon) return res.status(404).json({ message: req.__("hackathon.not_found") });
            if (String(hackathon.organization) !== String(req.user.organization._id)) {
                return res.status(403).json({ message: req.__("hackathon.access_denied") });
            }

            // Ensure hackathon is active
            if (!hackathon.isActive) {
                return res.status(400).json({ message: req.__("registration.hackathon_closed") });
            }

            // Validate idea exists
            const idea = await Idea.findById(ideaId);
            if (!idea) return res.status(404).json({ message: req.__("idea.not_found") });

            // Validate team size
            const size = memberIds.length;
            if (size < hackathon.mnimumTeamSize || size > hackathon.maximumTeamSize) {
                return res.status(400).json({
                    message: req.__("registration.invalid_team_size"),
                    error: `Team size must be between ${hackathon.mnimumTeamSize} and ${hackathon.maximumTeamSize}.`,
                });
            }

            // Ensure none of the new members are already registered in another team for this hackathon
            const conflictTeam = await Team.findOne({
                hackathon: hackathonId,
                members: { $in: memberIds },
                _id: { $ne: teamId },
            });
            if (conflictTeam) {
                return res.status(400).json({
                    message: req.__("registration.already_registered"),
                    error: "One or more members are already registered for this hackathon.",
                });
            }

            // Update fields
            team.name = teamName;
            team.idea = ideaId;
            team.members = memberIds;

            await team.save();

            const populatedTeam = await Team.findById(team._id)
                .populate("idea", "title description")
                .populate("members", "name email")
                .populate("hackathon", "title")
                .populate("organization", "name");

            // Emit team updated event
            emitTeamUpdate(
                req.user.organization._id.toString(),
                "updated",
                populatedTeam
            );

            res.json({ message: req.__("registration.update_success" || "Updated"), team: populatedTeam });
        } catch (err) {
            console.error("Update Team Error:", err);
            res.status(500).json({ message: req.__("registration.update_failed" || "Update failed"), error: err.message });
        }
    }
}

module.exports = new RegistrationController();
