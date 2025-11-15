const cron = require("node-cron");
const Round = require("../models/Round");
const Hackathon = require("../models/Hackathon");
const { getAtRiskTeams, generateReminderMessage } = require("./smartReminderService");
const Message = require("../models/Message");
const Team = require("../models/Team");
const { emitMessage } = require("../socket");

/**
 * Update round active status based on dates
 * Deactivates rounds that have passed their end date
 * Activates rounds that have reached their start date
 */
async function updateRoundStatuses() {
    try {
        console.log("[Cron] Updating round statuses based on dates...");
        
        const now = new Date();
        
        // Find all rounds with dates
        const allRounds = await Round.find({
            $or: [
                { startDate: { $exists: true, $ne: null } },
                { endDate: { $exists: true, $ne: null } }
            ]
        });

        let deactivatedCount = 0;
        let activatedCount = 0;

        for (const round of allRounds) {
            let shouldUpdate = false;
            let newIsActive = round.isActive;

            // Deactivate rounds that have passed their end date
            if (round.endDate) {
                const endDate = new Date(round.endDate);
                // Set end of day for comparison
                endDate.setHours(23, 59, 59, 999);
                
                if (now > endDate && round.isActive) {
                    newIsActive = false;
                    shouldUpdate = true;
                    deactivatedCount++;
                    console.log(`[Cron] Deactivating round ${round.name} (end date: ${round.endDate})`);
                }
            }

            // Activate rounds that have reached their start date (if they were inactive)
            if (round.startDate && !round.isActive) {
                const startDate = new Date(round.startDate);
                // Set start of day for comparison
                startDate.setHours(0, 0, 0, 0);
                
                if (now >= startDate) {
                    // Only activate if end date hasn't passed
                    if (!round.endDate || new Date(round.endDate) >= now) {
                        newIsActive = true;
                        shouldUpdate = true;
                        activatedCount++;
                        console.log(`[Cron] Activating round ${round.name} (start date: ${round.startDate})`);
                    }
                }
            }

            if (shouldUpdate) {
                await Round.findByIdAndUpdate(round._id, { isActive: newIsActive });
            }
        }

        console.log(`[Cron] Round status update completed. Deactivated: ${deactivatedCount}, Activated: ${activatedCount}`);
    } catch (error) {
        console.error("[Cron] Error updating round statuses:", error);
    }
}

/**
 * Check all active rounds and send reminders to at-risk teams
 * This function runs at midnight daily
 */
async function checkActiveRoundsAndSendReminders() {
    try {
        console.log("[Cron] Starting midnight reminder check...");
        
        // First, update round statuses based on dates
        await updateRoundStatuses();
        
        if (process.env.AI_ENABLED === "false") {
            console.log("[Cron] AI is disabled, skipping reminder check");
            return;
        }

        const now = new Date();
        
        // Find all active rounds that have an end date
        const activeRounds = await Round.find({
            isActive: true,
            endDate: { $exists: true, $ne: null },
        }).populate("submissions");

        if (activeRounds.length === 0) {
            console.log("[Cron] No active rounds found");
            return;
        }

        console.log(`[Cron] Found ${activeRounds.length} active round(s)`);

        let totalRemindersSent = 0;

        for (const round of activeRounds) {
            try {
                // Check if round is still active (not past end date)
                const endDate = new Date(round.endDate);
                if (endDate < now) {
                    console.log(`[Cron] Round ${round.name} has passed end date, skipping`);
                    continue;
                }

                // Get hackathon for this round
                const hackathon = await Hackathon.findOne({ rounds: round._id });
                if (!hackathon) {
                    console.log(`[Cron] Hackathon not found for round ${round.name}, skipping`);
                    continue;
                }

                // Get at-risk teams for this round (threshold: 50)
                const atRiskTeams = await getAtRiskTeams(round._id.toString(), 50);

                if (atRiskTeams.length === 0) {
                    console.log(`[Cron] No at-risk teams found for round ${round.name}`);
                    continue;
                }

                console.log(`[Cron] Found ${atRiskTeams.length} at-risk team(s) for round ${round.name}`);

                // Send reminders to each at-risk team
                for (const item of atRiskTeams) {
                    try {
                        const team = await Team.findById(item.team._id)
                            .populate("organization", "_id");

                        if (!team || !team.organization) {
                            console.log(`[Cron] Team ${item.team._id} not found or missing organization, skipping`);
                            continue;
                        }

                        // Generate personalized reminder message
                        const reminderMessage = await generateReminderMessage(
                            item.team._id.toString(),
                            round._id.toString()
                        );

                        if (!reminderMessage) {
                            console.log(`[Cron] Failed to generate reminder for team ${item.team.name}`);
                            continue;
                        }

                        // Create and send message to team chat
                        const message = await Message.create({
                            team: item.team._id,
                            sender: null, // System message
                            content: `⏰ Reminder: ${reminderMessage}`,
                            organization: team.organization._id,
                            isAI: true,
                        });

                        // Emit real-time message
                        emitMessage(team.organization._id, item.team._id.toString(), {
                            eventType: "new_message",
                            message,
                        });

                        totalRemindersSent++;
                        console.log(`[Cron] Sent reminder to team ${item.team.name} (Risk: ${item.analysis?.riskScore}/100)`);
                    } catch (teamError) {
                        console.error(`[Cron] Error sending reminder to team ${item.team._id}:`, teamError);
                        // Continue with next team
                    }
                }
            } catch (roundError) {
                console.error(`[Cron] Error processing round ${round._id}:`, roundError);
                // Continue with next round
            }
        }

        console.log(`[Cron] Midnight reminder check completed. Sent ${totalRemindersSent} reminder(s)`);
    } catch (error) {
        console.error("[Cron] Error in midnight reminder check:", error);
    }
}

/**
 * Initialize cron jobs
 */
function initializeReminderCronJobs() {
    // Run at midnight (00:00) every day
    // Cron format: minute hour day month day-of-week
    // "0 0 * * *" = At 00:00 (midnight) every day
    cron.schedule("0 0 * * *", async () => {
        await checkActiveRoundsAndSendReminders();
    }, {
        scheduled: true,
        timezone: "UTC", // You can change this to your preferred timezone
    });

    console.log("[Cron] Midnight reminder cron job initialized (runs daily at 00:00 UTC)");
}

module.exports = {
    updateRoundStatuses,
    checkActiveRoundsAndSendReminders,
    initializeReminderCronJobs,
};

