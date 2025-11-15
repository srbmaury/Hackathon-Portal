import API from "./apiConfig";

export const getNotifications = async (params = {}, token) => {
    const { limit = 50, unreadOnly = false } = params;
    const response = await API.get("/notifications", {
        params: { limit, unreadOnly },
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const markNotificationAsRead = async (notificationId, token) => {
    const response = await API.patch(`/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const markAllNotificationsAsRead = async (token) => {
    const response = await API.patch("/notifications/read-all", {}, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const deleteNotification = async (notificationId, token) => {
    const response = await API.delete(`/notifications/${notificationId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const getUnreadCount = async (token) => {
    const response = await API.get("/notifications/unread-count", {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

