const DemoSession = require("../models/DemoSession");
const Team = require("../models/Team");
const Hackathon = require("../models/Hackathon");
const User = require("../models/User");
const { summarizeDemo } = require("../services/demoStageAIService");

// Create or schedule a demo session
exports.createDemoSession = async (req, res) => {
    try {
        const { hackathon, team, startTime, endTime, videoUrl } = req.body;
        const session = await DemoSession.create({ hackathon, team, startTime, endTime, videoUrl });
        const populatedSession = await DemoSession.findById(session._id).populate("team");
        res.status(201).json(populatedSession);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Get all demo sessions for a hackathon
exports.getDemoSessions = async (req, res) => {
    try {
        const { hackathonId } = req.params;
        const sessions = await DemoSession.find({ hackathon: hackathonId })
            .populate("team")
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
        const { videoUrl, startTime, endTime } = req.body;

        const session = await DemoSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        if (videoUrl !== undefined) session.videoUrl = videoUrl;
        if (startTime !== undefined) session.startTime = startTime;
        if (endTime !== undefined) session.endTime = endTime;

        await session.save();

        const updatedSession = await DemoSession.findById(sessionId).populate("team");
        res.json(updatedSession);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Update session status (go live, complete, etc.)
exports.updateSessionStatus = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { status } = req.body;

        const session = await DemoSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        // If setting to live, set all other sessions in the same hackathon to scheduled
        if (status === "live") {
            await DemoSession.updateMany(
                { hackathon: session.hackathon, _id: { $ne: sessionId }, status: "live" },
                { status: "scheduled" }
            );
        }

        session.status = status;
        await session.save();

        res.json(session);
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

        console.log(`Video uploaded to Cloudinary for session ${sessionId}:`, {
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
