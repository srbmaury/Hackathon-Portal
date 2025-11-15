const OpenAI = require("openai");
const Idea = require("../models/Idea");

// Initialize OpenAI only if API key is available (prevents errors during tests)
let openai = null;
function getOpenAI() {
    if (!openai && process.env.OPENAI_API_KEY && process.env.AI_ENABLED !== "false") {
        try {
            openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });
        } catch (error) {
            console.warn("Failed to initialize OpenAI:", error.message);
            return null;
        }
    }
    return openai;
}

/**
 * Evaluate an idea using AI
 * @param {string} ideaId - The idea ID
 * @param {Object} ideaData - Optional idea data (if not provided, will fetch from DB)
 * @returns {Promise<Object>} Evaluation results with scores and feedback
 */
async function evaluateIdea(ideaId, ideaData = null) {
    try {
        // If AI is disabled, return empty evaluation
        if (process.env.AI_ENABLED === "false") {
            return null;
        }

        let idea;
        if (ideaData) {
            idea = ideaData;
        } else {
            idea = await Idea.findById(ideaId);
            if (!idea) {
                throw new Error("Idea not found");
            }
        }

        const prompt = `You are an expert hackathon idea evaluator. Evaluate this idea based on multiple criteria.

Idea Title: ${idea.title}
Idea Description: ${idea.description}

Evaluate this idea on the following criteria (each scored 0-100):
1. Innovation: How innovative and original is this idea?
2. Feasibility: How technically feasible is this idea within a hackathon timeframe?
3. Market Potential: Does this solve a real problem? Is there market demand?
4. Clarity: Is the idea clearly explained and well-defined?
5. Impact: What potential impact could this idea have?

Also provide:
- Overall Score (0-100): Weighted average of all criteria
- Strengths: List 3-5 key strengths
- Areas for Improvement: List 3-5 areas that need work
- Detailed Feedback: Comprehensive feedback paragraph

Return ONLY a valid JSON object in this exact format:
{
  "scores": {
    "innovation": 85,
    "feasibility": 75,
    "marketPotential": 80,
    "clarity": 70,
    "impact": 90
  },
  "overallScore": 80,
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

        const openaiClient = getOpenAI();
        if (!openaiClient) {
            throw new Error("OpenAI is not configured");
        }
        const completion = await openaiClient.chat.completions.create({
            model: process.env.AI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert hackathon idea evaluator. Always return valid JSON only with evaluation scores and feedback.",
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
            ideaId: idea._id.toString(),
            ideaTitle: idea.title,
            evaluation,
            evaluatedAt: new Date(),
        };
    } catch (error) {
        console.error("Error in idea evaluation:", error);
        throw error;
    }
}

/**
 * Detect similar or duplicate ideas
 * @param {string} ideaId - The idea ID to check
 * @param {string} organizationId - Organization ID to search within
 * @returns {Promise<Object>} Similar ideas with similarity scores
 */
async function findSimilarIdeas(ideaId, organizationId) {
    try {
        if (process.env.AI_ENABLED === "false") {
            return { similarIdeas: [] };
        }

        const idea = await Idea.findById(ideaId);
        if (!idea) {
            throw new Error("Idea not found");
        }

        // Get other ideas from the same organization
        const otherIdeas = await Idea.find({
            _id: { $ne: ideaId },
            organization: organizationId,
        }).limit(20); // Limit to avoid too many API calls

        if (otherIdeas.length === 0) {
            return { similarIdeas: [] };
        }

        const ideasData = otherIdeas.map((i) => ({
            id: i._id.toString(),
            title: i.title,
            description: i.description,
        }));

        const prompt = `You are an expert at detecting similar ideas. Compare this idea with a list of other ideas and identify which ones are similar.

Current Idea:
Title: ${idea.title}
Description: ${idea.description}

Other Ideas:
${JSON.stringify(ideasData, null, 2)}

For each idea, determine if it's similar to the current idea (similarity score 0-100).
Consider:
- Similar problem statements
- Similar solutions or approaches
- Overlapping concepts

Return ONLY a valid JSON object in this exact format:
{
  "similarIdeas": [
    {
      "ideaId": "idea_id_1",
      "similarityScore": 85,
      "reason": "brief explanation of similarity"
    },
    ...
  ]
}

Only include ideas with similarity score >= 50. Do not include any explanation, only the JSON object.`;

        const openaiClient = getOpenAI();
        if (!openaiClient) {
            throw new Error("OpenAI is not configured");
        }
        const completion = await openaiClient.chat.completions.create({
            model: process.env.AI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert at detecting similar ideas. Always return valid JSON only.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.2,
            response_format: { type: "json_object" },
        });

        const responseContent = completion.choices[0].message.content;
        const result = JSON.parse(responseContent);

        // Populate idea details
        const similarIdeas = await Promise.all(
            (result.similarIdeas || []).map(async (similar) => {
                const similarIdea = await Idea.findById(similar.ideaId)
                    .populate("submitter", "name email");
                return {
                    ...similar,
                    idea: similarIdea,
                };
            })
        );

        return { similarIdeas };
    } catch (error) {
        console.error("Error in finding similar ideas:", error);
        return { similarIdeas: [] };
    }
}

/**
 * Get suggestions for improving an idea
 * @param {string} ideaId - The idea ID
 * @returns {Promise<Object>} Improvement suggestions
 */
async function getIdeaImprovements(ideaId) {
    try {
        if (process.env.AI_ENABLED === "false") {
            return { suggestions: [] };
        }

        const idea = await Idea.findById(ideaId);
        if (!idea) {
            throw new Error("Idea not found");
        }

        const prompt = `You are an expert hackathon mentor. Review this idea and provide constructive suggestions for improvement.

Idea Title: ${idea.title}
Idea Description: ${idea.description}

Provide suggestions for:
1. Better problem definition
2. Technical approach improvements
3. Feature additions or enhancements
4. Market research or validation needs
5. Presentation improvements

Return ONLY a valid JSON object in this exact format:
{
  "suggestions": [
    {
      "category": "Problem Definition",
      "suggestion": "detailed suggestion text"
    },
    {
      "category": "Technical Approach",
      "suggestion": "detailed suggestion text"
    },
    ...
  ],
  "improvedTitle": "suggested improved title",
  "improvedDescription": "suggested improved description"
}

Do not include any explanation, only the JSON object.`;

        const openaiClient = getOpenAI();
        if (!openaiClient) {
            throw new Error("OpenAI is not configured");
        }
        const completion = await openaiClient.chat.completions.create({
            model: process.env.AI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert hackathon mentor providing improvement suggestions. Always return valid JSON only.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.6,
            response_format: { type: "json_object" },
        });

        const responseContent = completion.choices[0].message.content;
        return JSON.parse(responseContent);
    } catch (error) {
        console.error("Error in getting idea improvements:", error);
        return { suggestions: [] };
    }
}

module.exports = {
    evaluateIdea,
    findSimilarIdeas,
    getIdeaImprovements,
};

