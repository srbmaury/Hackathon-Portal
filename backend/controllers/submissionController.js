const Submission = require("../models/Submission");
const Round = require("../models/Round");
const Team = require("../models/Team");
const Hackathon = require("../models/Hackathon");
const HackathonRole = require("../models/HackathonRole");
const { evaluateSubmission, generateFeedback, compareSubmissions } = require("../services/submissionEvaluationService");

class SubmissionController {
    /**
     * Submit for a round
     * @route POST /api/submissions/:roundId
     * @access Private (Team Members)
     */
    async submit(req, res) {
        try {
            const { roundId } = req.params;
            const { link } = req.body;
            const fileUrl = req.file ? req.file.path : null; // Cloudinary returns path as URL

            // Find round
            const round = await Round.findById(roundId);
            if (!round) {
                return res.status(404).json({ message: req.__("round.not_found") });
            }

            // Check if round is active
            if (!round.isActive) {
                return res.status(400).json({ message: req.__("round.not_active") });
            }

            // Check if round dates are valid
            const now = new Date();
            if (round.startDate && now < new Date(round.startDate)) {
                return res.status(400).json({ message: req.__("round.not_started") });
            }
            if (round.endDate && now > new Date(round.endDate)) {
                return res.status(400).json({ message: req.__("round.ended") });
            }

            // Find user's team for this hackathon
            const hackathon = await Hackathon.findOne({ rounds: roundId });
            if (!hackathon) {
                return res.status(404).json({ message: req.__("hackathon.not_found") });
            }

            const team = await Team.findOne({
                hackathon: hackathon._id,
                members: req.user._id,
            }).populate("organization");

            if (!team) {
                return res.status(404).json({ message: req.__("submission.team_not_found") });
            }

            // Check if submission already exists
            const existingSubmission = await Submission.findOne({
                team: team._id,
                round: roundId,
            });

            if (existingSubmission) {
                // Update existing submission
                if (link !== undefined) existingSubmission.link = link || "";
                if (fileUrl) existingSubmission.file = fileUrl;
                await existingSubmission.save();
                return res.json({
                    message: req.__("submission.updated"),
                    submission: existingSubmission,
                });
            }

            // Create new submission
            const submission = await Submission.create({
                team: team._id,
                round: roundId,
                hackathon: hackathon._id,
                organization: team.organization._id,
                link: link || "",
                file: fileUrl || "",
            });

            // Add submission to round
            round.submissions.push(submission._id);
            await round.save();

            res.status(201).json({
                message: req.__("submission.submitted"),
                submission,
            });
        } catch (error) {
            console.error("Submit Error:", error);
            if (error.code === 11000) {
                return res.status(400).json({ message: req.__("submission.already_exists") });
            }
            res.status(500).json({
                message: req.__("submission.submit_failed"),
                error: error.message,
            });
        }
    }

    /**
     * Get my submission for a round
     * @route GET /api/submissions/:roundId/my
     * @access Private
     */
    async getMySubmission(req, res) {
        try {
            const { roundId } = req.params;

            // Find user's team for this hackathon
            const hackathon = await Hackathon.findOne({ rounds: roundId });
            if (!hackathon) {
                return res.status(404).json({ message: req.__("hackathon.not_found") });
            }

            const team = await Team.findOne({
                hackathon: hackathon._id,
                members: req.user._id,
            });

            if (!team) {
                return res.json({ submission: null });
            }

            const submission = await Submission.findOne({
                team: team._id,
                round: roundId,
            })
                .populate("team", "name members")
                .populate("round", "name");

            res.json({ submission });
        } catch (error) {
            console.error("Get My Submission Error:", error);
            res.status(500).json({
                message: req.__("submission.fetch_failed"),
                error: error.message,
            });
        }
    }

