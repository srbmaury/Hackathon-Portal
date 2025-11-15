const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        team: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Team",
            required: true,
            index: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false, // Can be null for AI messages
        },
        isAI: {
            type: Boolean,
            default: false,
        },
        content: {
            type: String,
            required: true,
            trim: true,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
    },
    { timestamps: true }
);

// Index for efficient querying of team messages
messageSchema.index({ team: 1, createdAt: -1 });

module.exports = mongoose.models.Message || mongoose.model("Message", messageSchema);

