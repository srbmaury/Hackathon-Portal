const HackathonRole = require("../models/HackathonRole");
const Hackathon = require("../models/Hackathon");

/**
 * Middleware to check if user has specific role(s) in a hackathon
 * Hackathon ID should be in req.params.id or req.params.hackathonId
 * Admins bypass all hackathon role checks
 */
function hackathonRoleCheck(...allowedRoles) {
    return async (req, res, next) => {
        try {
            const user = req.user;

            if (!user) {
                return res.status(401).json({ message: req.__("auth.unauthorized") });
            }

            // Admins bypass all hackathon role checks
            if (user.role === "admin") {
                return next();
            }

            // Get hackathon ID from params (prioritize hackathonId over id to avoid conflicts with nested routes)
            const hackathonId = req.params.hackathonId || req.params.id;

            if (!hackathonId) {
                return res.status(400).json({ 
                    message: "Hackathon ID is required" 
                });
            }

            // Check if hackathon exists and belongs to user's organization
            const hackathon = await Hackathon.findById(hackathonId);
            if (!hackathon) {
                return res.status(404).json({ 
                    message: req.__("hackathon.not_found") 
                });
            }

            if (String(hackathon.organization) !== String(user.organization._id)) {
                return res.status(403).json({ 
                    message: req.__("hackathon.access_denied") 
                });
            }

            // Check if user has the required role in this hackathon
            const hackathonRole = await HackathonRole.findOne({
                user: user._id,
                hackathon: hackathonId,
            });

            if (!hackathonRole || !allowedRoles.includes(hackathonRole.role)) {
                return res.status(403).json({ 
                    message: req.__("auth.forbidden_role") 
                });
            }

            // Attach hackathon role to request for later use
            req.hackathonRole = hackathonRole.role;
            next();
        } catch (err) {
            console.error("Hackathon Role Check Error:", err);
            res.status(500).json({ 
                message: "Error checking permissions",
                error: err.message 
            });
        }
    };
}

/**
 * Middleware to check if user has any role in a hackathon (is a member)
 */
async function isHackathonMember(req, res, next) {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({ message: req.__("auth.unauthorized") });
        }

        // Admins have access to all hackathons
        if (user.role === "admin") {
            return next();
        }

        // Get hackathon ID from params (prioritize hackathonId over id to avoid conflicts with nested routes)
        const hackathonId = req.params.hackathonId || req.params.id;

        if (!hackathonId) {
            return res.status(400).json({ 
                message: "Hackathon ID is required" 
            });
        }

        // Check if hackathon exists and belongs to user's organization
        const hackathon = await Hackathon.findById(hackathonId);
        if (!hackathon) {
            return res.status(404).json({ 
                message: req.__("hackathon.not_found") 
            });
        }

        if (String(hackathon.organization) !== String(user.organization._id)) {
            return res.status(403).json({ 
                message: req.__("hackathon.access_denied") 
            });
        }

        // Check if user has any role in this hackathon
        const hackathonRole = await HackathonRole.findOne({
            user: user._id,
            hackathon: hackathonId,
        });

        if (!hackathonRole) {
            return res.status(403).json({ 
                message: "You are not a member of this hackathon" 
            });
        }

        // Attach hackathon role to request for later use
        req.hackathonRole = hackathonRole.role;
        next();
    } catch (err) {
        console.error("Hackathon Member Check Error:", err);
        res.status(500).json({ 
            message: "Error checking membership",
            error: err.message 
        });
    }
}

module.exports = {
    hackathonRoleCheck,
    isHackathonMember,
};

