const mongoose = require("mongoose");

const DemoSessionSchema = new mongoose.Schema({
    hackathon: { type: mongoose.Schema.Types.ObjectId, ref: "Hackathon", required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    startTime: { type: Date },
    endTime: { type: Date },
    videoUrl: { type: String }, // For storing recorded video or stream link
    status: { type: String, enum: ["scheduled", "live", "completed", "ended"], default: "scheduled" },
    aiSummary: { type: String },
    aiHighlights: { type: String },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("DemoSession", DemoSessionSchema);