// Add role to user in hackathon
export const addHackathonRole = async (hackathonId, userId, role, token) => {
    const res = await API.post(`/hackathons/${hackathonId}/roles`,
        { userId, role },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
};
import API from "./apiConfig";

// Create Hackathon
export const createHackathon = async (hackathon, token) => {
    const res = await API.post("/hackathons", hackathon, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Get All Hackathons
export const getAllHackathons = async (token) => {
    const res = await API.get("/hackathons", {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Get Hackathon by ID
export const getHackathonById = async (id, token) => {
    const res = await API.get(`/hackathons/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Update Hackathon
export const updateHackathon = async (id, updatedHackathon, token) => {
    const res = await API.put(`/hackathons/${id}`, updatedHackathon, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Delete Hackathon
export const deleteHackathon = async (id, token) => {
    const res = await API.delete(`/hackathons/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// === Role Management ===

// Assign role to user in hackathon
export const assignHackathonRole = async (hackathonId, userId, role, token) => {
    const res = await API.post(`/hackathons/${hackathonId}/roles`,
        { userId, role },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
};

// Remove role from user in hackathon
export const removeHackathonRole = async (hackathonId, userId, token) => {
    const res = await API.delete(`/hackathons/${hackathonId}/roles/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Get all members of a hackathon
export const getHackathonMembers = async (hackathonId, token) => {
    const res = await API.get(`/hackathons/${hackathonId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Get current user's role in a hackathon
export const getMyHackathonRole = async (hackathonId, token) => {
    const res = await API.get(`/hackathons/${hackathonId}/my-role`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// === Hackathon-Specific Announcements ===

// Get announcements for a specific hackathon
export const getHackathonAnnouncements = async (hackathonId, token, page = 1, limit = 10) => {
    const res = await API.get(`/hackathons/${hackathonId}/announcements`, {
        params: { page, limit },
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Create announcement for a specific hackathon
export const createHackathonAnnouncement = async (hackathonId, announcement, token) => {
    const res = await API.post(`/hackathons/${hackathonId}/announcements`, announcement, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Update announcement
export const updateHackathonAnnouncement = async (hackathonId, announcementId, announcement, token) => {
    const res = await API.put(`/hackathons/${hackathonId}/announcements/${announcementId}`, announcement, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Delete announcement
export const deleteHackathonAnnouncement = async (hackathonId, announcementId, token) => {
    const res = await API.delete(`/hackathons/${hackathonId}/announcements/${announcementId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Assign teams to mentors using AI
export const assignMentorsToTeams = async (hackathonId, token) => {
    const res = await API.post(`/hackathons/${hackathonId}/assign-mentors`, {}, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Format hackathon description using AI
export const formatHackathonDescription = async (title, description, token) => {
    const res = await API.post(`/hackathons/format`,
        { title, description },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
};

// Suggest round structure using AI
export const suggestRound = async (title, description, roundNumber, existingRounds, hackathonStartDate, token) => {
    const res = await API.post(`/hackathons/suggest-round`,
        { title, description, roundNumber, existingRounds, hackathonStartDate },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
};

// Suggest multiple rounds using AI
export const suggestRounds = async (title, description, numberOfRounds, hackathonStartDate, token) => {
    const res = await API.post(`/hackathons/suggest-rounds`,
        { title, description, numberOfRounds, hackathonStartDate },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
};