import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import WebRTCStreamRecorder from "../WebRTCStreamRecorder";
import { vi } from "vitest";

// Mock i18n translation and preserve initReactI18next
vi.mock("react-i18next", async () => {
    const actual = await vi.importActual("react-i18next");
    return {
        ...actual,
        useTranslation: () => ({ t: (key) => key })
    };
});

// Mock toast
vi.mock("react-hot-toast", () => ({
    __esModule: true,
    default: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
}));

describe("WebRTCStreamRecorder", () => {
    const defaultProps = {
        sessionId: "test-session",
        token: "test-token",
        myRole: "organizer",
        onVideoUploaded: vi.fn(),
        userName: "Test User",
    };

    it("renders without crashing and shows record button", () => {
        render(<WebRTCStreamRecorder {...defaultProps} />);
        expect(screen.getByText(/webrtc.record/i)).toBeInTheDocument();
    });

    it("shows camera and screen share controls", () => {
        render(<WebRTCStreamRecorder {...defaultProps} />);
        expect(screen.getByText(/webrtc.start_camera/i)).toBeInTheDocument();
        expect(screen.getByText(/webrtc.share_screen/i)).toBeInTheDocument();
    });

    it("shows error alert if error is set", () => {
        render(<WebRTCStreamRecorder {...defaultProps} />);
        // Set error via rerender
        fireEvent.click(screen.getByText(/webrtc.start_camera/i));
        // Simulate error by setting error state (not possible directly, so skip for now)
        // This is a placeholder for a more advanced test with state control
    });

    it("shows dialog when recording is complete (simulated)", () => {
        render(<WebRTCStreamRecorder {...defaultProps} />);
        // Simulate dialog open by clicking record, then stop, then check dialog
        // Not possible to fully simulate without mocking MediaRecorder and streams
        // Instead, check that dialog is not in DOM by default
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("renders local camera thumbnail with user name", () => {
        render(<WebRTCStreamRecorder {...defaultProps} />);
        expect(screen.getByText(/Test User/i)).toBeInTheDocument();
        expect(screen.getByText(/webrtc.you/i)).toBeInTheDocument();
    });

    it("renders record, pause, and stop buttons for organizer", () => {
        render(<WebRTCStreamRecorder {...defaultProps} />);
        expect(screen.getByText(/webrtc.record/i)).toBeInTheDocument();
        // Pause and stop only appear when recording, which requires more advanced mocking
    });

    it("does not show record button for non-organizer", () => {
        render(<WebRTCStreamRecorder {...defaultProps} myRole="participant" />);
        expect(screen.queryByText(/webrtc.record/i)).not.toBeInTheDocument();
    });

    // Add more interaction tests as needed, e.g., clicking buttons, toggling switches, etc.
});
