// AI summarization service for Demo Day Stage
const { getOpenAI } = require("../config/openai");

async function summarizeDemo(session) {
    const openai = getOpenAI();
    if (!openai) return null;
    const prompt = `You are an event assistant. Summarize the following demo:\n\nTeam: ${session.team?.name || "Unknown"}\nProject: ${session.team?.projectTitle || "N/A"}\n\nInstructions:\n1. Write a 2-3 sentence summary of the demo.\n2. Highlight any unique aspects or standout features of the project.\nReturn a JSON object: { summary: string, highlights: string }\n`;
    const completion = await openai.chat.completions.create({
        model: process.env.AI_MODEL || "gpt-4o-mini",
        messages: [
            { role: "system", content: "You are a helpful event assistant. Return only valid JSON." },
            { role: "user", content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
    });
    return JSON.parse(completion.choices[0].message.content);
}

module.exports = { summarizeDemo };
