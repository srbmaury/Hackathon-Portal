import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import OverviewTab from "../OverviewTab";
import { vi } from "vitest";

// Correctly partially mock react-router-dom to preserve MemoryRouter
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

const mockNavigate = vi.fn();

// Mock i18n translation
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key, opts) => (opts && opts.number ? `${key} ${opts.number}` : key) })
}));

// Mock MarkdownViewer
vi.mock("../../common/MarkdownViewer", () => ({
    __esModule: true,
    default: ({ content }) => <div data-testid="markdown-viewer">{content}</div>
}));

import { MemoryRouter } from "react-router-dom";

describe("OverviewTab", () => {
    const mockSetInfoModal = vi.fn();
    const baseHackathon = {
        description: "Hackathon description",
        isActive: true,
        createdBy: { name: "Alice", email: "alice@example.com" },
        rounds: [
            {
                _id: "r1",
                name: "Round 1",
                isActive: true,
                description: "Round 1 desc",
                startDate: "2025-01-01T00:00:00Z",
                endDate: "2025-01-10T00:00:00Z"
            },
            {
                _id: "r2",
                name: "Round 2",
                isActive: false,
                description: "Round 2 desc",
                startDate: "2025-02-01T00:00:00Z",
                endDate: "2025-02-10T00:00:00Z"
            }
        ]
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    function renderTab(props = {}) {
        return render(
            <MemoryRouter>
                <OverviewTab
                    hackathon={baseHackathon}
                    id="hack1"
                    setInfoModal={mockSetInfoModal}
                    {...props}
                />
            </MemoryRouter>
        );
    }

    it("renders description, status, and creator info", () => {
        renderTab();
        expect(screen.getByText("hackathon.description")).toBeInTheDocument();
        expect(screen.getByTestId("markdown-viewer")).toHaveTextContent("Hackathon description");
        expect(screen.getByText("hackathon.status")).toBeInTheDocument();
        expect(screen.getAllByText("hackathon.active").length).toBeGreaterThan(0);
        expect(screen.getByText("hackathon.created_by")).toBeInTheDocument();
        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    });

    it("renders rounds section with correct info", () => {
        renderTab();
        expect(screen.getByText((t) => t.startsWith("hackathon.rounds"))).toBeInTheDocument();
        expect(screen.getByText("Round 1")).toBeInTheDocument();
        expect(screen.getByText("Round 2")).toBeInTheDocument();
        expect(screen.getByText("Round 1 desc")).toBeInTheDocument();
        expect(screen.getByText("Round 2 desc")).toBeInTheDocument();
        expect(screen.getAllByText("hackathon.active").length).toBeGreaterThan(0);
        expect(screen.getAllByText("hackathon.inactive").length).toBeGreaterThan(0);
    });

    it("shows info modal if round is inactive", () => {
        renderTab();
        const roundCard = screen.getByText("Round 2").closest(".MuiCard-root");
        fireEvent.click(roundCard);
        expect(mockSetInfoModal).toHaveBeenCalledWith({ open: true, type: "info", message: "hackathon_details.round_not_active" });
    });

    it("renders nothing for rounds if none exist", () => {
        renderTab({ hackathon: { ...baseHackathon, rounds: [] } });
        expect(screen.queryByText((t) => t.startsWith("hackathon.rounds"))).not.toBeInTheDocument();
    });
});
