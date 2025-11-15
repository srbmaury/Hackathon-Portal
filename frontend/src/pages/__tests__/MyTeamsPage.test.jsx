import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n/i18n";
import toast from "react-hot-toast";
import MyTeamsPage from "../../pages/MyTeamsPage";
import { AuthContext } from "../../context/AuthContext";
import { getMyTeams, withdrawTeam } from "../../api/registrations";

// --- Mock API modules ---
vi.mock("../../api/registrations", () => ({
    getMyTeams: vi.fn(),
    withdrawTeam: vi.fn(),
}));

// --- Properly mock react-hot-toast ---
vi.mock("react-hot-toast", () => ({
    __esModule: true,
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
    success: vi.fn(),
    error: vi.fn(),
}));

// --- Mock DashboardLayout wrapper ---
vi.mock("../../components/dashboard/DashboardLayout", () => ({
    default: ({ children }) => (
        <div data-testid="dashboard-layout">{children}</div>
    ),
}));

// --- Mock HackathonRegisterModal behavior ---
vi.mock("../../components/teams/HackathonRegisterModal", () => ({
    default: ({ open, onClose }) =>
        open ? (
            <div data-testid="hackathon-modal">
                <button onClick={onClose}>Close Modal</button>
            </div>
        ) : null,
}));

describe("MyTeamsPage", () => {
    const mockToken = "test-token";
    const mockTeams = [
        {
            _id: "team1",
            name: "Team Alpha",
            hackathon: { _id: "hack1", title: "AI Challenge" },
            idea: { title: "Smart Vision" },
            members: [{ name: "Alice" }, { name: "Bob" }],
        },
    ];

    const renderWithContext = () =>
        render(
            <I18nextProvider i18n={i18n}>
                <AuthContext.Provider value={{ token: mockToken }}>
                    <MyTeamsPage />
                </AuthContext.Provider>
            </I18nextProvider>
        );

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("renders My Teams title and layout", async () => {
        getMyTeams.mockResolvedValueOnce({ teams: [] });
        renderWithContext();

        await waitFor(() => {
            expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();
            // The page uses translation key "teams.my_teams"
            expect(screen.getByText("teams.my_teams")).toBeInTheDocument();
        });
    });

    test("fetches and displays team data", async () => {
        getMyTeams.mockResolvedValueOnce({ teams: mockTeams });

        renderWithContext();

        await waitFor(() => {
            expect(screen.getByText("AI Challenge")).toBeInTheDocument();
            expect(screen.getByText("Team Alpha")).toBeInTheDocument();
            expect(screen.getByText("Smart Vision")).toBeInTheDocument();
            expect(screen.getByText("Alice, Bob")).toBeInTheDocument();
        });
    });

    test("shows toast error on fetch failure", async () => {
        getMyTeams.mockRejectedValueOnce(new Error("Network error"));
        renderWithContext();

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                expect.stringMatching(/fetch/i)
            );
        });
    });

    test("opens and closes edit modal", async () => {
        getMyTeams.mockResolvedValueOnce({ teams: mockTeams });
        renderWithContext();

        // Open modal
        await waitFor(() => {
            fireEvent.click(screen.getByRole("button", { name: /edit/i }));
        });

        expect(screen.getByTestId("hackathon-modal")).toBeInTheDocument();

        // Close modal
        fireEvent.click(screen.getByText("Close Modal"));

        await waitFor(() => {
            expect(screen.queryByTestId("hackathon-modal")).not.toBeInTheDocument();
        });
    });

    test("handles successful withdraw", async () => {
        getMyTeams.mockResolvedValueOnce({ teams: mockTeams });
        withdrawTeam.mockResolvedValueOnce({});

        renderWithContext();

        // Wait for teams to load
        await waitFor(() => {
            expect(screen.getByText("AI Challenge")).toBeInTheDocument();
        });

        // Find and click withdraw button
        const withdrawButtons = screen.getAllByRole("button", { name: /withdraw/i });
        if (withdrawButtons.length > 0) {
            fireEvent.click(withdrawButtons[0]);
        }

        await waitFor(() => {
            expect(withdrawTeam).toHaveBeenCalledWith("hack1", "team1", mockToken);
            // The success message uses translation key
            expect(toast.success).toHaveBeenCalled();
        });
    });

    test("handles withdraw error", async () => {
        getMyTeams.mockResolvedValueOnce({ teams: mockTeams });
        withdrawTeam.mockRejectedValueOnce(new Error("Withdraw failed"));

        renderWithContext();

        await waitFor(() => {
            fireEvent.click(screen.getByRole("button", { name: /Withdraw/i }));
        });

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                expect.stringMatching(/Withdraw/i)
            );
        });
    });
});
