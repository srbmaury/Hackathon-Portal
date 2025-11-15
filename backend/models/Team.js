const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        idea: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Idea",
            required: true,
        },
        members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        leader: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            // leader is optional for backwards compatibility; registration will set it
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        hackathon: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hackathon",
            required: true,
        },
        mentor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            // Optional: mentor assigned to this team
        },
    },
    { timestamps: true }
);

teamSchema.index({ members: 1, hackathon: 1 }, { unique: true });

module.exports = mongoose.models.Team || mongoose.model("Team", teamSchema);
