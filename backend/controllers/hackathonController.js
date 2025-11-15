const Hackathon = require("../models/Hackathon");
const Team = require("../models/Team");
const Round = require("../models/Round");
const HackathonRole = require("../models/HackathonRole");
const User = require("../models/User");
const { emitHackathonUpdate, emitHackathonRoleUpdate } = require("../socket");
const { assignTeamsToMentors } = require("../services/mentorAssignmentService");
const { formatHackathonDescription } = require("../services/hackathonFormattingService");
const { suggestRound, suggestMultipleRounds } = require("../services/roundSuggestionService");

class HackathonController {
    /**
     * Create a new hackathon
     * @route POST /api/hackathons
     * @access Private (Admin/Organizer only via roleCheck middleware)
     */
    async create(req, res) {
        try {
            const { title, description, isActive, rounds } = req.body;

            // Validate required fields
            if (!title || !description) {
                return res.status(400).json({
                    message: req.__("hackathon.validation_failed"),
                    error: "Title and description are required",
                });
            }

            // Create rounds if provided
            let roundIds = [];
            if (Array.isArray(rounds) && rounds.length > 0) {
                const createdRounds = await Round.insertMany(
                    rounds.map(r => ({
                        name: r.name,
                        description: r.description || "",
                        startDate: r.startDate,
                        endDate: r.endDate,
                        isActive: r.isActive !== undefined ? r.isActive : true,
                        hideScores: r.hideScores !== undefined ? r.hideScores : false,
                        submissions: [],
                    }))
                );
                roundIds = createdRounds.map(r => r._id);
            }

            // Create hackathon
            const hackathon = await Hackathon.create({
                title,
                description,
                isActive: isActive !== undefined ? isActive : true,
                organization: req.user.organization._id,
                createdBy: req.user._id,
                rounds: roundIds,
            });

            // Automatically assign creator as organizer
            await HackathonRole.create({
                user: req.user._id,
                hackathon: hackathon._id,
                role: "organizer",
                assignedBy: req.user._id,
            });

            // Populate created hackathon
            const populatedHackathon = await Hackathon.findById(hackathon._id)
                .populate("createdBy", "name email")
                .populate("organization", "name")
                .populate("rounds", "name description startDate endDate isActive hideScores");

            // Emit hackathon created event
            emitHackathonUpdate(
                req.user.organization._id.toString(),
                "created",
                populatedHackathon
            );

            res.status(201).json({
                message: req.__("hackathon.created_successfully"),
                hackathon: populatedHackathon,
            });
        } catch (err) {
            console.error("Create Hackathon Error:", err);
            res.status(500).json({
                message: req.__("hackathon.creation_failed"),
                error: err.message,
            });
        }
    }

    /**
     * Get all hackathons for the user's organization
     * @route GET /api/hackathons
     * @access Private
     */
    async getAll(req, res) {
        try {
            // Build filter based on user's organization
            const filter = { organization: req.user.organization._id };

            // If not organizer/admin, only show active hackathons
            if (!["organizer", "admin"].includes(req.user.role)) {
                filter.isActive = true;
            }

            // Fetch hackathons with populated fields
            const hackathons = await Hackathon.find(filter)
                .populate("createdBy", "name email")
                .populate("rounds", "name description startDate endDate isActive hideScores")
                .sort({ createdAt: -1 });

            res.json({
                hackathons,
                total: hackathons.length,
                message: req.__("hackathon.fetch_success"),
            });
        } catch (err) {
            console.error("Get All Hackathons Error:", err);
            res.status(500).json({
                message: req.__("hackathon.fetch_failed"),
                error: err.message,
            });
        }
    }

