import React, { useContext } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, it, beforeEach, expect, afterEach } from "vitest";
import { NotificationProvider, NotificationContext } from "../NotificationContext";
import { AuthContext } from "../AuthContext";
import { SettingsContext } from "../SettingsContext";
import * as notificationApi from "../../api/notifications";

// Mock API
vi.mock("../../api/notifications", () => ({
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markNotificationAsRead: vi.fn(),
    markAllNotificationsAsRead: vi.fn(),
    deleteNotification: vi.fn(),
}));

// Mock socket service
const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    connected: true,
};

vi.mock("../../services/socket", () => ({
    getSocket: vi.fn(() => mockSocket),
    initializeSocket: vi.fn(() => mockSocket),
}));

// Test component to consume context
const validId = "0123456789abcdef01234567";
const TestComponent = () => {
    const {
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        removeNotification,
        refreshUnreadCount,
    } = useContext(NotificationContext);

    return (
        <div>
            <span data-testid="loading">{loading ? "loading" : "not-loading"}</span>
            <span data-testid="unread-count">{unreadCount}</span>
            <span data-testid="notification-count">{notifications.length}</span>
            <button onClick={fetchNotifications}>Fetch</button>
            <button value={validId} onClick={() => markAsRead(validId)}>Mark Read</button>
            <button onClick={markAllAsRead}>Mark All Read</button>
            <button value={validId} onClick={() => removeNotification(validId)}>Remove</button>
            <button onClick={refreshUnreadCount}>Refresh Count</button>
        </div>
    );
};

describe("NotificationContext", () => {
    const mockToken = "test-token";
    const mockUser = { _id: "user1", name: "Test User" };
    const mockSettingsContext = {
        theme: "light",
        setTheme: vi.fn(),
        language: "en",
        setLanguage: vi.fn(),
        notificationsEnabled: true,
        setNotificationsEnabled: vi.fn(),
    };

    const renderWithProviders = () => {
        return render(
            <AuthContext.Provider value={{ user: mockUser, token: mockToken }}>
                <SettingsContext.Provider value={mockSettingsContext}>
                    <NotificationProvider>
                        <TestComponent />
                    </NotificationProvider>
                </SettingsContext.Provider>
            </AuthContext.Provider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockSocket.on.mockClear();
        mockSocket.off.mockClear();
        notificationApi.getNotifications.mockResolvedValue({ notifications: [], unreadCount: 0 });
        notificationApi.getUnreadCount.mockResolvedValue({ unreadCount: 0 });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("initializes with default values", async () => {
        renderWithProviders();

        // Wait for initial fetch to complete
        await waitFor(() => {
            expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
        }, { timeout: 3000 });

        expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
        expect(screen.getByTestId("notification-count")).toHaveTextContent("0");
    });

    it("fetches notifications successfully", async () => {
        const mockNotifications = [
            { _id: "notif1", message: "Test notification 1", read: false },
            { _id: "notif2", message: "Test notification 2", read: true },
        ];
        notificationApi.getNotifications.mockResolvedValue({ notifications: mockNotifications, unreadCount: 1 });

        renderWithProviders();

        const fetchBtn = screen.getByText("Fetch");

        fireEvent.click(fetchBtn);

        await waitFor(() => {
            expect(screen.getByTestId("notification-count")).toHaveTextContent("2");
        }, { timeout: 3000 });

        expect(notificationApi.getNotifications).toHaveBeenCalled();
    });

    it("handles fetch notifications error", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => { });
        notificationApi.getNotifications.mockRejectedValue(new Error("Fetch failed"));

        renderWithProviders();

        const fetchBtn = screen.getByText("Fetch");
        fireEvent.click(fetchBtn);

        await waitFor(() => {
            expect(consoleError).toHaveBeenCalled();
        }, { timeout: 3000 });

        consoleError.mockRestore();
    });

    it("refreshes unread count successfully", async () => {
        notificationApi.getUnreadCount.mockResolvedValue({ unreadCount: 5 });

        renderWithProviders();

        const refreshBtn = screen.getByText("Refresh Count");
        fireEvent.click(refreshBtn);

        await waitFor(() => {
            expect(screen.getByTestId("unread-count")).toHaveTextContent("5");
        }, { timeout: 3000 });

        expect(notificationApi.getUnreadCount).toHaveBeenCalledWith(mockToken);
    });

    it("marks notification as read", async () => {
        const validId = "0123456789abcdef01234567";
        const mockNotifications = [
            { _id: validId, message: "Test notification", read: false },
        ];
        notificationApi.getNotifications.mockResolvedValue({ notifications: mockNotifications, unreadCount: 1 });
        notificationApi.markNotificationAsRead.mockResolvedValue({ success: true });

        renderWithProviders();

        // First fetch notifications
        fireEvent.click(screen.getByText("Fetch"));

        await waitFor(() => {
            expect(screen.getByTestId("notification-count")).toHaveTextContent("1");
        }, { timeout: 3000 });

        // Then mark as read
        // Update the button to use the validId
        const markReadBtn = screen.getByText("Mark Read");
        markReadBtn.onclick = () => { };
        markReadBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        // Simulate click with validId
        fireEvent.click(markReadBtn, { target: { value: validId } });

        await waitFor(() => {
            expect(notificationApi.markNotificationAsRead).toHaveBeenCalledWith(validId, mockToken);
        }, { timeout: 3000 });
    });

    it("marks all notifications as read", async () => {
        notificationApi.markAllNotificationsAsRead.mockResolvedValue({ success: true });

        renderWithProviders();

        fireEvent.click(screen.getByText("Mark All Read"));

        await waitFor(() => {
            expect(notificationApi.markAllNotificationsAsRead).toHaveBeenCalledWith(mockToken);
        }, { timeout: 3000 });
    });

    it("removes notification", async () => {
        const validId = "0123456789abcdef01234567";
        const mockNotifications = [
            { _id: validId, message: "Test notification", read: false },
        ];
        notificationApi.getNotifications.mockResolvedValue({ notifications: mockNotifications, unreadCount: 1 });
        notificationApi.deleteNotification.mockResolvedValue({ success: true });

        renderWithProviders();

        // First fetch notifications
        fireEvent.click(screen.getByText("Fetch"));

        await waitFor(() => {
            expect(screen.getByTestId("notification-count")).toHaveTextContent("1");
        }, { timeout: 3000 });

        // Then remove
        // Update the button to use the validId
        const removeBtn = screen.getByText("Remove");
        removeBtn.onclick = () => { };
        removeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        // Simulate click with validId
        fireEvent.click(removeBtn, { target: { value: validId } });

        await waitFor(() => {
            expect(notificationApi.deleteNotification).toHaveBeenCalledWith(validId, mockToken);
        }, { timeout: 3000 });
    });

    it("sets up socket listeners on mount", () => {
        renderWithProviders();

        expect(mockSocket.on).toHaveBeenCalledWith("notification", expect.any(Function));
    });

    it("does not initialize if user is not logged in", () => {
        render(
            <AuthContext.Provider value={{ user: null, token: null }}>
                <SettingsContext.Provider value={mockSettingsContext}>
                    <NotificationProvider>
                        <TestComponent />
                    </NotificationProvider>
                </SettingsContext.Provider>
            </AuthContext.Provider>
        );

        // When no user/token, getNotifications should not be called automatically
        expect(notificationApi.getNotifications).not.toHaveBeenCalled();
    });
});

