const OpenAI = require("openai");
const Team = require("../models/Team");
const Hackathon = require("../models/Hackathon");
const Round = require("../models/Round");
const Submission = require("../models/Submission");
const Message = require("../models/Message");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze team progress and predict risk of missing deadline
 * @param {string} teamId - The team ID
 * @param {string} roundId - The round ID
 * @returns {Promise<Object>} Risk analysis with score and reasons
 */
async function analyzeTeamRisk(teamId, roundId) {
    try {
        if (process.env.AI_ENABLED === "false") {
            return getDefaultRiskAnalysis();
        }

        const team = await Team.findById(teamId)
            .populate("members", "name email")
            .populate("hackathon", "title description");

        if (!team) {
            return getDefaultRiskAnalysis();
        }

        const round = await Round.findById(roundId);
        if (!round || !round.endDate) {
            return getDefaultRiskAnalysis();
        }

        // Get submission status
        const submission = await Submission.findOne({ team: teamId, round: roundId });

        // Get team activity (messages in last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentMessages = await Message.find({
            team: teamId,
            createdAt: { $gte: sevenDaysAgo },
        }).countDocuments();

        // Calculate time remaining
        const now = new Date();
        const deadline = new Date(round.endDate);
        const timeRemaining = deadline - now;
        const hoursRemaining = timeRemaining / (1000 * 60 * 60);
        const daysRemaining = hoursRemaining / 24;

        // Get all submissions for this team across all rounds
        const allSubmissions = await Submission.find({ team: teamId })
            .populate("round", "name endDate");

        // Calculate submission history
        const submissionHistory = allSubmissions.map(sub => ({
            round: sub.round?.name || "Unknown",
            submitted: !!sub.link || !!sub.file,
            submittedAt: sub.createdAt,
            deadline: sub.round?.endDate,
            onTime: sub.round?.endDate ? new Date(sub.createdAt) <= new Date(sub.round.endDate) : true,
        }));

        const onTimeSubmissions = submissionHistory.filter(s => s.onTime).length;
        const totalSubmissions = submissionHistory.length;
        const onTimeRate = totalSubmissions > 0 ? onTimeSubmissions / totalSubmissions : 1;

        // Build context for AI analysis
        const context = {
            teamName: team.name,
            hackathonTitle: team.hackathon.title,
            roundName: round.name,
            roundDescription: round.description || "",
            deadline: round.endDate,
            daysRemaining: Math.round(daysRemaining * 10) / 10,
            hoursRemaining: Math.round(hoursRemaining * 10) / 10,
            hasSubmission: !!submission && (!!submission.link || !!submission.file),
            submissionCreated: submission?.createdAt || null,
            teamSize: team.members.length,
            recentActivity: recentMessages,
            onTimeRate: Math.round(onTimeRate * 100),
            submissionHistory: submissionHistory.length,
        };

        const prompt = `Analyze the risk of a hackathon team missing their submission deadline.

Team Context:
- Team: ${context.teamName}
- Hackathon: ${context.hackathonTitle}
- Round: ${context.roundName}
- Round Description: ${context.roundDescription || "N/A"}

Deadline Information:
- Deadline: ${new Date(context.deadline).toLocaleString()}
- Days Remaining: ${context.daysRemaining}
- Hours Remaining: ${context.hoursRemaining}

Current Status:
- Has Submission: ${context.hasSubmission ? "Yes" : "No"}
- Submission Created: ${context.hasSubmission && context.submissionCreated ? new Date(context.submissionCreated).toLocaleString() : "N/A"}
- Team Size: ${context.teamSize} members
- Recent Chat Activity (last 7 days): ${context.recentActivity} messages
- Historical On-Time Rate: ${context.onTimeRate}% (${onTimeSubmissions}/${totalSubmissions} submissions on time)

Risk Factors to Consider:
1. Time remaining (less time = higher risk)
2. Submission status (no submission = higher risk)
3. Team activity (low activity = higher risk)
4. Historical performance (low on-time rate = higher risk)
5. Team size (very small teams might struggle)

Return ONLY a valid JSON object in this exact format:
{
  "riskScore": 0-100,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "reasons": ["reason1", "reason2", "reason3"],
  "recommendations": ["recommendation1", "recommendation2"],
  "predictedProbability": 0-100
}

Where:
- riskScore: 0-100 (0 = no risk, 100 = very high risk)
- riskLevel: categorical risk level
- reasons: array of specific risk factors identified
- recommendations: actionable suggestions to reduce risk
- predictedProbability: 0-100, probability of missing deadline (0 = will definitely submit, 100 = will definitely miss)

Be specific and actionable in your analysis.`;

        const completion = await openai.chat.completions.create({
            model: process.env.AI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert at analyzing project deadlines and team performance. Return only valid JSON with the specified structure.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.5,
            response_format: { type: "json_object" },
        });

        const analysis = JSON.parse(completion.choices[0].message.content);

        // Validate and add fallback values
        return {
            riskScore: Math.min(100, Math.max(0, analysis.riskScore || calculateRiskScore(context))),
            riskLevel: analysis.riskLevel || getRiskLevel(analysis.riskScore || calculateRiskScore(context)),
            reasons: Array.isArray(analysis.reasons) ? analysis.reasons : getDefaultReasons(context),
            recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
            predictedProbability: Math.min(100, Math.max(0, analysis.predictedProbability || 0)),
            context: context,
        };
    } catch (error) {
        console.error("Error analyzing team risk:", error);
        return getDefaultRiskAnalysis();
    }
}

/**
 * Calculate risk score based on simple heuristics (fallback)
 */
