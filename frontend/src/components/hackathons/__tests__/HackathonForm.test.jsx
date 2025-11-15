import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n/i18n";
import HackathonForm from "../HackathonForm";

const renderWithI18n = (ui) =>
    render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

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
});
