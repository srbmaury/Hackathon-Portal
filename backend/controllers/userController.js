const User = require("../models/User");
const Organization = require("../models/Organization");
const HackathonRole = require("../models/HackathonRole");
const { emitRoleUpdate } = require("../socket");

class UserController {
    // Get all users grouped by role
    async getAll(req, res) {
        try {
            // get user from the organization of the user
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ message: req.__("user.not_found") });
            }

            const organization = await Organization.findById(user.organization);
            if (!organization) {
                return res.status(404).json({ message: req.__("organization.not_found") });
            }
            const users = await User.find({ organization: organization.id }).populate("organization", "name").lean();

            // Group users by roles
            const groupedUsers = users.reduce((groups, user) => {
                if (!groups[user.role]) groups[user.role] = [];
                groups[user.role].push(user);
                return groups;
            }, {});

            res.json({ users, groupedUsers, message: req.__("user.fetch_success") });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                message: req.__("user.fetch_failed"),
                error: err.message,
            });
        }
    }

    // Update user role (admin and organizer only)
    async updateRole(req, res) {
        try {
            const requesterRole = req.user.role;
            const { id } = req.params;
            const { role } = req.body;

            // Protect admin from modification
            const targetUser = await User.findById(id);
            if (!targetUser) {
                return res.status(404).json({ message: req.__("user.not_found") });
            }

            if (targetUser.role === "admin") {
                return res.status(403).json({ message: req.__("user.cannot_modify_admin") });
            }

            // Update the role
            targetUser.role = role;
            await targetUser.save();

            // Populate organization before emitting
            await targetUser.populate("organization");

            // Emit role update via WebSocket
            emitRoleUpdate(targetUser._id.toString(), targetUser);

            res.json({
                message: req.__("user.role_updated_successfully"),
                user: targetUser,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                message: req.__("user.role_update_failed"),
                error: err.message,
            });
        }
    }

    // Get all users with their hackathon roles (admin only)
    async getAllWithHackathonRoles(req, res) {
        try {
            const currentUser = await User.findById(req.user.id);
            if (!currentUser) {
                return res.status(404).json({ message: req.__("user.not_found") });
            }

            if (currentUser.role !== "admin") {
                return res.status(403).json({ message: req.__("auth.forbidden_role") });
            }

            const organization = await Organization.findById(currentUser.organization);
            if (!organization) {
                return res.status(404).json({ message: req.__("organization.not_found") });
            }

            const users = await User.find({ organization: organization.id })
                .populate("organization", "name")
                .lean();

            // Get all hackathon roles for these users
            const userIds = users.map(u => u._id);
            const hackathonRoles = await HackathonRole.find({
                user: { $in: userIds },
                role: "organizer"
            })
                .populate("hackathon", "title")
                .lean();

            // Map hackathon roles to users
            const usersWithRoles = users.map(user => {
                const organizerRoles = hackathonRoles
                    .filter(hr => String(hr.user) === String(user._id))
                    .map(hr => ({
                        hackathonId: hr.hackathon?._id,
                        hackathonTitle: hr.hackathon?.title,
                        roleId: hr._id
                    }));
                
                return {
                    ...user,
                    organizerRoles
                };
            });

            res.json({ users: usersWithRoles, message: req.__("user.fetch_success") });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                message: req.__("user.fetch_failed"),
                error: err.message,
            });
        }
    }

    // Get current user profile
    async getMe(req, res) {
        try {
            const user = await User.findById(req.user.id)
                .populate("organization", "name domain")
                .lean();
            
            if (!user) {
                return res.status(404).json({ message: req.__("user.not_found") });
            }

            res.json({ user, message: req.__("user.fetch_success") });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                message: req.__("user.fetch_failed"),
                error: err.message,
            });
        }
    }

    // Update current user profile
    async updateMe(req, res) {
        try {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ message: req.__("user.not_found") });
            }

            const { name, expertise } = req.body;

            // Update allowed fields
            if (name !== undefined) {
                user.name = name;
            }
            if (expertise !== undefined) {
                user.expertise = expertise;
            }

            await user.save();
            await user.populate("organization", "name domain");

            res.json({
                message: req.__("user.profile_updated_successfully"),
                user,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                message: req.__("user.profile_update_failed"),
                error: err.message,
            });
        }
    }
}

module.exports = new UserController();
