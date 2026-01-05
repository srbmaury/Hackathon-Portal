const mongoose = require("mongoose");

const DemoSessionSchema = new mongoose.Schema({
    hackathon: { type: mongoose.Schema.Types.ObjectId, ref: "Hackathon", required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    round: { type: mongoose.Schema.Types.ObjectId, ref: "Round", required: true },
    startTime: { type: Date },
    endTime: { type: Date },
    videoUrl: { type: String }, // For storing recorded video or stream link
    videoVisibility: { type: String, enum: ["draft", "public"], default: "draft" }, // Video visibility state
    aiSummary: { type: String },
    aiHighlights: { type: String },
    stage: { type: String, enum: ["scheduled", "live", "completed"], default: "scheduled" },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("DemoSession", DemoSessionSchema);