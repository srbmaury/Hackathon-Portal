const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const DemoSession = require("../models/DemoSession");
const auth = require("../middleware/auth");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../uploads/"));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + "-" + file.originalname);
    },
});
const upload = multer({ storage });

// ...existing demo stage routes...

// Video upload endpoint
router.post("/upload-video", auth, upload.single("video"), async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        // Save file path to DemoSession
        await DemoSession.findByIdAndUpdate(sessionId, { videoUrl: `/uploads/${req.file.filename}` });
        res.json({ success: true, file: req.file, url: `/uploads/${req.file.filename}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
