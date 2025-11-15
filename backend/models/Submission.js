const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema(
    {
        team: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Team",
            required: true,
        },
        round: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Round",
            required: true,
        },
        hackathon: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hackathon",
            required: true,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        link: String, // Text field that can contain links
        file: String, // Cloudinary file URL
        score: { type: Number, default: 0 },
        feedback: String,
    },
    { timestamps: true }
);

// Ensure one submission per team per round
submissionSchema.index({ team: 1, round: 1 }, { unique: true });

module.exports = mongoose.models.Submission || mongoose.model("Submission", submissionSchema);