    /**
     * Get a single hackathon by ID
     * @route GET /api/hackathons/:id
     * @access Private
     */
    async getById(req, res) {
        try {
            const { id } = req.params;

            // Validate ID format
            if (!id.match(/^[0-9a-fA-F]{24}$/)) {
                return res.status(400).json({
                    message: req.__("hackathon.invalid_id"),
                });
            }

            // Fetch hackathon with populated fields
            const hackathon = await Hackathon.findById(id)
                .populate("createdBy", "name email")
                .populate("organization", "name domain")
                .populate("rounds", "name description startDate endDate isActive");

            if (!hackathon) {
                return res.status(404).json({
                    message: req.__("hackathon.not_found"),
                });
            }

            // Check organization access
            if (String(hackathon.organization._id) !== String(req.user.organization._id)) {
                return res.status(403).json({
                    message: req.__("hackathon.access_denied"),
                });
            }

            // Check visibility for non-admin/organizer users
            if (!hackathon.isActive && !["organizer", "admin"].includes(req.user.role)) {
                return res.status(403).json({
                    message: req.__("hackathon.access_denied_inactive"),
                });
            }

            res.json({
                hackathon,
                message: req.__("hackathon.fetch_success"),
            });
        } catch (err) {
            console.error("Get Hackathon By ID Error:", err);
            res.status(500).json({
                message: req.__("hackathon.fetch_failed"),
                error: err.message,
            });
        }
    }

    /**
     * Update a hackathon
     * @route PUT /api/hackathons/:id
     * @access Private (Admin/Organizer only via roleCheck middleware)
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const { title, description, isActive, rounds } = req.body;

            // Validate ID format
            if (!id.match(/^[0-9a-fA-F]{24}$/)) {
                return res.status(400).json({
                    message: req.__("hackathon.invalid_id"),
                });
            }

            // Find hackathon
            const hackathon = await Hackathon.findById(id);

            if (!hackathon) {
                return res.status(404).json({
                    message: req.__("hackathon.not_found"),
                });
            }

            // Check organization access
            if (String(hackathon.organization) !== String(req.user.organization._id)) {
                return res.status(403).json({
                    message: req.__("hackathon.access_denied"),
                });
            }

            // Update only provided fields
            if (title !== undefined) hackathon.title = title;
            if (description !== undefined) hackathon.description = description;
            if (isActive !== undefined) hackathon.isActive = isActive;

            // Handle rounds update if provided
            if (Array.isArray(rounds)) {
                // Get old round IDs
                const oldRoundIds = hackathon.rounds.map(r => r.toString());
                
                // Separate rounds into: existing (with _id) and new (without _id)
                const existingRounds = rounds.filter(r => r._id);
                const newRounds = rounds.filter(r => !r._id);
                
                // Find rounds to delete (old rounds not in the new list)
                const incomingRoundIds = existingRounds.map(r => r._id.toString());
                const roundsToDelete = oldRoundIds.filter(rId => !incomingRoundIds.includes(rId));
                
                // Delete removed rounds
                if (roundsToDelete.length > 0) {
                    await Round.deleteMany({ _id: { $in: roundsToDelete } });
                }
                
                // Update existing rounds
                for (const r of existingRounds) {
                    await Round.findByIdAndUpdate(r._id, {
                        name: r.name,
                        description: r.description || "",
                        startDate: r.startDate,
                        endDate: r.endDate,
                        isActive: r.isActive !== undefined ? r.isActive : true,
                        hideScores: r.hideScores !== undefined ? r.hideScores : false,
                    });
                }
                
                // Create new rounds
                let newRoundIds = [];
                if (newRounds.length > 0) {
                    const createdRounds = await Round.insertMany(
                        newRounds.map(r => ({
                            name: r.name,
                            description: r.description || "",
                            startDate: r.startDate,
                            endDate: r.endDate,
                            isActive: r.isActive !== undefined ? r.isActive : true,
                            hideScores: r.hideScores !== undefined ? r.hideScores : false,
                            submissions: [],
                        }))
                    );
                    newRoundIds = createdRounds.map(r => r._id);
                }
                
                // Update hackathon rounds array
                hackathon.rounds = [...incomingRoundIds, ...newRoundIds];
            }

            // Save changes
            await hackathon.save();

            // Return updated hackathon with populated fields
            const updatedHackathon = await Hackathon.findById(hackathon._id)
                .populate("createdBy", "name email")
                .populate("organization", "name domain")
                .populate("rounds", "name description startDate endDate isActive hideScores");

            // Emit hackathon updated event
            emitHackathonUpdate(
                req.user.organization._id.toString(),
                "updated",
                updatedHackathon
            );

            res.json({
                message: req.__("hackathon.updated_successfully"),
                hackathon: updatedHackathon,
            });
        } catch (err) {
            console.error("Update Hackathon Error:", err);
            res.status(500).json({
                message: req.__("hackathon.update_failed"),
                error: err.message,
            });
        }
    }

    /**
     * Delete a hackathon
     * @route DELETE /api/hackathons/:id
     * @access Private (Admin/Organizer only via roleCheck middleware)
     */
    async delete(req, res) {
        try {
            const { id } = req.params;

            // Validate ID format
            if (!id.match(/^[0-9a-fA-F]{24}$/)) {
                return res.status(400).json({
                    message: req.__("hackathon.invalid_id"),
                });
            }

            // Find hackathon
            const hackathon = await Hackathon.findById(id);

            if (!hackathon) {
                return res.status(404).json({
                    message: req.__("hackathon.not_found"),
                });
            }

            // Check organization access
            if (String(hackathon.organization) !== String(req.user.organization._id)) {
                return res.status(403).json({
                    message: req.__("hackathon.access_denied"),
                });
            }

            // Emit hackathon deleted event before deletion
            emitHackathonUpdate(
                req.user.organization._id.toString(),
                "deleted",
                { _id: hackathon._id }
            );

            // Delete associated rounds
            if (hackathon.rounds && hackathon.rounds.length > 0) {
                await Round.deleteMany({ _id: { $in: hackathon.rounds } });
            }

            // Delete the hackathon
            await Hackathon.findByIdAndDelete(id);

            res.json({
                message: req.__("hackathon.deleted_successfully"),
            });
        } catch (err) {
            console.error("Delete Hackathon Error:", err);
            res.status(500).json({
                message: req.__("hackathon.delete_failed"),
                error: err.message,
            });
        }
    }

