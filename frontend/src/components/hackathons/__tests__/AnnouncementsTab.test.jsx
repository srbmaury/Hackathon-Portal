import React from "react";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n/i18n";
import AnnouncementsTab from "../AnnouncementsTab";
import { AuthContext } from "../../../context/AuthContext";
import { vi } from "vitest";

// Mock useParams to always return a valid id
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
    return {
        ...actual,
        useParams: () => ({ id: "test-hackathon-id" }),
    };
});

// Mock AnnouncementList API to return announcements
vi.mock("../../../api/hackathons", () => ({
    getHackathonAnnouncements: vi.fn(() => Promise.resolve({
        announcements: [
            { _id: "1", title: "Announcement 1", message: "Message 1" },
            { _id: "2", title: "Announcement 2", message: "Message 2" },
        ],
        totalPages: 1,
        total: 2,
    })),
}));

const mockAuthValue = {
    token: "test-token",
    user: { role: "organizer", name: "Test User" },
};

const defaultProps = {
    myRole: "organizer",
    loadAnnouncements: vi.fn(),
    announcementsLoading: false,
    announcements: [], // Always pass an array
};

const renderWithProviders = (ui, providerProps = {}) =>
    render(
        <AuthContext.Provider value={providerProps.auth || mockAuthValue}>
            <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
        </AuthContext.Provider>
    );

describe("AnnouncementsTab", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("shows loading state when announcementsLoading is true", () => {
        renderWithProviders(<AnnouncementsTab {...defaultProps} announcementsLoading={true} announcements={[]} />);
        expect(screen.getByText("common.loading")).toBeInTheDocument();
    });

    test("shows info alert when no announcements", () => {
        renderWithProviders(<AnnouncementsTab {...defaultProps} announcements={[]} />);
        expect(screen.getByText("announcement.no_announcements")).toBeInTheDocument();
    });

    test("renders announcements list when announcements exist", async () => {
        renderWithProviders(<AnnouncementsTab {...defaultProps} announcements={[{ _id: "1" }]} />);
        expect(screen.getByText("announcement.announcements")).toBeInTheDocument();
        // Flexible matcher for Announcement 1 and 2
        expect(await screen.findByText((content) => content.includes("Announcement 1"))).toBeInTheDocument();
        expect(await screen.findByText((content) => content.includes("Announcement 2"))).toBeInTheDocument();
    });

    test("shows create button for organizer", () => {
        renderWithProviders(<AnnouncementsTab {...defaultProps} myRole="organizer" announcements={[]} />);
        expect(screen.getByText("announcement.create_announcement")).toBeInTheDocument();
    });

    test("does not show create button for participant", () => {
        renderWithProviders(<AnnouncementsTab {...defaultProps} myRole="participant" announcements={[]} />);
        expect(screen.queryByText("announcement.create_announcement")).not.toBeInTheDocument();
    });
});
