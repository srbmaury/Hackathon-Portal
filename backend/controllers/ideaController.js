const ideaService = require("../services/ideaService");
const User = require("../models/User");
const { evaluateIdea, findSimilarIdeas, getIdeaImprovements } = require("../services/ideaEvaluationService");

class IdeaController {
    async getPublicIdeas(req, res) {
        try {
            // Filter by user's organization
            const organizationId = req.user.organization?._id || req.user.organization;
            const ideas = await ideaService.getPublicIdeas(organizationId);
            res.json({ ideas });
        } catch (err) {
            res.status(500).json({ message: req.__("idea.get_failed"), error: err.message });
        }
    }

    async submitIdea(req, res) {
        try {
            const { title, description, isPublic } = req.body;
            const submitterId = req.user.id; // From JWT
            
            // Fetch user's organization
            const user = await User.findById(submitterId);
            if (!user || !user.organization) {
                return res.status(400).json({ message: req.__("idea.organization_not_found") });
            }
            
            const idea = await ideaService.createIdea({
                title,
                description,
                submitterId,
                isPublic,
                organization: user.organization,
            });
            res.status(201).json({ message: req.__("idea.submitted_successfully"), idea });
        } catch (err) {
            res.status(400).json({ message: req.__("idea.submission_failed"), error: err.message });
        }
    }

    async getMyIdeas(req, res) {
        try {
            // Filter by user's organization for consistency
            const organizationId = req.user.organization?._id || req.user.organization;
            const ideas = await ideaService.getIdeasByUser(req.user.id, organizationId);
            res.json({ ideas });
        } catch (err) {
            res.status(500).json({ message: req.__("idea.get_my_failed"), error: err.message });
        }
    }

    async editIdea(req, res) {
        try {
            const ideaId = req.params.id;
            const { title, description, isPublic } = req.body;
            const updatedIdea = await ideaService.updateIdea(
                req.user.id,
                ideaId,
                { title, description, isPublic }
            );
            res.json({ message: req.__("idea.updated_successfully"), idea: updatedIdea });
        } catch (err) {
            res.status(400).json({ message: req.__("idea.update_failed"), error: err.message });
        }
    }

    async deleteIdea(req, res) {
        try {
            const ideaId = req.params.id;
            await ideaService.deleteIdea(req.user.id, ideaId);
            res.json({ message: req.__("idea.deleted_successfully") });
        } catch (err) {
            res.status(400).json({ message: req.__("idea.delete_failed"), error: err.message });
        }
    }

    /**
     * Evaluate an idea using AI
     * @route POST /api/ideas/:id/evaluate
     * @access Private (Organizer/Admin)
     */
    async evaluate(req, res) {
        try {
            const ideaId = req.params.id;
            const idea = await ideaService.getIdeaById(ideaId);
            
            if (!idea) {
                return res.status(404).json({ message: req.__("idea.not_found") });
            }

            // Check if user is organizer or admin
            const organizationId = req.user.organization?._id || req.user.organization;
            if (String(idea.organization) !== String(organizationId) && req.user.role !== "admin") {
                return res.status(403).json({ message: req.__("auth.forbidden") });
            }

            const evaluation = await evaluateIdea(ideaId);
            res.json({ evaluation });
        } catch (err) {
            console.error("Idea evaluation error:", err);
            res.status(500).json({
                message: "Failed to evaluate idea",
                error: err.message,
            });
        }
    }

    /**
     * Find similar ideas
     * @route GET /api/ideas/:id/similar
     * @access Private
     */
    async findSimilar(req, res) {
        try {
            const ideaId = req.params.id;
            const organizationId = req.user.organization?._id || req.user.organization;
            
            const result = await findSimilarIdeas(ideaId, organizationId);
            res.json(result);
        } catch (err) {
            console.error("Find similar ideas error:", err);
            res.status(500).json({
                message: "Failed to find similar ideas",
                error: err.message,
            });
        }
    }

    /**
     * Get improvement suggestions for an idea
     * @route GET /api/ideas/:id/improvements
     * @access Private (Idea owner or Organizer/Admin)
     */
    async getImprovements(req, res) {
        try {
            const ideaId = req.params.id;
            const idea = await ideaService.getIdeaById(ideaId);
            
            if (!idea) {
                return res.status(404).json({ message: req.__("idea.not_found") });
            }

            // Check if user is idea owner, organizer, or admin
            const isOwner = String(idea.submitter) === String(req.user._id);
            const organizationId = req.user.organization?._id || req.user.organization;
            const isOrganizer = String(idea.organization) === String(organizationId) && 
                              (req.user.role === "admin" || req.user.role === "organizer");
            
            if (!isOwner && !isOrganizer) {
                return res.status(403).json({ message: req.__("auth.forbidden") });
            }

            const improvements = await getIdeaImprovements(ideaId);
            res.json(improvements);
        } catch (err) {
            console.error("Get idea improvements error:", err);
            res.status(500).json({
                message: "Failed to get improvement suggestions",
                error: err.message,
            });
        }
    }
}

module.exports = new IdeaController();
