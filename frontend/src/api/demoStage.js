import API from "./apiConfig";

// Upload video for a demo session (axios version)
export const uploadDemoVideo = async ({ token, sessionId, blob }) => {
    const formData = new FormData();
    formData.append("video", blob, "recording.webm");
    formData.append("sessionId", sessionId);
    const res = await API.post("/demo-stage/upload-video", formData, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Edit a demo session
export const editDemoSession = async ({ token, sessionId, startTime, endTime, round }) => {
    return API.patch(`/demo-stage/sessions/${sessionId}`,
        { startTime, endTime, round },
        { headers: { Authorization: `Bearer ${token}` } }
    );
};

// AI: Generate schedule preview
export const aiGenerateSchedulePreview = async ({ token, hackathonId, roundId, prompt }) => {
    return API.post(
        "/demo-stage/sessions/ai-generate-preview",
        { hackathonId, roundId, prompt },
        { headers: { Authorization: `Bearer ${token}` } }
    );
};

// AI: Confirm schedule
export const aiConfirmSchedule = async ({ token, hackathonId, roundId, schedule }) => {
    return API.post(
        "/demo-stage/sessions/ai-generate-confirm",
        { hackathonId, roundId, schedule },
        { headers: { Authorization: `Bearer ${token}` } }
    );
};

// Fetch demo sessions
export const fetchDemoSessions = async ({ token, hackathonId }) => {
    return API.get(`/demo-stage/sessions/${hackathonId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
};

// Create a demo session
export const createDemoSession = async ({ token, payload }) => {
    return API.post("/demo-stage/sessions", payload, {
        headers: { Authorization: `Bearer ${token}` },
    });
};

// Edit video for a session
export const editDemoSessionVideo = async ({ token, sessionId, videoUrl, videoVisibility }) => {
    return API.patch(`/demo-stage/sessions/${sessionId}`,
        { videoUrl, videoVisibility },
        { headers: { Authorization: `Bearer ${token}` } }
    );
};

// Delete a demo session
export const deleteDemoSession = async ({ token, sessionId }) => {
    return API.delete(`/demo-stage/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
};

// Change session stage
export const changeDemoSessionStage = async ({ token, sessionId, stage }) => {
    return API.patch(`/demo-stage/sessions/${sessionId}`, { stage }, {
        headers: { Authorization: `Bearer ${token}` },
    });
};
