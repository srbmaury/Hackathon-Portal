import API from "./apiConfig";

// Get all messages for a team
export const getTeamMessages = async (teamId, token) => {
    const res = await API.get(`/teams/${teamId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Send a message to a team
export const sendTeamMessage = async (teamId, content, token) => {
    const res = await API.post(
        `/teams/${teamId}/messages`,
        { content },
        {
            headers: { Authorization: `Bearer ${token}` },
        }
    );
    return res.data;
};

/**
 * Generate meeting summary from team chat
 */
export const generateMeetingSummary = async (teamId, token) => {
    const res = await API.post(
        `/teams/${teamId}/messages/summary`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
};

