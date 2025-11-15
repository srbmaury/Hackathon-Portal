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
 * Generate AI assistant response for team chat questions
 * @param {string} question - The user's question
 * @param {string} teamId - The team ID
 * @param {Array} recentMessages - Recent messages in the chat (for context)
 * @returns {Promise<string>} AI-generated response
 */
async function generateChatResponse(question, teamId, recentMessages = []) {
    try {
        if (process.env.AI_ENABLED === "false") {
            return null;
        }

        if (!question || !question.trim()) {
            return null;
        }

        // Get team context
        const team = await Team.findById(teamId)
            .populate("hackathon", "title description")
            .populate("members", "name email")
            .populate("mentor", "name email");

        if (!team) {
            return null;
        }

        // Get hackathon rounds and deadlines
        const hackathon = await Hackathon.findById(team.hackathon._id)
            .populate("rounds");

        const activeRounds = hackathon.rounds.filter(r => r.isActive && r.endDate);
        const upcomingDeadlines = activeRounds
            .map(round => ({
                name: round.name,
                endDate: round.endDate,
                description: round.description,
            }))
            .sort((a, b) => new Date(a.endDate) - new Date(b.endDate));

        // Get team's submission status
        const submissions = await Submission.find({ team: teamId })
            .populate("round", "name endDate");

        const submissionStatus = submissions.map(sub => ({
            round: sub.round?.name || "Unknown",
            submitted: !!sub.link || !!sub.file,
            score: sub.score || 0,
            deadline: sub.round?.endDate,
        }));

        // Build context from recent messages (last 10)
        const messageContext = recentMessages
            .slice(-10)
            .map(msg => `${msg.sender?.name || "User"}: ${msg.content}`)
            .join("\n");

        const prompt = `You are an AI assistant helping a hackathon team. Answer their question based on the context provided.

Team Context:
- Team Name: ${team.name}
- Hackathon: ${team.hackathon.title}
- Hackathon Description: ${team.hackathon.description || "N/A"}
- Team Members: ${team.members.map(m => m.name).join(", ") || "N/A"}
- Mentor: ${team.mentor?.name || "Not assigned yet"}

Upcoming Deadlines:
${upcomingDeadlines.length > 0 
    ? upcomingDeadlines.map(d => `- ${d.name}: ${new Date(d.endDate).toLocaleDateString()} ${d.description ? `(${d.description})` : ""}`).join("\n")
    : "No active rounds with deadlines"}

Team Submission Status:
${submissionStatus.length > 0
    ? submissionStatus.map(s => `- ${s.round}: ${s.submitted ? "Submitted" : "Not submitted"} ${s.score > 0 ? `(Score: ${s.score})` : ""}`).join("\n")
    : "No submissions yet"}

Recent Chat Context:
${messageContext || "No recent messages"}

User Question: ${question}

Instructions:
1. Answer the question concisely and helpfully
2. If asked about deadlines, provide specific dates and times
3. If asked about submissions, reference the team's current status
4. If asked about hackathon rules or guidelines, refer to the hackathon description
5. If you don't have enough information, say so politely
6. Keep responses brief (2-3 sentences max)
7. Be friendly and encouraging
8. If asked about team members or mentor, use the information provided

Return ONLY the response text, no explanations or metadata.`;

        const completion = await openai.chat.completions.create({
            model: process.env.AI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful AI assistant for hackathon teams. Provide concise, accurate answers based on the context provided. Always be friendly and encouraging.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: 200,
        });

        const response = completion.choices[0].message.content.trim();
        return response || null;
    } catch (error) {
        console.error("Error generating chat assistant response:", error);
        return null;
    }
}

/**
 * Check if a message explicitly mentions AI assistant
 * @param {string} message - The message content
 * @returns {boolean} True if message explicitly mentions AI
 */
function isAIMentioned(message) {
    if (!message || message.trim().length < 3) {
        return false;
    }

    const trimmed = message.trim();
    const lowerMessage = trimmed.toLowerCase();
    
    // Check for explicit AI mentions
    const aiMentions = [
        "@ai",
        "@assistant",
        "@bot",
        "ai ",
        "ai:",
        "ai,",
        "assistant ",
        "assistant:",
        "assistant,",
        "🤖",
    ];

    // Check if message starts with or contains AI mention
    return aiMentions.some(mention => {
        return lowerMessage.startsWith(mention) || 
               lowerMessage.includes(` ${mention}`) ||
               lowerMessage.includes(` ${mention.trim()}`);
    });
}

/**
 * Extract the actual question from a message (remove AI mention)
 * @param {string} message - The message content
 * @returns {string} The question without AI mention
 */
function extractQuestion(message) {
    if (!message) return "";
    
    const trimmed = message.trim();
    const lowerMessage = trimmed.toLowerCase();
    
    // Remove AI mentions from the beginning
    const aiMentions = ["@ai", "@assistant", "@bot", "ai:", "assistant:", "🤖"];
    
    for (const mention of aiMentions) {
        if (lowerMessage.startsWith(mention)) {
            return trimmed.substring(mention.length).trim();
        }
        if (lowerMessage.startsWith(`${mention} `)) {
            return trimmed.substring(mention.length + 1).trim();
        }
    }
    
    // Remove AI mentions from anywhere in the message
    let cleaned = trimmed;
    for (const mention of aiMentions) {
        const regex = new RegExp(`\\s*${mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'gi');
        cleaned = cleaned.replace(regex, ' ').trim();
    }
    
    return cleaned;
}

/**
 * Generate meeting summary from recent messages
 * @param {Array} messages - Array of messages
 * @returns {Promise<string>} Summary text
 */
async function generateMeetingSummary(messages) {
    try {
        if (process.env.AI_ENABLED === "false" || !messages || messages.length === 0) {
            return null;
        }

        const messageText = messages
            .slice(-50) // Last 50 messages
            .map(msg => `${msg.sender?.name || "User"}: ${msg.content}`)
            .join("\n");

        const prompt = `Summarize the following team chat conversation. Extract:
1. Key decisions made
2. Action items (who should do what)
3. Important deadlines or dates mentioned
4. Main topics discussed

Conversation:
${messageText}

Return ONLY a JSON object in this format:
{
  "summary": "Brief summary of the conversation",
  "decisions": ["decision1", "decision2"],
  "actionItems": [{"person": "name", "task": "description"}],
  "deadlines": ["deadline1", "deadline2"],
  "topics": ["topic1", "topic2"]
}

If any section has no items, use an empty array.`;

        const completion = await openai.chat.completions.create({
            model: process.env.AI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that summarizes team conversations. Return only valid JSON.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.5,
            response_format: { type: "json_object" },
        });

        const response = JSON.parse(completion.choices[0].message.content);
        return response;
    } catch (error) {
        console.error("Error generating meeting summary:", error);
        return null;
    }
}

module.exports = {
    generateChatResponse,
    isAIMentioned,
    extractQuestion,
    generateMeetingSummary,
};

