// Delete a demo session (organizer only)
const HackathonRole = require("../models/HackathonRole");
const DemoSession = require("../models/DemoSession");
const Team = require("../models/Team");
const Hackathon = require("../models/Hackathon");
const { summarizeDemo } = require("../services/demoStageAIService");

exports.deleteDemoSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const user = req.user;
        if (!user) {
            return res.status(403).json({ error: "Only organizers or admins can delete demo sessions" });
        }
        const session = await DemoSession.findById(sessionId);
        if (!session) return res.status(404).json({ error: "Session not found" });

        // Check if user is admin globally
        if (user.role === "admin") {
            await DemoSession.findByIdAndDelete(sessionId);
            return res.json({ message: "Demo session deleted", sessionId });
        }

        // Check if user is organizer for this hackathon
        const hackathonRole = await HackathonRole.findOne({
            user: user._id,
            hackathon: session.hackathon,
            role: "organizer"
        });
        if (!hackathonRole) {
            return res.status(403).json({ error: "Only organizers or admins can delete demo sessions" });
        }

        await DemoSession.findByIdAndDelete(sessionId);
        res.json({ message: "Demo session deleted", sessionId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Reschedule a demo session (organizer only)
exports.rescheduleDemoSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { startTime, endTime } = req.body;
        const user = req.user;
        if (!user || (user.role !== "organizer" && user.role !== "admin")) {
            return res.status(403).json({ error: "Only organizers or admins can reschedule demo sessions" });
        }
        const session = await DemoSession.findById(sessionId);
        if (!session) return res.status(404).json({ error: "Session not found" });
        if (startTime !== undefined) session.startTime = startTime;
        if (endTime !== undefined) session.endTime = endTime;
        await session.save();
        const updatedSession = await DemoSession.findById(sessionId).populate("team");
        res.json({ message: "Demo session rescheduled", session: updatedSession });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Step 1: Generate a schedule preview using AI (no DB write)
exports.generateDemoScheduleAI = async (req, res) => {
    try {
        const { hackathonId, roundId, prompt } = req.body;
        if (!hackathonId || !roundId || !prompt) return res.status(400).json({ error: "hackathonId, roundId, and prompt are required" });

        const hackathon = await Hackathon.findById(hackathonId);
        if (!hackathon) return res.status(404).json({ error: "Hackathon not found" });
        const round = await require("../models/Round").findById(roundId);
        if (!round) return res.status(404).json({ error: "Round not found" });
        const teams = await Team.find({ hackathon: hackathonId });
        if (!teams.length) return res.status(400).json({ error: "No teams found for this hackathon" });

        // Compose AI prompt for all teams in this round
        const teamList = teams.map(t => `- ${t.name}${t.projectTitle ? ` (${t.projectTitle})` : ""}`).join("\n");
        const aiPrompt = `${prompt}\n\nTeams:\n${teamList}\nRound: ${round.name}`;

        const openai = require("../config/openai").getOpenAI();
        if (!openai) return res.status(500).json({ error: "AI not available" });

        // Ask AI to generate a schedule in JSON array format
        const schedulePrompt = `
            You are an event scheduling assistant.
                
            Using this context: ${aiPrompt}
                
            Generate a JSON array of demo sessions following these rules:
            • Each team is scheduled exactly once.
            • Each demo has the user - specified duration.
            • All demos fit within the allowed time window and do not overlap.
            • Do not schedule during any specified breaks(e.g., lunch).
            • Use the date and timezone from the user prompt(default to UTC if missing).
            • Times must be ISO 8601(e.g., 2025 - 12 - 29T09:00:00Z).
            • Sort sessions by startTime.
            • If scheduling is impossible, return [].
                
            Return ONLY a JSON array of objects with fields:
                    teamName, startTime, endTime.
            No explanations or extra text.
            `;

        let schedule = [];
        try {
            const completion = await openai.chat.completions.create({
                model: process.env.AI_MODEL || "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are a helpful event assistant. Return only valid JSON. Return a JSON array, not an object." },
                    { role: "user", content: schedulePrompt },
                ],
                temperature: 0.5,
                response_format: { type: "json_object" },
            });
            let parsed = JSON.parse(completion.choices[0].message.content);
            // If AI returns { schedule: [...] } instead of [...], extract the array
            if (Array.isArray(parsed)) {
                schedule = parsed;
            } else if (parsed && Array.isArray(parsed.schedule)) {
                schedule = parsed.schedule;
            } else {
                // Try to find the first array in the object
                const arr = Object.values(parsed).find(v => Array.isArray(v));
                schedule = arr || [];
            }
        } catch (e) {
            return res.status(500).json({ error: "AI failed to generate schedule." });
        }

        // Attach team/round IDs for confirmation step
        const teamMap = Object.fromEntries(teams.map(t => [t.name, t._id.toString()]));
        const preview = Array.isArray(schedule) ? schedule.map(s => ({
            team: { name: s.teamName, _id: teamMap[s.teamName] || null },
            round: { name: round.name, _id: round._id },
            startTime: s.startTime,
            endTime: s.endTime,
        })) : [];
        res.json({ schedule: preview });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Step 2: Confirm and create demo sessions from schedule
exports.confirmDemoScheduleAI = async (req, res) => {
    try {
        const { hackathonId, roundId, schedule } = req.body;
        if (!hackathonId || !roundId || !Array.isArray(schedule)) return res.status(400).json({ error: "hackathonId, roundId, and schedule array are required" });

        const createdSessions = [];
        for (const s of schedule) {
            if (!s.team?._id || !s.round?._id || !s.startTime || !s.endTime) continue;
            // Check if session already exists
            const exists = await DemoSession.findOne({ hackathon: hackathonId, team: s.team._id, round: s.round._id });
            if (exists) continue;
            const session = await DemoSession.create({
                hackathon: hackathonId,
                team: s.team._id,
                round: s.round._id,
                startTime: s.startTime,
                endTime: s.endTime,
            });
            createdSessions.push(session);
        }
        res.json({ created: createdSessions.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Create or schedule a demo session
exports.createDemoSession = async (req, res) => {
    try {
        const { hackathon, team, round, startTime, endTime, videoUrl, stage, videoVisibility } = req.body;
        if (!round) return res.status(400).json({ error: "Round is required" });
        const session = await DemoSession.create({ hackathon, team, round, startTime, endTime, videoUrl, stage: stage || "scheduled", videoVisibility: videoVisibility || "draft" });
        const populatedSession = await DemoSession.findById(session._id).populate("team").populate("round");
        res.status(201).json(populatedSession);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Get all demo sessions for a hackathon (optionally filter by round)
exports.getDemoSessions = async (req, res) => {
    try {
        const { hackathonId } = req.params;
        const { roundId } = req.query;
        const filter = { hackathon: hackathonId };
        if (roundId) filter.round = roundId;
        const sessions = await DemoSession.find(filter)
            .populate("team")
            .populate("round")
            .sort({ startTime: 1 });
        res.json(sessions);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};


// Update session details (video URL, times, etc.)
exports.updateSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { videoUrl, startTime, endTime, stage, videoVisibility } = req.body;

        const session = await DemoSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        if (videoUrl !== undefined) session.videoUrl = videoUrl;
        if (startTime !== undefined) session.startTime = startTime;
        if (endTime !== undefined) session.endTime = endTime;
        if (stage !== undefined) session.stage = stage;
        if (videoVisibility !== undefined) session.videoVisibility = videoVisibility;

        await session.save();

        const updatedSession = await DemoSession.findById(sessionId).populate("team");
        res.json(updatedSession);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};


// Generate AI summary and highlights for a session
exports.generateDemoSummary = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await DemoSession.findById(sessionId).populate("team");
        if (!session) return res.status(404).json({ error: "Session not found" });
        const aiResult = await summarizeDemo(session);
        if (aiResult) {
            session.aiSummary = aiResult.summary;
            session.aiHighlights = aiResult.highlights;
            await session.save();
        }
        res.json({ summary: session.aiSummary, highlights: session.aiHighlights });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Upload video for a demo session (uses Cloudinary)
exports.uploadSessionVideo = async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: "No video file uploaded" });
        }

        if (!sessionId) {
            return res.status(400).json({ error: "Session ID is required" });
        }

        const session = await DemoSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        // The file URL is available from Cloudinary upload (set by middleware)
        const cloudinaryUrl = req.file.path;

        console.log(`Video uploaded to Cloudinary for session ${sessionId}: `, {
            url: cloudinaryUrl,
            publicId: req.file.filename,
            format: req.file.cloudinary?.format,
            duration: req.file.cloudinary?.duration,
            bytes: req.file.cloudinary?.bytes,
        });

        session.videoUrl = cloudinaryUrl;
        await session.save();

        const updatedSession = await DemoSession.findById(sessionId).populate("team");
        res.json({
            message: "Video uploaded successfully to Cloudinary",
            videoUrl: cloudinaryUrl,
            publicId: req.file.filename,
            session: updatedSession
        });
    } catch (err) {
        console.error("Error uploading video:", err);
        res.status(500).json({ error: err.message });
    }
};
