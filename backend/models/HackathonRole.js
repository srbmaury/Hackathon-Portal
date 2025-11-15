const mongoose = require("mongoose");

const hackathonRoleSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        hackathon: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hackathon",
            required: true,
        },
        role: {
            type: String,
            enum: ["organizer", "judge", "mentor", "participant"],
            required: true,
        },
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

// Ensure a user can have only one role per hackathon
hackathonRoleSchema.index({ user: 1, hackathon: 1 }, { unique: true });

module.exports = mongoose.models.HackathonRole || mongoose.model("HackathonRole", hackathonRoleSchema);

