import API from "./apiConfig";

// Submit for a round
export const submitForRound = async (roundId, submissionData, token) => {
    const headers = { Authorization: `Bearer ${token}` };
    // Don't set Content-Type for FormData - browser will set it with boundary
    if (!(submissionData instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }
    const res = await API.post(`/submissions/${roundId}`, submissionData, { headers });
    return res.data;
};

// Get my submission for a round
export const getMySubmission = async (roundId, token) => {
    const res = await API.get(`/submissions/${roundId}/my`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Get all submissions for a round (organizer/admin only)
export const getAllSubmissions = async (roundId, token) => {
    const res = await API.get(`/submissions/${roundId}/all`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Get standings for a round
export const getStandings = async (roundId, token) => {
    const res = await API.get(`/submissions/${roundId}/standings`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Update submission (organizer/admin only)
export const updateSubmission = async (submissionId, updateData, token) => {
    const res = await API.put(`/submissions/${submissionId}`, updateData, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// AI-powered submission evaluation
export const evaluateSubmission = async (submissionId, token) => {
    const res = await API.post(`/submissions/${submissionId}/evaluate`, {}, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Generate AI feedback for submission
export const generateSubmissionFeedback = async (submissionId, score, token) => {
    const res = await API.post(`/submissions/${submissionId}/generate-feedback`, 
        { score },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
};

// Compare submissions in a round
export const compareSubmissions = async (roundId, token) => {
    const res = await API.get(`/submissions/${roundId}/compare`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

