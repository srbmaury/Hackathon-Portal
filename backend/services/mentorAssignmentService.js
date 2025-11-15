const OpenAI = require("openai");
const Team = require("../models/Team");
const HackathonRole = require("../models/HackathonRole");
const User = require("../models/User");
const Idea = require("../models/Idea");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Assign teams to mentors using OpenAI to intelligently distribute teams
 * @param {string} hackathonId - The hackathon ID
 * @returns {Promise<Object>} Assignment results
 */
async function assignTeamsToMentors(hackathonId) {
    try {
        // Get all teams for the hackathon
        const teams = await Team.find({ hackathon: hackathonId })
            .populate("members", "name email")
            .populate("idea", "title description")
            .populate("leader", "name email");

        if (teams.length === 0) {
            throw new Error("No teams found for this hackathon");
        }

        // Get all mentors for the hackathon
        const mentorRoles = await HackathonRole.find({
            hackathon: hackathonId,
            role: "mentor",
        }).populate("user", "name email");

        if (mentorRoles.length === 0) {
            throw new Error("No mentors found for this hackathon");
        }

        const mentors = mentorRoles.map((mr) => mr.user);

        // Prepare data for OpenAI
        const teamsData = teams.map((team) => ({
            id: team._id.toString(),
            name: team.name,
            members: team.members.map((m) => ({ name: m.name, email: m.email })),
            leader: team.leader ? { name: team.leader.name, email: team.leader.email } : null,
            idea: team.idea ? { title: team.idea.title, description: team.idea.description } : null,
        }));

        const mentorsData = mentors.map((mentor) => ({
            id: mentor._id.toString(),
            name: mentor.name,
            email: mentor.email,
        }));

        // Create prompt for OpenAI
        const prompt = `You are a hackathon organizer. Your task is to assign ${teamsData.length} teams to ${mentorsData.length} mentors as evenly as possible.

Teams:
${JSON.stringify(teamsData, null, 2)}

Mentors:
${JSON.stringify(mentorsData, null, 2)}

Please assign teams to mentors ensuring:
1. Each mentor gets approximately the same number of teams (within 1 team difference)
2. Distribute teams as evenly as possible
3. Return ONLY a valid JSON object in this exact format:
{
  "assignments": [
    { "teamId": "team_id_1", "mentorId": "mentor_id_1" },
    { "teamId": "team_id_2", "mentorId": "mentor_id_2" },
    ...
  ]
}

Do not include any explanation, only the JSON object.`;

        // Call OpenAI API
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that assigns teams to mentors in a hackathon. Always return valid JSON only.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.3,
            response_format: { type: "json_object" },
        });

        // Parse OpenAI response
        const responseContent = completion.choices[0].message.content;
        let assignments;
        try {
            assignments = JSON.parse(responseContent);
        } catch (error) {
            // Fallback: simple round-robin assignment if OpenAI fails
            return await fallbackAssignment(teams, mentors);
        }

        // Validate and apply assignments
        const assignmentResults = [];
        const mentorTeamCounts = {};

        // Initialize counts
        mentors.forEach((mentor) => {
            mentorTeamCounts[mentor._id.toString()] = 0;
        });

        // Apply assignments
        for (const assignment of assignments.assignments || []) {
            const team = teams.find((t) => t._id.toString() === assignment.teamId);
            const mentor = mentors.find((m) => m._id.toString() === assignment.mentorId);

            if (team && mentor) {
                team.mentor = mentor._id;
                await team.save();
                mentorTeamCounts[mentor._id.toString()]++;
                assignmentResults.push({
                    teamId: team._id,
                    teamName: team.name,
                    mentorId: mentor._id,
                    mentorName: mentor.name,
                });
            }
        }

        // Ensure all teams are assigned (fallback for any missed teams)
        const unassignedTeams = teams.filter((team) => !team.mentor);
        if (unassignedTeams.length > 0) {
            const fallbackResults = await assignRemainingTeams(unassignedTeams, mentors, mentorTeamCounts);
            assignmentResults.push(...fallbackResults);
        }

        return {
            success: true,
            totalTeams: teams.length,
            totalMentors: mentors.length,
            assignments: assignmentResults,
            mentorDistribution: Object.entries(mentorTeamCounts).map(([mentorId, count]) => {
                const mentor = mentors.find((m) => m._id.toString() === mentorId);
                return {
                    mentorId,
                    mentorName: mentor?.name || "Unknown",
                    teamCount: count,
                };
            }),
        };
    } catch (error) {
        console.error("Error in mentor assignment:", error);
        throw error;
    }
}

/**
 * Fallback assignment using round-robin if OpenAI fails
 */
async function fallbackAssignment(teams, mentors) {
    const assignments = [];
    const mentorTeamCounts = {};

    mentors.forEach((mentor) => {
        mentorTeamCounts[mentor._id.toString()] = 0;
    });

    // Round-robin assignment
    teams.forEach((team, index) => {
        const mentorIndex = index % mentors.length;
        const mentor = mentors[mentorIndex];
        team.mentor = mentor._id;
        team.save();
        mentorTeamCounts[mentor._id.toString()]++;
        assignments.push({
            teamId: team._id,
            teamName: team.name,
            mentorId: mentor._id,
            mentorName: mentor.name,
        });
    });

    return {
        success: true,
        totalTeams: teams.length,
        totalMentors: mentors.length,
        assignments,
        mentorDistribution: Object.entries(mentorTeamCounts).map(([mentorId, count]) => {
            const mentor = mentors.find((m) => m._id.toString() === mentorId);
            return {
                mentorId,
                mentorName: mentor?.name || "Unknown",
                teamCount: count,
            };
        }),
    };
}

/**
 * Assign remaining teams that weren't assigned by OpenAI
 */
async function assignRemainingTeams(unassignedTeams, mentors, mentorTeamCounts) {
    const assignments = [];
    
    // Sort mentors by current team count (ascending) to balance distribution
    const sortedMentors = [...mentors].sort((a, b) => {
        const countA = mentorTeamCounts[a._id.toString()] || 0;
        const countB = mentorTeamCounts[b._id.toString()] || 0;
        return countA - countB;
    });

    unassignedTeams.forEach((team, index) => {
        const mentorIndex = index % sortedMentors.length;
        const mentor = sortedMentors[mentorIndex];
        team.mentor = mentor._id;
        team.save();
        mentorTeamCounts[mentor._id.toString()]++;
        assignments.push({
            teamId: team._id,
            teamName: team.name,
            mentorId: mentor._id,
            mentorName: mentor.name,
        });
    });

    return assignments;
}

module.exports = {
    assignTeamsToMentors,
};

