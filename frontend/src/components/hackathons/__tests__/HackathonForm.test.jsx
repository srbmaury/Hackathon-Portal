import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n/i18n";
import { AuthContext } from "../../../context/AuthContext";
import HackathonForm from "../HackathonForm";

// Mock API functions
vi.mock("../../../api/hackathons", () => ({
    formatHackathonDescription: vi.fn(),
    suggestRound: vi.fn(),
}));

// Mock toast
vi.mock("react-hot-toast", () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

const renderWithI18n = (ui) => {
    const mockAuthContext = {
        token: "test-token",
        user: { name: "Test User", role: "admin" }
    };
    
    return render(
        <I18nextProvider i18n={i18n}>
            <AuthContext.Provider value={mockAuthContext}>
                {ui}
            </AuthContext.Provider>
        </I18nextProvider>
    );
};

describe("HackathonForm", () => {
    const mockOnSubmit = vi.fn();

    beforeEach(() => {
        mockOnSubmit.mockClear();
    });

    test("creates a hackathon with title, description, and a round", async () => {
        renderWithI18n(<HackathonForm onSubmit={mockOnSubmit} />);

        // Fill Hackathon Title - uses aria-label
        const titleInput = screen.getByLabelText("Hackathon Title");
        fireEvent.change(titleInput, {
            target: { value: "My Hackathon" },
        });

        // Fill Description (Markdown editor) - uses aria-label
        const descriptionTextarea = screen.getByLabelText("Hackathon Description");
        fireEvent.change(descriptionTextarea, {
            target: { value: "This is a test hackathon" },
        });

        // Wait a bit for state updates
        await new Promise(resolve => setTimeout(resolve, 100));

        // Add Round - button uses translation key
        const addRoundButton = screen.getByRole("button", {
            name: "hackathon.add_round",
        });
        fireEvent.click(addRoundButton);

        // Wait for round container to appear
        await waitFor(() => {
            expect(screen.getAllByTestId("round-container").length).toBeGreaterThan(0);
        });

        // Fill Round Name - uses translation key
        const roundContainer = screen.getAllByTestId("round-container")[0];
        const roundNameInput = within(roundContainer).getByLabelText("hackathon.round_name");
        fireEvent.change(roundNameInput, { target: { value: "Round 1" } });

        // Submit - button uses translation key
        const submitButton = screen.getByRole("button", { name: "hackathon.create" });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalled();
        });

        // Check the call arguments
        const callArgs = mockOnSubmit.mock.calls[0][0];
        expect(callArgs.title).toBe("My Hackathon");
        expect(callArgs.description).toBe("This is a test hackathon");
        expect(callArgs.rounds).toBeDefined();
        expect(callArgs.rounds.length).toBeGreaterThan(0);
        expect(callArgs.rounds[0].name).toBe("Round 1");
    });

    test("edits an existing hackathon correctly", async () => {
        const hackathon = {
            title: "Old Hackathon",
            description: "Old description",
            rounds: [{ name: "Old Round", description: "" }],
        };

        renderWithI18n(
            <HackathonForm initialData={hackathon} onSubmit={mockOnSubmit} />
        );

        // Wait for form to render with initial data
        await waitFor(() => {
            expect(screen.getByLabelText("Hackathon Title")).toBeInTheDocument();
        });

        // Update Hackathon Title - uses aria-label
        const titleInput = screen.getByLabelText("Hackathon Title");
        fireEvent.change(titleInput, {
            target: { value: "Updated Hackathon" },
        });

        // Update Description - uses aria-label
        const descriptionTextarea = screen.getByLabelText("Hackathon Description");
        fireEvent.change(descriptionTextarea, {
            target: { value: "Updated description" },
        });

        // Wait for state updates
        await new Promise(resolve => setTimeout(resolve, 100));

        // Update Round Name - uses translation key
        const roundContainer = screen.getAllByTestId("round-container")[0];
        const roundNameInput = within(roundContainer).getByLabelText("hackathon.round_name");
        fireEvent.change(roundNameInput, { target: { value: "Updated Round" } });

        // Submit - button uses translation key
        const submitButton = screen.getByRole("button", { name: "hackathon.update" });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalled();
        });

        // Check the call arguments
        const callArgs = mockOnSubmit.mock.calls[0][0];
        expect(callArgs.title).toBe("Updated Hackathon");
        expect(callArgs.description).toBe("Updated description");
        expect(callArgs.rounds).toBeDefined();
        expect(callArgs.rounds.length).toBeGreaterThan(0);
        expect(callArgs.rounds[0].name).toBe("Updated Round");
    });

    test("formats description with AI", async () => {
        const formatHackathonDescription = (await import("../../../api/hackathons")).formatHackathonDescription;
        formatHackathonDescription.mockResolvedValue({
            formattedDescription: "# AI-Formatted Description\n\nThis is formatted by AI."
        });

        renderWithI18n(<HackathonForm onSubmit={mockOnSubmit} />);

        // Fill title and description
        fireEvent.change(screen.getByLabelText("Hackathon Title"), {
            target: { value: "AI Hackathon" },
        });
        fireEvent.change(screen.getByLabelText("Hackathon Description"), {
            target: { value: "Basic description" },
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        // Click AI format button
        const formatButton = screen.getByRole("button", { name: "hackathon.format_with_ai" });
        fireEvent.click(formatButton);

        await waitFor(() => {
            expect(formatHackathonDescription).toHaveBeenCalledWith(
                "AI Hackathon",
                "Basic description",
                "test-token"
            );
        });
    });

    test("adds round with AI suggestion", async () => {
        const suggestRound = (await import("../../../api/hackathons")).suggestRound;
        suggestRound.mockResolvedValue({
            round: {
                name: "AI Suggested Round",
                description: "AI generated description",
                startDate: "2025-01-01",
                endDate: "2025-01-15",
                isActive: true,
                hideScores: false
            }
        });

        renderWithI18n(<HackathonForm onSubmit={mockOnSubmit} />);

        // Fill title
        fireEvent.change(screen.getByLabelText("Hackathon Title"), {
            target: { value: "AI Hackathon" },
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        // Click AI suggest round button
        const aiRoundButton = screen.getByRole("button", { name: "hackathon.add_round_with_ai" });
        fireEvent.click(aiRoundButton);

        await waitFor(() => {
            expect(suggestRound).toHaveBeenCalled();
        });

        // Verify round was added
        await waitFor(() => {
            const roundContainers = screen.getAllByTestId("round-container");
            expect(roundContainers.length).toBeGreaterThan(0);
        });
    });

    test("removes a round", async () => {
        renderWithI18n(<HackathonForm onSubmit={mockOnSubmit} />);

        // Add a round
        const addRoundButton = screen.getByRole("button", { name: "hackathon.add_round" });
        fireEvent.click(addRoundButton);

        await waitFor(() => {
            expect(screen.getAllByTestId("round-container").length).toBe(1);
        });

        // Remove the round
        const deleteButton = screen.getByTestId("DeleteIcon").closest("button");
        fireEvent.click(deleteButton);

        await waitFor(() => {
            expect(screen.queryAllByTestId("round-container").length).toBe(0);
        });
    });

    test("calls onCancel when cancel button is clicked", () => {
        const mockOnCancel = vi.fn();
        renderWithI18n(<HackathonForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

        const cancelButton = screen.getByRole("button", { name: "common.cancel" });
        fireEvent.click(cancelButton);

        expect(mockOnCancel).toHaveBeenCalled();
    });

    test("toggles isActive checkbox", async () => {
        renderWithI18n(<HackathonForm onSubmit={mockOnSubmit} />);

        // Fill required fields
        fireEvent.change(screen.getByLabelText("Hackathon Title"), {
            target: { value: "Test" },
        });
        fireEvent.change(screen.getByLabelText("Hackathon Description"), {
            target: { value: "Test desc" },
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        // Toggle active checkbox
        const activeCheckbox = screen.getByRole("checkbox");
        fireEvent.click(activeCheckbox);

        // Submit
        const submitButton = screen.getByRole("button", { name: "hackathon.create" });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalled();
        });

        const callArgs = mockOnSubmit.mock.calls[0][0];
        expect(callArgs.isActive).toBe(true);
    });
});
