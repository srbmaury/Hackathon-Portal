const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Format and beautify announcement content using AI
 * @param {string} title - The announcement title
 * @param {string} message - The raw announcement message
 * @param {string} hackathonTitle - Optional hackathon title for context
 * @returns {Promise<Object>} Formatted announcement with title and message
 */
async function formatAnnouncement(title, message, hackathonTitle = null) {
    try {
        // If AI is disabled, return original content
        if (process.env.AI_ENABLED === "false") {
            return { title, message };
        }

        if (!title || !message) {
            return { title, message };
        }

        const context = hackathonTitle ? `This announcement is for the hackathon: ${hackathonTitle}.` : "";

        const prompt = `You are a professional hackathon announcement formatter. Your task is to transform plain text announcements into beautifully formatted, engaging content using Markdown.

${context}

Original Title: ${title}
Original Message: ${message}

Please format this announcement to be:
1. Professional and engaging
2. Well-structured with proper Markdown formatting (headers, lists, emphasis)
3. Easy to read with clear sections
4. Include appropriate emojis where they enhance readability (use sparingly)
5. Maintain all important information
6. Add structure with headers, bullet points, or numbered lists where appropriate

Return ONLY a valid JSON object in this exact format:
{
  "title": "formatted title here",
  "message": "formatted markdown message here"
}

Do not include any explanation, only the JSON object.`;

        const completion = await openai.chat.completions.create({
            model: process.env.AI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that formats hackathon announcements. Always return valid JSON only with title and message fields.",
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
            message: formatted.message || message,
        };
    } catch (error) {
        console.error("Error in announcement formatting:", error);
        // Return original content if AI fails
        return { title, message };
    }
}

/**
 * Enhance announcement content with suggestions
 * @param {string} title - The announcement title
 * @param {string} message - The announcement message
 * @returns {Promise<Object>} Enhanced announcement with suggestions
 */
async function enhanceAnnouncement(title, message) {
    try {
        if (process.env.AI_ENABLED === "false") {
            return { title, message, suggestions: [] };
        }

        if (!title || !message) {
            return { title, message, suggestions: [] };
        }

        const prompt = `You are a hackathon announcement expert. Review this announcement and provide suggestions for improvement.

Title: ${title}
Message: ${message}

Provide suggestions for:
1. Clarity and readability
2. Engagement and tone
3. Missing information
4. Structure improvements

Return ONLY a valid JSON object in this exact format:
{
  "suggestions": [
    "suggestion 1",
    "suggestion 2",
    ...
  ],
  "improvedTitle": "suggested improved title",
  "improvedMessage": "suggested improved message"
}

Do not include any explanation, only the JSON object.`;

        const completion = await openai.chat.completions.create({
            model: process.env.AI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that provides suggestions for hackathon announcements. Always return valid JSON only.",
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
        console.error("Error in announcement enhancement:", error);
        return { title, message, suggestions: [] };
    }
}

module.exports = {
    formatAnnouncement,
    enhanceAnnouncement,
};

