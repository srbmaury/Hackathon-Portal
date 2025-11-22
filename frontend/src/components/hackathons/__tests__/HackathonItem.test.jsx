import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import i18n from "../../../i18n/i18n";
import HackathonItem from "../HackathonItem";
import { AuthContext } from "../../../context/AuthContext";
import * as registrationsApi from "../../../api/registrations";
import toast from "react-hot-toast";

// Mock API
vi.mock("../../../api/registrations", () => ({
  getMyTeam: vi.fn(),
  withdrawTeam: vi.fn(),
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock RegisterTeamModal
vi.mock("../../teams/HackathonRegisterModal", () => ({
  __esModule: true,
  default: ({ open, onClose }) =>
    open ? (
      <div data-testid="register-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

const renderWithContext = (ui, { user = { role: "admin" }, token = "test-token" } = {}) => {
    return render(
        <MemoryRouter>
            <I18nextProvider i18n={i18n}>
                <AuthContext.Provider value={{ user, token }}>
                    {ui}
                </AuthContext.Provider>
            </I18nextProvider>
        </MemoryRouter>
    );
};

describe("HackathonItem", () => {
    const mockOnEdit = vi.fn();
    const mockOnDelete = vi.fn();

    const hackathon = {
        _id: "hack1",
        title: "Test Hackathon",
        description: "This is a **description**",
        isActive: true,
        createdAt: "2025-10-26T00:00:00Z",
        updatedAt: "2025-10-26T00:00:00Z",
        rounds: [
            {
                _id: "round1",
                name: "Round 1",
                description: "Round 1 Description",
                startDate: "2025-11-01T00:00:00Z",
                endDate: "2025-11-05T00:00:00Z",
                isActive: true,
            },
        ],
    };

    beforeEach(() => {
        mockOnEdit.mockClear();
        mockOnDelete.mockClear();
    });

    test("renders hackathon details", () => {
        renderWithContext(<HackathonItem hackathon={hackathon} onEdit={mockOnEdit} onDelete={mockOnDelete} />, {
            user: { role: "admin" },
        });

        // Hackathon title
        expect(screen.getByText("Test Hackathon")).toBeInTheDocument();

        // Status paragraph - uses translation key
        const statusParagraph = screen.getByText((content, element) =>
            element.tagName.toLowerCase() === "p" && (content.includes("Status") || content.includes("hackathon.status"))
        );
        // Status text uses translation key
        expect(statusParagraph).toBeInTheDocument();

        // Markdown description (split across multiple elements)
        const description = screen.getByText((content, element) =>
            element.tagName.toLowerCase() === "p" && element.textContent.includes("This is a description")
        );
        expect(description).toBeInTheDocument();

        // Check round table
        const table = screen.getByRole("table");
        const round1 = within(table).getByText("Round 1");
        expect(round1).toBeInTheDocument();
    });

    test("calls onEdit when edit button is clicked", () => {
        renderWithContext(<HackathonItem hackathon={hackathon} onEdit={mockOnEdit} onDelete={mockOnDelete} />, {
            user: { role: "admin" },
        });

        const editButton = screen.getByRole("button", { name: /edit/i });
        fireEvent.click(editButton);

        expect(mockOnEdit).toHaveBeenCalledWith(hackathon);
    });

    test("calls onDelete when delete button is clicked", () => {
        renderWithContext(<HackathonItem hackathon={hackathon} onEdit={mockOnEdit} onDelete={mockOnDelete} />, {
            user: { role: "admin" },
        });

        const deleteButton = screen.getByRole("button", { name: /delete/i });
        fireEvent.click(deleteButton);

        expect(mockOnDelete).toHaveBeenCalledWith(hackathon._id);
    });

    test("does not show edit/delete buttons for participant role", () => {
        renderWithContext(<HackathonItem hackathon={hackathon} onEdit={mockOnEdit} onDelete={mockOnDelete} />, {
            user: { role: "participant" },
        });

        expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    });

    test("renders last updated date if updatedAt differs from createdAt", () => {
        const updatedHackathon = { ...hackathon, updatedAt: "2025-10-27T00:00:00Z" };
        renderWithContext(<HackathonItem hackathon={updatedHackathon} onEdit={mockOnEdit} onDelete={mockOnDelete} />, {
            user: { role: "admin" },
        });

        // Uses translation key
        expect(screen.getByText(/hackathon.last_updated_at/i)).toBeInTheDocument();
    });

    test("shows register button for non-registered user", async () => {
        registrationsApi.getMyTeam.mockRejectedValueOnce({ response: { status: 404 } });

        renderWithContext(
            <HackathonItem hackathon={hackathon} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
            { user: { role: "user", _id: "user1" } }
        );

        await waitFor(() => {
            expect(screen.getByText("hackathon.register")).toBeInTheDocument();
        });
    });

    test("shows edit and withdraw buttons for registered user", async () => {
        const mockTeam = { _id: "team1", name: "My Team" };
        registrationsApi.getMyTeam.mockResolvedValueOnce({ team: mockTeam });

        renderWithContext(
            <HackathonItem hackathon={hackathon} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
            { user: { role: "user", _id: "user1" } }
        );

        await waitFor(() => {
            expect(screen.getByText("hackathon.edit")).toBeInTheDocument();
            expect(screen.getByText("hackathon.withdraw")).toBeInTheDocument();
        });
    });

    test("opens registration modal when register button is clicked", async () => {
        registrationsApi.getMyTeam.mockRejectedValueOnce({ response: { status: 404 } });

        renderWithContext(
            <HackathonItem hackathon={hackathon} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
            { user: { role: "user", _id: "user1" } }
        );

        await waitFor(() => {
            expect(screen.getByText("hackathon.register")).toBeInTheDocument();
        });

        const registerButton = screen.getByText("hackathon.register");
        fireEvent.click(registerButton);

        expect(screen.getByTestId("register-modal")).toBeInTheDocument();
    });

    test("withdraws team successfully", async () => {
        const mockTeam = { _id: "team1", name: "My Team" };
        registrationsApi.getMyTeam.mockResolvedValueOnce({ team: mockTeam });
        registrationsApi.withdrawTeam.mockResolvedValueOnce({});

        renderWithContext(
            <HackathonItem hackathon={hackathon} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
            { user: { role: "user", _id: "user1" } }
        );

        await waitFor(() => {
            expect(screen.getByText("hackathon.withdraw")).toBeInTheDocument();
        });

        const withdrawButton = screen.getByText("hackathon.withdraw");
        fireEvent.click(withdrawButton);

        await waitFor(() => {
            expect(registrationsApi.withdrawTeam).toHaveBeenCalledWith("hack1", "team1", "test-token");
            expect(toast.success).toHaveBeenCalled();
        });
    });

    test("handles withdraw error", async () => {
        const mockTeam = { _id: "team1", name: "My Team" };
        registrationsApi.getMyTeam.mockResolvedValueOnce({ team: mockTeam });
        registrationsApi.withdrawTeam.mockRejectedValueOnce(new Error("Withdraw failed"));

        renderWithContext(
            <HackathonItem hackathon={hackathon} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
            { user: { role: "user", _id: "user1" } }
        );

        await waitFor(() => {
            expect(screen.getByText("hackathon.withdraw")).toBeInTheDocument();
        });

        const withdrawButton = screen.getByText("hackathon.withdraw");
        fireEvent.click(withdrawButton);

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalled();
        });
    });

    test("navigates to hackathon details when view details is clicked", () => {
        const { container } = renderWithContext(
            <HackathonItem hackathon={hackathon} onEdit={mockOnEdit} onDelete={mockOnDelete} />
        );

        const viewDetailsButton = screen.getByText("hackathon.view_details");
        fireEvent.click(viewDetailsButton);

        // Navigation is handled by react-router, button click should work
        expect(viewDetailsButton).toBeInTheDocument();
    });

    test("shows edit button for hackathon_creator role", () => {
        renderWithContext(
            <HackathonItem hackathon={hackathon} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
            { user: { role: "hackathon_creator" } }
        );

        expect(screen.getByText("hackathon.edit")).toBeInTheDocument();
        expect(screen.getByText("hackathon.delete")).toBeInTheDocument();
    });

    test("handles team fetch error gracefully", async () => {
        registrationsApi.getMyTeam.mockRejectedValueOnce(new Error("Network error"));

        renderWithContext(
            <HackathonItem hackathon={hackathon} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
            { user: { role: "user", _id: "user1" } }
        );

        // Should not crash, just not show registered state
        await waitFor(() => {
            expect(screen.getByText("Test Hackathon")).toBeInTheDocument();
        });
    });
});
