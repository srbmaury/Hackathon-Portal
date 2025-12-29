// config/openai.js
const { OpenAI } = require("openai");

function getOpenAI() {
    if (!process.env.OPENAI_API_KEY) return null;
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

module.exports = { getOpenAI };
