import API from "./apiConfig";

// Fetch Users
export const getUsers = async (token) => {
    const res = await API.get("/users", {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.users || [];
};

// Alias for getAllUsers (for backward compatibility)
export const getAllUsers = getUsers;

// Update User Role
export const updateUserRole = async (userId, role, token) => {
    const res = await API.put(`/users/${userId}/role`, { role }, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
};

// Get all users with their hackathon roles (admin only)
export const getUsersWithHackathonRoles = async (token) => {
    const res = await API.get("/users/with-roles", {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.users || [];
};