    /**
     * Assign a role to a user in a hackathon
     * @route POST /api/hackathons/:id/roles
     * @access Private (Organizer/Admin only)
     */
    async assignRole(req, res) {
        try {
            const { id } = req.params;
            const { userId, role } = req.body;

            // Validate inputs
            if (!userId || !role) {
                return res.status(400).json({
                    message: req.__("hackathon.user_id_role_required") || "User ID and role are required",
                });
            }

            if (!["organizer", "judge", "mentor", "participant"].includes(role)) {
                return res.status(400).json({
                    message: req.__("hackathon.invalid_role") || "Invalid role. Must be organizer, judge, mentor, or participant",
                });
            }

            // Check if hackathon exists
            const hackathon = await Hackathon.findById(id);
            if (!hackathon) {
                return res.status(404).json({
                    message: req.__("hackathon.not_found"),
                });
            }

            // Check if user exists and belongs to same organization
            const user = await User.findById(userId).populate("organization");
            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                });
            }

            if (String(user.organization._id) !== String(req.user.organization._id)) {
                return res.status(403).json({
                    message: "User must belong to the same organization",
                });
            }

            // Check if role already exists, update if it does
            const existingRole = await HackathonRole.findOne({
                user: userId,
                hackathon: id,
            });

            if (existingRole) {
                existingRole.role = role;
                existingRole.assignedBy = req.user._id;
                await existingRole.save();

                const updatedRole = await HackathonRole.findById(existingRole._id)
                    .populate("user", "name email")
                    .populate("assignedBy", "name email");

                // Emit hackathon role updated event
                emitHackathonRoleUpdate(
                    req.user.organization._id.toString(),
                    id,
                    "assigned",
                    { role: updatedRole, userId }
                );

                return res.json({
                    message: "Role updated successfully",
                    role: updatedRole,
                });
            }

            // Create new role assignment
            const hackathonRole = await HackathonRole.create({
                user: userId,
                hackathon: id,
                role,
                assignedBy: req.user._id,
            });

            const populatedRole = await HackathonRole.findById(hackathonRole._id)
                .populate("user", "name email")
                .populate("assignedBy", "name email");

            // Emit hackathon role assigned event
            emitHackathonRoleUpdate(
                req.user.organization._id.toString(),
                id,
                "assigned",
                { role: populatedRole, userId }
            );

            res.status(201).json({
                message: "Role assigned successfully",
                role: populatedRole,
            });
        } catch (err) {
            console.error("Assign Role Error:", err);
            res.status(500).json({
                message: "Failed to assign role",
                error: err.message,
            });
        }
    }

    /**
     * Remove a user's role from a hackathon
     * @route DELETE /api/hackathons/:id/roles/:userId
     * @access Private (Organizer/Admin only)
     */
    async removeRole(req, res) {
        try {
            const { id, userId } = req.params;

            // Check if hackathon exists
            const hackathon = await Hackathon.findById(id);
            if (!hackathon) {
                return res.status(404).json({
                    message: req.__("hackathon.not_found"),
                });
            }

            // Find the role before deleting
            const roleToDelete = await HackathonRole.findOne({
                user: userId,
                hackathon: id,
            });

            if (!roleToDelete) {
                return res.status(404).json({
                    message: "Role assignment not found",
                });
            }

            // Delete the role
            await HackathonRole.findByIdAndDelete(roleToDelete._id);

            // Emit hackathon role removed event
            emitHackathonRoleUpdate(
                req.user.organization._id.toString(),
                id,
                "removed",
                { userId, role: roleToDelete.role }
            );

            res.json({
                message: "Role removed successfully",
            });
        } catch (err) {
            console.error("Remove Role Error:", err);
            res.status(500).json({
                message: "Failed to remove role",
                error: err.message,
            });
        }
    }

    /**
     * Get all members (users with roles) in a hackathon
     * @route GET /api/hackathons/:id/members
     * @access Private (Any hackathon member)
     */
    async getMembers(req, res) {
        try {
            const { id } = req.params;

            // Check if hackathon exists
            const hackathon = await Hackathon.findById(id);
            if (!hackathon) {
                return res.status(404).json({
                    message: req.__("hackathon.not_found"),
                });
            }

            // Get all roles for this hackathon
            const roles = await HackathonRole.find({ hackathon: id })
                .populate("user", "name email expertise")
                .populate("assignedBy", "name email")
                .sort({ createdAt: -1 });

            // Group by role for easier frontend consumption
            const membersByRole = {
                organizer: [],
                judge: [],
                mentor: [],
                participant: [],
            };

            roles.forEach(roleDoc => {
                membersByRole[roleDoc.role].push({
                    _id: roleDoc._id,
                    user: roleDoc.user,
                    role: roleDoc.role,
                    assignedBy: roleDoc.assignedBy,
                    createdAt: roleDoc.createdAt,
                });
            });

            res.json({
                members: roles,
                membersByRole,
                total: roles.length,
                message: "Members fetched successfully",
            });
        } catch (err) {
            console.error("Get Members Error:", err);
            res.status(500).json({
                message: "Failed to fetch members",
                error: err.message,
            });
        }
    }

    /**
     * Get current user's role in a hackathon
     * @route GET /api/hackathons/:id/my-role
     * @access Private
     */
    async getMyRole(req, res) {
        try {
            const { id } = req.params;

            // Check if hackathon exists
            const hackathon = await Hackathon.findById(id);
            if (!hackathon) {
                return res.status(404).json({
                    message: req.__("hackathon.not_found"),
                });
            }

            // Get user's role in this hackathon
            const hackathonRole = await HackathonRole.findOne({
                user: req.user._id,
                hackathon: id,
            });

            if (!hackathonRole) {
                return res.json({
                    hasRole: false,
                    role: null,
                    message: "You are not a member of this hackathon",
                });
            }

            res.json({
                hasRole: true,
                role: hackathonRole.role,
                roleId: hackathonRole._id,
                message: "Role fetched successfully",
            });
        } catch (err) {
            console.error("Get My Role Error:", err);
            res.status(500).json({
                message: "Failed to fetch role",
                error: err.message,
            });
        }
    }

    /**
     * Assign teams to mentors using AI
     * @route POST /api/hackathons/:id/assign-mentors
     * @access Private (Organizer/Admin only)
     */
    async assignMentors(req, res) {
        try {
            const { id } = req.params;

            // Check if hackathon exists
            const hackathon = await Hackathon.findById(id);
            if (!hackathon) {
                return res.status(404).json({
                    message: req.__("hackathon.not_found"),
                });
            }

            // Check if OpenAI API key is configured
            if (!process.env.OPENAI_API_KEY) {
                return res.status(500).json({
                    message: req.__("mentor.openai_not_configured") || "OpenAI API key is not configured",
                });
            }

            // Assign teams to mentors
            const result = await assignTeamsToMentors(id);

            // Emit team update event for real-time sync
            const { emitTeamUpdate } = require("../socket");
            emitTeamUpdate(req.user.organization._id, {
                eventType: "mentors_assigned",
                hackathonId: id,
            });

            return res.status(200).json({
                message: req.__("mentor.assignment_success") || "Teams successfully assigned to mentors",
                ...result,
            });
        } catch (error) {
            console.error("Error assigning mentors:", error);
            return res.status(500).json({
                message: error.message || req.__("mentor.assignment_failed") || "Failed to assign mentors",
                error: error.message,
            });
        }
    }

    /**
     * Format hackathon description using AI
     * @route POST /api/hackathons/format
     */
    async format(req, res) {
        try {
            const { title, description } = req.body;

            if (!title || !description) {
                return res.status(400).json({
                    message: "Title and description are required",
                });
            }

            const formatted = await formatHackathonDescription(title, description);
            res.json({
                formattedTitle: formatted.title,
                formattedDescription: formatted.description,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                message: "Failed to format hackathon description",
                error: err.message,
            });
        }
    }

    /**
     * Suggest round structure using AI
     * @route POST /api/hackathons/suggest-round
     */
    async suggestRound(req, res) {
        try {
            const { title, description, roundNumber, existingRounds, hackathonStartDate } = req.body;

            if (!title) {
                return res.status(400).json({
                    message: "Hackathon title is required",
                });
            }

            const round = await suggestRound(
                title,
                description || "",
                roundNumber || 1,
                existingRounds || [],
                hackathonStartDate ? new Date(hackathonStartDate) : null
            );

            res.json({ round });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                message: "Failed to suggest round",
                error: err.message,
            });
        }
    }

    /**
     * Suggest multiple rounds using AI
     * @route POST /api/hackathons/suggest-rounds
     */
    async suggestRounds(req, res) {
        try {
            const { title, description, numberOfRounds, hackathonStartDate } = req.body;

            if (!title) {
                return res.status(400).json({
                    message: "Hackathon title is required",
                });
            }

            const rounds = await suggestMultipleRounds(
                title,
                description || "",
                numberOfRounds || 3,
                hackathonStartDate ? new Date(hackathonStartDate) : null
            );

            res.json({ rounds });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                message: "Failed to suggest rounds",
                error: err.message,
            });
        }
    }
}

module.exports = new HackathonController();
