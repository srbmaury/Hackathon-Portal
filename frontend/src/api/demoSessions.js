import API from "./apiConfig";

// Get all demo sessions for a hackathon (optionally filter by round)
export const getDemoSessions = async (hackathonId, roundId, token) => {
    const params = {};
    if (roundId) params.roundId = roundId;
    const res = await API.get(`/demo-stage/sessions/${hackathonId}`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Create a new demo session
export const createDemoSession = async (data, token) => {
    const res = await API.post("/demo-stage/sessions", data, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Update a demo session
export const updateDemoSession = async (sessionId, data, token) => {
    const res = await API.patch(`/demo-stage/sessions/${sessionId}`, data, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Upload video for a demo session
export const uploadDemoSessionVideo = async (formData, token) => {
    const res = await API.post("/demo-stage/upload-video", formData, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};
