import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { AuthContext } from "./AuthContext";
import { SettingsContext } from "./SettingsContext";
import { initializeSocket } from "../services/socket";
import {
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    getUnreadCount,
} from "../api/notifications";
import toast from "react-hot-toast";

export const NotificationContext = createContext();

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotifications must be used within a NotificationProvider");
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const { token, user } = useContext(AuthContext);
    const { notificationsEnabled } = useContext(SettingsContext);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    // Fetch notifications
    const fetchNotifications = useCallback(async (params = {}) => {
        if (!token) {
            console.log("No token available, skipping notification fetch");
            return;
        }

        try {
            setLoading(true);
            const data = await getNotifications(params, token);
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount || 0);
        } catch (error) {
            console.error("Error fetching notifications:", error);
            console.error("Error details:", error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    // Fetch unread count
    const fetchUnreadCount = useCallback(async () => {
        if (!token) return;

        try {
            const data = await getUnreadCount(token);
            setUnreadCount(data.unreadCount || 0);
        } catch (error) {
            console.error("Error fetching unread count:", error);
        }
    }, [token]);

    // Mark notification as read
    const markAsRead = useCallback(async (notificationId) => {
        if (!token) return;

        // Validate notification ID before making API call
        if (!notificationId || typeof notificationId !== 'string' || notificationId.length !== 24) {
            console.warn("Invalid notification ID, marking as read in local state only:", notificationId);
            setNotifications((prev) =>
                prev.map((n) =>
                    n._id === notificationId ? { ...n, read: true } : n
                )
            );
            return;
        }

        try {
            await markNotificationAsRead(notificationId, token);
            setNotifications((prev) =>
                prev.map((n) =>
                    n._id === notificationId ? { ...n, read: true } : n
                )
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (error) {
            console.error("Error marking notification as read:", error);
            // If notification not found, just update local state
            if (error.response?.status === 404 || error.response?.status === 400) {
                setNotifications((prev) =>
                    prev.map((n) =>
                        n._id === notificationId ? { ...n, read: true } : n
                    )
                );
                return;
            }
            toast.error("Failed to mark notification as read");
        }
    }, [token]);

    // Mark all as read
    const markAllAsRead = useCallback(async () => {
        if (!token) return;

        try {
            await markAllNotificationsAsRead(token);
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
            toast.success("All notifications marked as read");
        } catch (error) {
            console.error("Error marking all notifications as read:", error);
            toast.error("Failed to mark all notifications as read");
        }
    }, [token]);

    // Delete notification
    const removeNotification = useCallback(async (notificationId) => {
        if (!token) return;

        // Validate notification ID before making API call
        if (!notificationId || typeof notificationId !== 'string' || notificationId.length !== 24) {
            console.warn("Invalid notification ID, removing from local state only:", notificationId);
            setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
            return;
        }

        try {
            await deleteNotification(notificationId, token);
            const notification = notifications.find((n) => n._id === notificationId);
            setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
            if (notification && !notification.read) {
                setUnreadCount((prev) => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error("Error deleting notification:", error);
            // If notification not found (already deleted or doesn't exist), just remove from local state
            if (error.response?.status === 404 || error.response?.status === 400) {
                setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
                return;
            }
            toast.error("Failed to delete notification");
        }
    }, [token, notifications]);

    // Add new notification
    const addNotification = useCallback((notification) => {
        setNotifications((prev) => {
            // Only add if not already present (by _id)
            if (prev.some((n) => n._id === notification._id)) {
                return prev;
            }
            return [notification, ...prev];
        });
        if (!notification.read) {
            setUnreadCount((prev) => prev + 1);
        }
    }, []);

    // Initialize socket listener for notifications
    useEffect(() => {
        if (!token || !notificationsEnabled) return;

        const socket = initializeSocket(token);

        const handleNotification = (data) => {
            if (data.notification) {
                addNotification(data.notification);
                // Show browser notification if permission granted
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification(data.notification.title, {
                        body: data.notification.message,
                        icon: "/hackathon-portal.svg",
                    });
                }
            }
        };

        socket.on("notification", handleNotification);

        return () => {
            socket.off("notification", handleNotification);
        };
    }, [token, notificationsEnabled, addNotification]);

    // Request notification permission on mount
    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default" && notificationsEnabled) {
            Notification.requestPermission();
        }
    }, [notificationsEnabled]);

    // Fetch notifications on mount and when user changes
    useEffect(() => {
        if (token && user) {
            fetchNotifications().catch(err => {
                console.error("Failed to fetch notifications:", err);
            });
        }
    }, [token, user, fetchNotifications]);

    // Refresh unread count periodically
    useEffect(() => {
        if (!token) return;

        const interval = setInterval(() => {
            fetchUnreadCount();
        }, 30000); // Every 30 seconds

        return () => clearInterval(interval);
    }, [token, fetchUnreadCount]);

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                unreadCount,
                loading,
                fetchNotifications,
                markAsRead,
                markAllAsRead,
                removeNotification,
                refreshUnreadCount: fetchUnreadCount,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
};

