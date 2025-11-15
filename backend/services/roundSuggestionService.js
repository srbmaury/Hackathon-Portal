const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate intelligent round suggestions for a hackathon
 * @param {string} hackathonTitle - The hackathon title
 * @param {string} hackathonDescription - The hackathon description
 * @param {number} roundNumber - The round number (1, 2, 3, etc.)
 * @param {Array} existingRounds - Array of existing rounds to avoid duplicates
 * @param {Date} hackathonStartDate - Optional hackathon start date
 * @returns {Promise<Object>} Suggested round data
 */
async function suggestRound(hackathonTitle, hackathonDescription, roundNumber, existingRounds = [], hackathonStartDate = null) {
    try {
        // If AI is disabled, return default round
        if (process.env.AI_ENABLED === "false") {
            return getDefaultRound(roundNumber);
        }

        if (!hackathonTitle) {
            return getDefaultRound(roundNumber);
        }

        const existingRoundsInfo = existingRounds.length > 0 
            ? `Existing rounds: ${existingRounds.map(r => r.name || `Round ${r.roundNumber || ''}`).join(", ")}`
            : "This is the first round";

        const dateContext = hackathonStartDate 
            ? `The hackathon starts on ${new Date(hackathonStartDate).toLocaleDateString()}.`
            : "No specific start date provided.";

        // Calculate suggested dates (roundNumber days apart, starting from today or hackathon start)
        const baseDate = hackathonStartDate ? new Date(hackathonStartDate) : new Date();
        const suggestedStartDate = new Date(baseDate);
        suggestedStartDate.setDate(suggestedStartDate.getDate() + (roundNumber - 1) * 7); // 7 days apart
        
        const suggestedEndDate = new Date(suggestedStartDate);
        suggestedEndDate.setDate(suggestedEndDate.getDate() + 3); // 3 days duration

        const prompt = `You are an expert hackathon organizer. Generate a round suggestion for a hackathon.

Hackathon Title: ${hackathonTitle}
Hackathon Description: ${hackathonDescription || "No description provided"}
Round Number: ${roundNumber}
${existingRoundsInfo}
${dateContext}

Based on the hackathon theme and typical hackathon structure, suggest:
1. A meaningful round name (e.g., "Ideation Round", "Prototype Development", "Final Presentation")
2. A clear description of what participants need to do in this round
3. Whether scores should be hidden (typically true for early rounds, false for final)
4. Whether the round should be active by default

Consider:
- Round ${roundNumber} is typically ${roundNumber === 1 ? "the initial/ideation round" : roundNumber === 2 ? "the development/prototype round" : "a later stage round"}
- Round names should be clear and sequential
- Descriptions should be specific and actionable
- Early rounds often hide scores, final rounds show them

Return ONLY a valid JSON object in this exact format:
{
  "name": "Round Name (e.g., Ideation Round)",
  "description": "Clear description of what participants need to do",
  "hideScores": true or false,
  "isActive": true or false
}

Do not include any explanation, only the JSON object.`;

        const completion = await openai.chat.completions.create({
            model: process.env.AI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert hackathon organizer. Always return valid JSON only with round suggestion fields.",
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
        const suggestion = JSON.parse(responseContent);

        // Format dates as YYYY-MM-DD
        const formatDate = (date) => {
            const d = new Date(date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        return {
            name: suggestion.name || `Round ${roundNumber}`,
            description: suggestion.description || "",
            startDate: formatDate(suggestedStartDate),
            endDate: formatDate(suggestedEndDate),
            isActive: suggestion.isActive !== undefined ? suggestion.isActive : true,
            hideScores: suggestion.hideScores !== undefined ? suggestion.hideScores : (roundNumber === 1),
        };
    } catch (error) {
        console.error("Error in round suggestion:", error);
        // Return default round if AI fails
        return getDefaultRound(roundNumber);
    }
}

/**
 * Get default round structure when AI is unavailable
 */
function getDefaultRound(roundNumber) {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + (roundNumber - 1) * 7);
    
    const endDate = new Date(baseDate);
    endDate.setDate(endDate.getDate() + 3);

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const roundNames = {
        1: "Ideation Round",
        2: "Prototype Development",
        3: "Final Presentation",
    };

    const roundDescriptions = {
        1: "Submit your initial idea and problem statement",
        2: "Develop and submit your prototype or MVP",
        3: "Present your final solution and demo",
    };

    return {
        name: roundNames[roundNumber] || `Round ${roundNumber}`,
        description: roundDescriptions[roundNumber] || `Round ${roundNumber} description`,
        startDate: formatDate(baseDate),
        endDate: formatDate(endDate),
        isActive: true,
        hideScores: roundNumber === 1,
    };
}

/**
 * Suggest multiple rounds for a hackathon
 * @param {string} hackathonTitle - The hackathon title
 * @param {string} hackathonDescription - The hackathon description
 * @param {number} numberOfRounds - Number of rounds to suggest
 * @param {Date} hackathonStartDate - Optional hackathon start date
 * @returns {Promise<Array>} Array of suggested rounds
 */
async function suggestMultipleRounds(hackathonTitle, hackathonDescription, numberOfRounds = 3, hackathonStartDate = null) {
    try {
        const rounds = [];
        const existingRounds = [];

        for (let i = 1; i <= numberOfRounds; i++) {
            const round = await suggestRound(hackathonTitle, hackathonDescription, i, existingRounds, hackathonStartDate);
            rounds.push(round);
            existingRounds.push({ name: round.name, roundNumber: i });
        }

        return rounds;
    } catch (error) {
        console.error("Error suggesting multiple rounds:", error);
        // Return default rounds
        return Array.from({ length: numberOfRounds }, (_, i) => getDefaultRound(i + 1));
    }
}

module.exports = {
    suggestRound,
    suggestMultipleRounds,
};

