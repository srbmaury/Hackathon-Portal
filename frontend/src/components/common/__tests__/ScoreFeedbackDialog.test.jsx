import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ScoreFeedbackDialog from "../ScoreFeedbackDialog";

describe("ScoreFeedbackDialog", () => {
    const mockOnSubmit = vi.fn();
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders dialog when open", () => {
        render(
            <ScoreFeedbackDialog
                open={true}
                onClose={mockOnClose}
                onSubmit={mockOnSubmit}
                allowScore={true}
                allowFeedback={true}
            />
        );

        // When both allowScore and allowFeedback are true, it shows "edit_score_feedback"
        expect(screen.getByText("submission.edit_score_feedback")).toBeInTheDocument();
    });

    it("does not render when closed", () => {
        render(
            <ScoreFeedbackDialog
                open={false}
                onClose={mockOnClose}
                onSubmit={mockOnSubmit}
                allowScore={true}
                allowFeedback={true}
            />
        );

        expect(screen.queryByText("submission.score_feedback")).not.toBeInTheDocument();
    });

    it("shows score field when allowScore is true", () => {
        render(
            <ScoreFeedbackDialog
                open={true}
                onClose={mockOnClose}
                onSubmit={mockOnSubmit}
                allowScore={true}
                allowFeedback={true}
            />
        );

        expect(screen.getByLabelText("submission.enter_score")).toBeInTheDocument();
    });

    it("hides score field when allowScore is false", () => {
        render(
            <ScoreFeedbackDialog
                open={true}
                onClose={mockOnClose}
                onSubmit={mockOnSubmit}
                allowScore={false}
                allowFeedback={true}
            />
        );

        expect(screen.queryByLabelText("submission.enter_score")).not.toBeInTheDocument();
    });

    it("shows feedback field when allowFeedback is true", () => {
        render(
            <ScoreFeedbackDialog
                open={true}
                onClose={mockOnClose}
                onSubmit={mockOnSubmit}
                allowScore={true}
                allowFeedback={true}
            />
        );

        expect(screen.getByLabelText("submission.enter_feedback")).toBeInTheDocument();
    });

    it("hides feedback field when allowFeedback is false", () => {
        render(
            <ScoreFeedbackDialog
                open={true}
                onClose={mockOnClose}
                onSubmit={mockOnSubmit}
                allowScore={true}
                allowFeedback={false}
            />
        );

        expect(screen.queryByLabelText("submission.enter_feedback")).not.toBeInTheDocument();
    });

    it("validates score range (0-100)", async () => {
        render(
            <ScoreFeedbackDialog
                open={true}
                onClose={mockOnClose}
                onSubmit={mockOnSubmit}
                allowScore={true}
                allowFeedback={true}
            />
        );

        const scoreInput = screen.getByLabelText("submission.enter_score");
        fireEvent.change(scoreInput, { target: { value: "150" } });

        const submitButton = screen.getByText("common.update");
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/submission.score_range/i)).toBeInTheDocument();
        });

        expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("calls onSubmit with score and feedback", async () => {
        render(
            <ScoreFeedbackDialog
                open={true}
                onClose={mockOnClose}
                onSubmit={mockOnSubmit}
                allowScore={true}
                allowFeedback={true}
            />
        );

        const scoreInput = screen.getByLabelText("submission.enter_score");
        fireEvent.change(scoreInput, { target: { value: "85" } });

        const feedbackInput = screen.getByLabelText("submission.enter_feedback");
        fireEvent.change(feedbackInput, { target: { value: "Great work!" } });

        const submitButton = screen.getByText("common.update");
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalledWith({
                score: 85,
                feedback: "Great work!",
            });
        });
    });

    it("calls onClose when cancel is clicked", () => {
        render(
            <ScoreFeedbackDialog
                open={true}
                onClose={mockOnClose}
                onSubmit={mockOnSubmit}
                allowScore={true}
                allowFeedback={true}
            />
        );

        const cancelButton = screen.getByText("common.cancel");
        fireEvent.click(cancelButton);

        expect(mockOnClose).toHaveBeenCalled();
    });

    it("pre-fills initial score and feedback", () => {
        render(
            <ScoreFeedbackDialog
                open={true}
                onClose={mockOnClose}
                onSubmit={mockOnSubmit}
                allowScore={true}
                allowFeedback={true}
                initialScore="75"
                initialFeedback="Initial feedback"
            />
        );

        expect(screen.getByLabelText("submission.enter_score")).toHaveValue(75);
        expect(screen.getByLabelText("submission.enter_feedback")).toHaveValue("Initial feedback");
    });
});

