import API from "./apiConfig";

/**
 * Analyze risk for a specific team and round
 */
export const analyzeTeamRisk = async (teamId, roundId, token) => {
    const res = await API.get(`/reminders/team/${teamId}/round/${roundId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

/**
 * Get all teams at risk for a round
 */
export const getAtRiskTeams = async (roundId, threshold = 50, token) => {
    const res = await API.get(`/reminders/round/${roundId}/at-risk?threshold=${threshold}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

/**
 * Send reminder message to a team
 */
export const sendReminder = async (teamId, roundId, token) => {
    const res = await API.post(`/reminders/team/${teamId}/round/${roundId}/send`, {}, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

