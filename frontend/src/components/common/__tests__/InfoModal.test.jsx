import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import InfoModal from "../InfoModal";

describe("InfoModal", () => {
    it("renders info modal with default type", () => {
        render(
            <InfoModal
                open={true}
                onClose={vi.fn()}
                message="Test message"
            />
        );

        expect(screen.getByText("common.info")).toBeInTheDocument();
        expect(screen.getByText("Test message")).toBeInTheDocument();
    });

    it("renders success modal", () => {
        render(
            <InfoModal
                open={true}
                onClose={vi.fn()}
                type="success"
                message="Success message"
            />
        );

        expect(screen.getByText("common.success")).toBeInTheDocument();
        expect(screen.getByText("Success message")).toBeInTheDocument();
    });

    it("renders error modal", () => {
        render(
            <InfoModal
                open={true}
                onClose={vi.fn()}
                type="error"
                message="Error message"
            />
        );

        expect(screen.getByText("common.error")).toBeInTheDocument();
        expect(screen.getByText("Error message")).toBeInTheDocument();
    });

    it("renders warning modal", () => {
        render(
            <InfoModal
                open={true}
                onClose={vi.fn()}
                type="warning"
                message="Warning message"
            />
        );

        expect(screen.getByText("common.warning")).toBeInTheDocument();
        expect(screen.getByText("Warning message")).toBeInTheDocument();
    });

    it("calls onClose when close button is clicked", () => {
        const onClose = vi.fn();
        render(
            <InfoModal
                open={true}
                onClose={onClose}
                message="Test message"
            />
        );

        const closeButton = screen.getByText("common.close");
        fireEvent.click(closeButton);

        expect(onClose).toHaveBeenCalled();
    });

    it("calls onButtonClick when custom button is clicked", () => {
        const onButtonClick = vi.fn();
        render(
            <InfoModal
                open={true}
                onClose={vi.fn()}
                onButtonClick={onButtonClick}
                buttonText="Custom Button"
                message="Test message"
            />
        );

        const button = screen.getByText("Custom Button");
        fireEvent.click(button);

        expect(onButtonClick).toHaveBeenCalled();
    });

    it("does not render when open is false", () => {
        render(
            <InfoModal
                open={false}
                onClose={vi.fn()}
                message="Test message"
            />
        );

        expect(screen.queryByText("Test message")).not.toBeInTheDocument();
    });

    it("renders custom title", () => {
        render(
            <InfoModal
                open={true}
                onClose={vi.fn()}
                title="Custom Title"
                message="Test message"
            />
        );

        expect(screen.getByText("Custom Title")).toBeInTheDocument();
    });
});