    /**
     * Get all submissions for a round (organizer/judge/admin only)
     * @route GET /api/submissions/:roundId/all
     * @access Private (Organizer/Judge/Admin)
     */
    async getAllSubmissions(req, res) {
        try {
            const { roundId } = req.params;

            // Find hackathon
            const hackathon = await Hackathon.findOne({ rounds: roundId });
            if (!hackathon) {
                return res.status(404).json({ message: req.__("hackathon.not_found") });
            }

            // Check if user is organizer, judge, or admin
            const isAdmin = req.user.role === "admin";
            const hackathonRole = await HackathonRole.findOne({
                user: req.user._id,
                hackathon: hackathon._id,
                role: { $in: ["organizer", "judge"] },
            });

            if (!isAdmin && !hackathonRole) {
                return res.status(403).json({ message: req.__("auth.forbidden_role") });
            }

            const submissions = await Submission.find({ round: roundId })
                .populate("team", "name members")
                .populate("round", "name")
                .sort({ score: -1, createdAt: -1 });

            res.json({ submissions });
        } catch (error) {
            console.error("Get All Submissions Error:", error);
            res.status(500).json({
                message: req.__("submission.fetch_failed"),
                error: error.message,
            });
        }
    }

    /**
     * Get standings for a round (public view with scores)
     * @route GET /api/submissions/:roundId/standings
     * @access Private
     */
    async getStandings(req, res) {
        try {
            const { roundId } = req.params;

            // Get round to check if scores should be hidden
            const round = await Round.findById(roundId);
            if (!round) {
                return res.status(404).json({ message: req.__("round.not_found") });
            }

            // Check if user is judge/organizer/admin (they can see scores even if hidden)
            const hackathon = await Hackathon.findOne({ rounds: roundId });
            let canSeeScores = true;
            
            if (round.hideScores && hackathon) {
                const isAdmin = req.user.role === "admin";
                const hackathonRole = await HackathonRole.findOne({
                    user: req.user._id,
                    hackathon: hackathon._id,
                    role: { $in: ["organizer", "judge"] },
                });
                canSeeScores = isAdmin || !!hackathonRole;
            }

            const submissions = await Submission.find({ round: roundId })
                .populate({
                    path: "team",
                    select: "name",
                    populate: {
                        path: "members",
                        select: "name email",
                    },
                })
                .populate("round", "name")
                .sort({ score: -1, createdAt: 1 }); // Sort by score descending, then by submission time

            // If scores are hidden and user can't see them, remove scores from response
            const standings = canSeeScores 
                ? submissions 
                : submissions.map(sub => {
                    const subObj = sub.toObject();
                    delete subObj.score;
                    return subObj;
                });

            res.json({ 
                standings,
                hideScores: round.hideScores && !canSeeScores,
            });
        } catch (error) {
            console.error("Get Standings Error:", error);
            res.status(500).json({
                message: req.__("submission.fetch_failed"),
                error: error.message,
            });
        }
    }

    /**
     * Update submission score/feedback (organizer/judge/admin only)
     * @route PUT /api/submissions/:submissionId
     * @access Private (Organizer/Judge/Admin)
     */
    async updateSubmission(req, res) {
        try {
            const { submissionId } = req.params;
            const { score, feedback } = req.body;

            const submission = await Submission.findById(submissionId).populate("round");
            if (!submission) {
                return res.status(404).json({ message: req.__("submission.not_found") });
            }

            // Find hackathon
            const hackathon = await Hackathon.findById(submission.hackathon);
            if (!hackathon) {
                return res.status(404).json({ message: req.__("hackathon.not_found") });
            }

            // Only judges can update scores; organizers/admins can update feedback
            const isAdmin = req.user.role === "admin";
            const hackathonRole = await HackathonRole.findOne({
                user: req.user._id,
                hackathon: hackathon._id,
            });

            if (!isAdmin && !hackathonRole) {
                return res.status(403).json({ message: req.__("auth.forbidden_role") });
            }

            // Only judges can update scores (admins are treated as judges for score updates)
            if (score !== undefined) {
                const isJudge = hackathonRole?.role === "judge" || isAdmin;
                if (!isJudge) {
                    return res.status(403).json({ 
                        message: "Only judges can update scores. Organizers can only update feedback." 
                    });
                }
                submission.score = score;
            }
            
            // Organizers, judges, and admins can update feedback
            if (feedback !== undefined) {
                const canUpdateFeedback = isAdmin || (hackathonRole?.role && ["organizer", "judge"].includes(hackathonRole.role));
                if (!canUpdateFeedback) {
                    return res.status(403).json({ message: req.__("auth.forbidden_role") });
                }
                submission.feedback = feedback;
            }

            await submission.save();

            res.json({
                message: req.__("submission.updated"),
                submission,
            });
        } catch (error) {
            console.error("Update Submission Error:", error);
            res.status(500).json({
                message: req.__("submission.update_failed"),
                error: error.message,
            });
        }
    }

