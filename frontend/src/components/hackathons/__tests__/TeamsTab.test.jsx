import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TeamsTab from "../TeamsTab";
import { vi } from "vitest";
import { AuthProvider } from "../../../context/AuthContext";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock i18n translation and preserve initReactI18next
vi.mock("react-i18next", async () => {
    const actual = await vi.importActual("react-i18next");
    return {
        ...actual,
        useTranslation: () => ({ t: (key) => key })
    };
});

// Provide user and token via AuthProvider
const mockUser = { _id: "u1", name: "User 1", role: "participant" };
const mockToken = "mock-token";

function renderTab(props = {}) {
    return render(
        <AuthProvider>
            <TeamsTab {...props} />
        </AuthProvider>
    );
}

describe("TeamsTab", () => {
    beforeEach(() => {
        // Set up localStorage for AuthProvider
        localStorage.setItem("user", JSON.stringify(mockUser));
        localStorage.setItem("token", mockToken);
        vi.clearAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
    });

    const baseTeam = {
        _id: "t1",
        name: "Team Alpha",
        idea: { title: "Great Idea" },
        members: [
            { _id: "u1", name: "User 1" },
            { _id: "u2", name: "User 2" }
        ],
        leader: "u1",
        mentor: { _id: "m1", name: "Mentor 1" }
    };

    it("renders loading state", () => {
        renderTab({ teams: [], teamsLoading: true, myTeam: null, myRole: "participant" });
        expect(screen.getByText("hackathon_details.loading_teams")).toBeInTheDocument();
    });

    it("renders no teams alert", () => {
        renderTab({ teams: [], teamsLoading: false, myTeam: null, myRole: "participant" });
        expect(screen.getByText("hackathon_details.no_teams_registered")).toBeInTheDocument();
    });

    it("renders team info and members", () => {
        renderTab({ teams: [baseTeam], teamsLoading: false, myTeam: null, myRole: "participant" });
        expect(screen.getByText("Team Alpha")).toBeInTheDocument();
        expect(screen.getByText("Great Idea")).toBeInTheDocument();
        // Use flexible matcher for User 1 (leader)
        expect(screen.getByText((content) => content.includes("User 1") && content.includes("leader"))).toBeInTheDocument();
        expect(screen.getByText("User 2")).toBeInTheDocument();
        expect(screen.getByText("Mentor 1")).toBeInTheDocument();
    });

    it("shows chat button for my team", () => {
        renderTab({ teams: [baseTeam], teamsLoading: false, myTeam: baseTeam, myRole: "participant" });
        expect(screen.getByText("chat.open_chat")).toBeInTheDocument();
    });

    it("shows chat button for organizer", () => {
        renderTab({ teams: [baseTeam], teamsLoading: false, myTeam: null, myRole: "organizer" });
        expect(screen.getByText("chat.open_chat")).toBeInTheDocument();
    });

    it("navigates to chat on button click", () => {
        renderTab({ teams: [baseTeam], teamsLoading: false, myTeam: baseTeam, myRole: "participant" });
        fireEvent.click(screen.getByText("chat.open_chat"));
        expect(mockNavigate).toHaveBeenCalledWith("/teams/t1/chat");
    });
});
