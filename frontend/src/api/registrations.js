import API from "./apiConfig";

// Register for Hackathon (creates team)
export const registerForHackathon = async (hackathonId, registrationData, token) => {
    const res = await API.post(`/register/${hackathonId}/register`, registrationData, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Get current user's team for a hackathon
export const getMyTeam = async (hackathonId, token) => {
    const res = await API.get(`/register/${hackathonId}/my`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Withdraw (delete) a team registration
export const withdrawTeam = async (hackathonId, teamId, token) => {
    const res = await API.delete(`/register/${hackathonId}/teams/${teamId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Get all teams for current user
export const getMyTeams = async (token) => {
    const res = await API.get(`/register/my-teams`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Update a team registration
export const updateTeam = async (hackathonId, teamId, updateData, token) => {
    const res = await API.put(`/register/${hackathonId}/teams/${teamId}`, updateData, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Get all teams for a hackathon (public - all authenticated users can view)
export const getHackathonTeams = async (hackathonId, token) => {
    const res = await API.get(`/register/${hackathonId}/teams/public`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};