    /**
     * Evaluate a submission using AI
     * @route POST /api/submissions/:submissionId/evaluate
     * @access Private (Organizer/Judge/Admin)
     */
    async evaluate(req, res) {
        try {
            const { submissionId } = req.params;

            const submission = await Submission.findById(submissionId);
            if (!submission) {
                return res.status(404).json({ message: req.__("submission.not_found") });
            }

            // Find hackathon
            const hackathon = await Hackathon.findById(submission.hackathon);
            if (!hackathon) {
                return res.status(404).json({ message: req.__("hackathon.not_found") });
            }

            // Check if user is organizer, judge, or admin
            const isAdmin = req.user.role === "admin";
            const hackathonRole = await HackathonRole.findOne({
                user: req.user._id,
                hackathon: hackathon._id,
                role: { $in: ["organizer", "judge"] },
            });

            if (!isAdmin && !hackathonRole) {
                return res.status(403).json({ message: req.__("auth.forbidden_role") });
            }

            const evaluation = await evaluateSubmission(submissionId);
            res.json({ evaluation });
        } catch (error) {
            console.error("Submission evaluation error:", error);
            res.status(500).json({
                message: "Failed to evaluate submission",
                error: error.message,
            });
        }
    }

    /**
     * Generate AI feedback for a submission
     * @route POST /api/submissions/:submissionId/generate-feedback
     * @access Private (Organizer/Judge/Admin)
     */
    async generateFeedback(req, res) {
        try {
            const { submissionId } = req.params;
            const { score } = req.body;

            const submission = await Submission.findById(submissionId);
            if (!submission) {
                return res.status(404).json({ message: req.__("submission.not_found") });
            }

            // Find hackathon
            const hackathon = await Hackathon.findById(submission.hackathon);
            if (!hackathon) {
                return res.status(404).json({ message: req.__("hackathon.not_found") });
            }

            // Check if user is organizer, judge, or admin
            const isAdmin = req.user.role === "admin";
            const hackathonRole = await HackathonRole.findOne({
                user: req.user._id,
                hackathon: hackathon._id,
                role: { $in: ["organizer", "judge"] },
            });

            if (!isAdmin && !hackathonRole) {
                return res.status(403).json({ message: req.__("auth.forbidden_role") });
            }

            const result = await generateFeedback(submissionId, score);
            res.json(result);
        } catch (error) {
            console.error("Generate feedback error:", error);
            res.status(500).json({
                message: "Failed to generate feedback",
                error: error.message,
            });
        }
    }

    /**
     * Compare submissions in a round and get AI insights
     * @route GET /api/submissions/:roundId/compare
     * @access Private (Organizer/Judge/Admin)
     */
    async compare(req, res) {
        try {
            const { roundId } = req.params;

            // Find hackathon
            const hackathon = await Hackathon.findOne({ rounds: roundId });
            if (!hackathon) {
                return res.status(404).json({ message: req.__("hackathon.not_found") });
            }

            // Check if user is organizer, judge, or admin
            const isAdmin = req.user.role === "admin";
            const hackathonRole = await HackathonRole.findOne({
                user: req.user._id,
                hackathon: hackathon._id,
                role: { $in: ["organizer", "judge"] },
            });

            if (!isAdmin && !hackathonRole) {
                return res.status(403).json({ message: req.__("auth.forbidden_role") });
            }

            const comparison = await compareSubmissions(roundId);
            res.json(comparison);
        } catch (error) {
            console.error("Compare submissions error:", error);
            res.status(500).json({
                message: "Failed to compare submissions",
                error: error.message,
            });
        }
    }
}

module.exports = new SubmissionController();

