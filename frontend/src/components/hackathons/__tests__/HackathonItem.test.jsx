import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n/i18n";
import HackathonItem from "../HackathonItem";
import { AuthContext } from "../../../context/AuthContext";

const renderWithContext = (ui, { user }) => {
    return render(
        <I18nextProvider i18n={i18n}>
            <AuthContext.Provider value={{ user }}>
                {ui}
            </AuthContext.Provider>
        </I18nextProvider>
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
});
