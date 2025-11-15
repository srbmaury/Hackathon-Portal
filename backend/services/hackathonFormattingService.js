const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Format and beautify hackathon description using AI
 * @param {string} title - The hackathon title
 * @param {string} description - The raw hackathon description
 * @returns {Promise<Object>} Formatted hackathon with title and description
 */
async function formatHackathonDescription(title, description) {
    try {
        // If AI is disabled, return original content
        if (process.env.AI_ENABLED === "false") {
            return { title, description };
        }

        if (!title || !description) {
            return { title, description };
        }

        const prompt = `You are a professional hackathon description formatter. Your task is to transform plain text hackathon descriptions into beautifully formatted, engaging content using Markdown.

Hackathon Title: ${title}
Original Description: ${description}

Please format this hackathon description to be:
1. Professional and engaging
2. Well-structured with proper Markdown formatting (headers, lists, emphasis)
3. Easy to read with clear sections
4. Include appropriate emojis where they enhance readability (use sparingly)
5. Maintain all important information
6. Add structure with headers, bullet points, or numbered lists where appropriate
7. Make it compelling and attractive to participants

Return ONLY a valid JSON object in this exact format:
{
  "title": "formatted title here",
  "description": "formatted markdown description here"
}

Do not include any explanation, only the JSON object.`;

        const completion = await openai.chat.completions.create({
            model: process.env.AI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that formats hackathon descriptions. Always return valid JSON only with title and description fields.",
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
        const formatted = JSON.parse(responseContent);

        return {
            title: formatted.title || title,
            description: formatted.description || description,
        };
    } catch (error) {
        console.error("Error in hackathon description formatting:", error);
        // Return original content if AI fails
        return { title, description };
    }
}

module.exports = {
    formatHackathonDescription,
};

