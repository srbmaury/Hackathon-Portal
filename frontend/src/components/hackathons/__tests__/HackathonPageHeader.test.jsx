import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n/i18n";
import HackathonPageHeader from "../HackathonPageHeader";
import { AuthContext } from "../../../context/AuthContext";
import { vi } from "vitest";

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
    return {
        ...actual,
        useNavigate: () => vi.fn(),
        useParams: () => ({ id: "test-hackathon-id" }),
    };
});

const mockSetConfirmDialog = vi.fn();
const mockSetInfoModal = vi.fn();
const mockSetMyTeam = vi.fn();
const mockLoadHackathonData = vi.fn();
const mockLoadMembers = vi.fn();
const mockLoadTeams = vi.fn();
const mockSetShowRegisterDialog = vi.fn();
const mockSetActiveTab = vi.fn();

const mockAuthValue = {
    token: "test-token",
    user: { role: "organizer", name: "Test User" },
};

const hackathon = {
    title: "Test Hackathon",
    isActive: true,
};

const defaultProps = {
    hackathon,
    myRole: "organizer",
    myTeam: { _id: "team1" },
    setConfirmDialog: mockSetConfirmDialog,
    setInfoModal: mockSetInfoModal,
    setMyTeam: mockSetMyTeam,
    loadHackathonData: mockLoadHackathonData,
    loadMembers: mockLoadMembers,
    loadTeams: mockLoadTeams,
    setShowRegisterDialog: mockSetShowRegisterDialog,
    activeTab: 0,
    setActiveTab: mockSetActiveTab,
};

const renderWithProviders = (ui, providerProps = {}) =>
    render(
        <AuthContext.Provider value={providerProps.auth || mockAuthValue}>
            <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
        </AuthContext.Provider>
    );

describe("HackathonPageHeader", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("renders hackathon title and role chip", () => {
        renderWithProviders(<HackathonPageHeader {...defaultProps} />);
        expect(screen.getByText("Test Hackathon")).toBeInTheDocument();
        expect(screen.getByText("roles.organizer")).toBeInTheDocument();
    });

    test("shows withdraw button when myTeam exists and hackathon is active", () => {
        renderWithProviders(<HackathonPageHeader {...defaultProps} />);
        expect(screen.getByText("hackathon.withdraw")).toBeInTheDocument();
    });

    test("shows register button when no team and no role", () => {
        renderWithProviders(<HackathonPageHeader {...defaultProps} myTeam={null} myRole={null} />);
        expect(screen.getByText("hackathon.register")).toBeInTheDocument();
    });

    test("calls setActiveTab when tab is changed", () => {
        renderWithProviders(<HackathonPageHeader {...defaultProps} />);
        const tabs = screen.getAllByRole("tab");
        fireEvent.click(tabs[1]);
        expect(mockSetActiveTab).toHaveBeenCalled();
    });

    test("shows all expected tabs", () => {
        renderWithProviders(<HackathonPageHeader {...defaultProps} />);
        expect(screen.getByText("hackathon.overview")).toBeInTheDocument();
        expect(screen.getByText("members.title")).toBeInTheDocument();
        expect(screen.getByText("announcement.announcements")).toBeInTheDocument();
        expect(screen.getByText("teams.title")).toBeInTheDocument();
        expect(screen.getByText("demo_stage.title")).toBeInTheDocument();
    });
});