function calculateRiskScore(context) {
    let score = 0;

    // Time remaining factor (0-40 points)
    if (context.daysRemaining < 0) {
        score += 40; // Already past deadline
    } else if (context.daysRemaining < 1) {
        score += 35; // Less than 1 day
    } else if (context.daysRemaining < 2) {
        score += 25; // Less than 2 days
    } else if (context.daysRemaining < 3) {
        score += 15; // Less than 3 days
    } else if (context.daysRemaining < 7) {
        score += 10; // Less than 1 week
    }

    // Submission status (0-30 points)
    if (!context.hasSubmission) {
        score += 30;
    } else if (context.daysRemaining < 1) {
        score += 10; // Has submission but deadline very close
    }

    // Activity level (0-20 points)
    if (context.recentActivity === 0) {
        score += 20; // No recent activity
    } else if (context.recentActivity < 3) {
        score += 10; // Very low activity
    }

    // Historical performance (0-10 points)
    if (context.onTimeRate < 50) {
        score += 10;
    } else if (context.onTimeRate < 75) {
        score += 5;
    }

    return Math.min(100, score);
}

/**
 * Get risk level from score
 */
function getRiskLevel(score) {
    if (score >= 75) return "critical";
    if (score >= 50) return "high";
    if (score >= 25) return "medium";
    return "low";
}

/**
 * Get default reasons based on context
 */
function getDefaultReasons(context) {
    const reasons = [];
    if (context.daysRemaining < 1) {
        reasons.push("Deadline is very close (less than 1 day remaining)");
    }
    if (!context.hasSubmission) {
        reasons.push("No submission has been made yet");
    }
    if (context.recentActivity === 0) {
        reasons.push("No recent team activity in chat");
    }
    if (context.onTimeRate < 50 && context.submissionHistory > 0) {
        reasons.push("Low historical on-time submission rate");
    }
    return reasons.length > 0 ? reasons : ["Unable to determine specific risk factors"];
}

/**
 * Get default risk analysis (fallback)
 */
function getDefaultRiskAnalysis() {
    return {
        riskScore: 50,
        riskLevel: "medium",
        reasons: ["Insufficient data for analysis"],
        recommendations: ["Monitor team progress closely"],
        predictedProbability: 50,
        context: null,
    };
}

/**
 * Get all teams at risk for a specific round
 * @param {string} roundId - The round ID
 * @param {number} threshold - Risk score threshold (default: 50)
 * @returns {Promise<Array>} Array of teams with risk analysis
 */
async function getAtRiskTeams(roundId, threshold = 50) {
    try {
        const round = await Round.findById(roundId)
            .populate("submissions");

        if (!round) {
            return [];
        }

        // Get all teams in this round's hackathon
        const hackathon = await Hackathon.findOne({ rounds: roundId })
            .populate("rounds");

        if (!hackathon) {
            return [];
        }

        // Get all teams for this hackathon
        const teams = await Team.find({ hackathon: hackathon._id })
            .populate("members", "name email");

        // Analyze each team
        const riskAnalyses = await Promise.all(
            teams.map(async (team) => {
                const analysis = await analyzeTeamRisk(team._id, roundId);
                return {
                    team: {
                        _id: team._id,
                        name: team.name,
                        members: team.members,
                    },
                    analysis,
                };
            })
        );

        // Filter by threshold and sort by risk score
        return riskAnalyses
            .filter(item => item.analysis.riskScore >= threshold)
            .sort((a, b) => b.analysis.riskScore - a.analysis.riskScore);
    } catch (error) {
        console.error("Error getting at-risk teams:", error);
        return [];
    }
}

/**
 * Generate personalized reminder message for a team
 * @param {string} teamId - The team ID
 * @param {string} roundId - The round ID
 * @returns {Promise<string>} Personalized reminder message
 */
async function generateReminderMessage(teamId, roundId) {
    try {
        if (process.env.AI_ENABLED === "false") {
            return "Don't forget to submit your work before the deadline!";
        }

        const analysis = await analyzeTeamRisk(teamId, roundId);
        const team = await Team.findById(teamId).populate("members", "name");
        const round = await Round.findById(roundId);

        if (!team || !round) {
            return "Don't forget to submit your work before the deadline!";
        }

        const deadline = new Date(round.endDate);
        const now = new Date();
        const hoursRemaining = (deadline - now) / (1000 * 60 * 60);
        const daysRemaining = hoursRemaining / 24;

        const prompt = `Generate a friendly, encouraging reminder message for a hackathon team about their upcoming deadline.

Team: ${team.name}
Round: ${round.name}
Deadline: ${deadline.toLocaleString()}
Time Remaining: ${Math.round(daysRemaining * 10) / 10} days (${Math.round(hoursRemaining * 10) / 10} hours)
Risk Level: ${analysis.riskLevel}
Risk Score: ${analysis.riskScore}/100

Key Points:
${analysis.reasons.map(r => `- ${r}`).join("\n")}

Recommendations:
${analysis.recommendations.map(r => `- ${r}`).join("\n")}

Generate a brief, friendly reminder message (2-3 sentences max) that:
1. Reminds them of the deadline
2. Is encouraging and supportive
3. Mentions key recommendations if risk is high
4. Uses a warm, team-oriented tone

Return ONLY the message text, no explanations.`;

        const completion = await openai.chat.completions.create({
            model: process.env.AI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that generates friendly reminder messages for hackathon teams. Be encouraging and supportive.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: 150,
        });

        return completion.choices[0].message.content.trim();
    } catch (error) {
        console.error("Error generating reminder message:", error);
        return "Don't forget to submit your work before the deadline!";
    }
}

module.exports = {
    analyzeTeamRisk,
    getAtRiskTeams,
    generateReminderMessage,
};

