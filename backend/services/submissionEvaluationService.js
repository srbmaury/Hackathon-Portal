const OpenAI = require("openai");
const Submission = require("../models/Submission");
const Team = require("../models/Team");
const Round = require("../models/Round");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Evaluate a submission using AI
 * @param {string} submissionId - The submission ID
 * @param {Object} submissionData - Optional submission data (if not provided, will fetch from DB)
 * @returns {Promise<Object>} Evaluation results with scores and feedback
 */
async function evaluateSubmission(submissionId, submissionData = null) {
    try {
        // If AI is disabled, return empty evaluation
        if (process.env.AI_ENABLED === "false") {
            return null;
        }

        let submission;
        if (submissionData) {
            submission = submissionData;
        } else {
            submission = await Submission.findById(submissionId)
                .populate("team", "name idea")
                .populate("round", "name description");
            if (!submission) {
                throw new Error("Submission not found");
            }
        }

        // Get team idea if available
        const team = await Team.findById(submission.team).populate("idea", "title description");
        const ideaInfo = team?.idea ? `Team Idea: ${team.idea.title} - ${team.idea.description}` : "";

        const prompt = `You are an expert hackathon judge. Evaluate this submission based on multiple criteria.

Round: ${submission.round?.name || "Unknown"}
${ideaInfo}

Submission Details:
- Link: ${submission.link || "Not provided"}
- File: ${submission.file ? "File attached" : "No file"}
- Submitted at: ${submission.createdAt}

Note: You cannot access the actual link or file content, but evaluate based on:
1. The submission context (round, idea, team)
2. The presence and type of submission materials
3. General hackathon evaluation criteria

Evaluate this submission on the following criteria (each scored 0-100):
1. Technical Implementation: Quality of technical execution
2. Innovation: How innovative and creative is the solution?
3. Problem Solving: How well does it solve the stated problem?
4. Presentation: Quality of presentation and documentation
5. Completeness: How complete is the submission?

Also provide:
- Overall Score (0-100): Weighted average of all criteria
- Strengths: List 3-5 key strengths
- Areas for Improvement: List 3-5 areas that need work
- Detailed Feedback: Comprehensive feedback paragraph for the team

Return ONLY a valid JSON object in this exact format:
{
  "scores": {
    "technicalImplementation": 75,
    "innovation": 80,
    "problemSolving": 70,
    "presentation": 65,
    "completeness": 85
  },
  "overallScore": 75,
  "strengths": [
    "strength 1",
    "strength 2",
    ...
  ],
  "areasForImprovement": [
    "improvement 1",
    "improvement 2",
    ...
  ],
  "detailedFeedback": "Comprehensive feedback paragraph here"
}

Do not include any explanation, only the JSON object.`;

        const completion = await openai.chat.completions.create({
            model: process.env.AI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert hackathon judge. Always return valid JSON only with evaluation scores and feedback.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.3,
            response_format: { type: "json_object" },
        });

        const responseContent = completion.choices[0].message.content;
        const evaluation = JSON.parse(responseContent);

        return {
            submissionId: submission._id.toString(),
            evaluation,
            evaluatedAt: new Date(),
        };
    } catch (error) {
        console.error("Error in submission evaluation:", error);
        throw error;
    }
}

/**
 * Generate detailed feedback for a submission
 * @param {string} submissionId - The submission ID
 * @param {number} score - Optional manual score from judge
 * @returns {Promise<Object>} Generated feedback
 */
async function generateFeedback(submissionId, score = null) {
    try {
        if (process.env.AI_ENABLED === "false") {
            return { feedback: "" };
        }

        const submission = await Submission.findById(submissionId)
            .populate("team", "name idea")
            .populate("round", "name description");

        if (!submission) {
            throw new Error("Submission not found");
        }

        const team = await Team.findById(submission.team).populate("idea", "title description");
        const ideaInfo = team?.idea ? `Team Idea: ${team.idea.title} - ${team.idea.description}` : "";

        const scoreContext = score !== null ? `The judge has given this submission a score of ${score}/100.` : "";

        const prompt = `You are an expert hackathon judge providing detailed, constructive feedback.

Round: ${submission.round?.name || "Unknown"}
${ideaInfo}
${scoreContext}

Submission Details:
- Link: ${submission.link || "Not provided"}
- File: ${submission.file ? "File attached" : "No file"}
- Current Score: ${submission.score || "Not scored yet"}

Generate comprehensive, constructive feedback that:
1. Highlights what the team did well
2. Identifies specific areas for improvement
3. Provides actionable suggestions
4. Is encouraging and professional
5. Is detailed enough to be helpful (3-5 paragraphs)

Return ONLY a valid JSON object in this exact format:
{
  "feedback": "Comprehensive feedback text here (3-5 paragraphs)"
}

Do not include any explanation, only the JSON object.`;

        const completion = await openai.chat.completions.create({
            model: process.env.AI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert hackathon judge providing constructive feedback. Always return valid JSON only.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.5,
            response_format: { type: "json_object" },
        });

        const responseContent = completion.choices[0].message.content;
        const result = JSON.parse(responseContent);

        return {
            feedback: result.feedback || "",
        };
    } catch (error) {
        console.error("Error in generating feedback:", error);
        return { feedback: "" };
    }
}

/**
 * Compare multiple submissions and provide ranking insights
 * @param {string} roundId - The round ID
 * @returns {Promise<Object>} Comparison and ranking insights
 */
async function compareSubmissions(roundId) {
    try {
        if (process.env.AI_ENABLED === "false") {
            return { insights: [] };
        }

        const submissions = await Submission.find({ round: roundId })
            .populate("team", "name idea")
            .populate("round", "name")
            .limit(20); // Limit to avoid too many API calls

        if (submissions.length < 2) {
            return { insights: [] };
        }

        const submissionsData = submissions.map((sub) => ({
            id: sub._id.toString(),
            teamName: sub.team?.name || "Unknown",
            idea: sub.team?.idea?.title || "No idea",
            link: sub.link || "",
            score: sub.score || 0,
        }));

        const prompt = `You are an expert hackathon judge analyzing multiple submissions. Compare these submissions and provide insights.

Submissions:
${JSON.stringify(submissionsData, null, 2)}

Provide:
1. Overall trends and patterns
2. Common strengths across submissions
3. Common weaknesses
4. Ranking insights
5. Recommendations for judges

Return ONLY a valid JSON object in this exact format:
{
  "insights": [
    {
      "type": "trend" | "strength" | "weakness" | "recommendation",
      "title": "insight title",
      "description": "detailed insight description"
    },
    ...
  ],
  "summary": "overall summary paragraph"
}

Do not include any explanation, only the JSON object.`;

        const completion = await openai.chat.completions.create({
            model: process.env.AI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert hackathon judge analyzing submissions. Always return valid JSON only.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.4,
            response_format: { type: "json_object" },
        });

        const responseContent = completion.choices[0].message.content;
        return JSON.parse(responseContent);
    } catch (error) {
        console.error("Error in comparing submissions:", error);
        return { insights: [] };
    }
}

module.exports = {
    evaluateSubmission,
    generateFeedback,
    compareSubmissions,
};

