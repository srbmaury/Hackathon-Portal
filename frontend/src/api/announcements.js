import API from "./apiConfig";

// Fetch Announcements with pagination
export const getAnnouncements = async (token, page = 1, limit = 10) => {
    const res = await API.get("/announcements", {
        params: { page, limit },
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Create Announcement
export const createAnnouncement = async (announcement, token) => {
    const res = await API.post("/announcements", announcement, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Update Announcement
export const updateAnnouncement = async (id, updatedAnnouncement, token) => {
    const res = await API.put(`/announcements/${id}`, updatedAnnouncement, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Delete Announcement
export const deleteAnnouncement = async (id, token) => {
    const res = await API.delete(`/announcements/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// AI-powered announcement formatting
export const formatAnnouncement = async (hackathonId, title, message, token) => {
    const res = await API.post(`/hackathons/${hackathonId}/announcements/format`, 
        { title, message },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
};

// Get announcement enhancement suggestions
export const enhanceAnnouncement = async (hackathonId, title, message, token) => {
    const res = await API.post(`/hackathons/${hackathonId}/announcements/enhance`, 
        { title, message },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
};