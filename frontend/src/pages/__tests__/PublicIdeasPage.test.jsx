import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { vi, describe, it, beforeEach, expect } from "vitest";
import PublicIdeasPage from "../PublicIdeasPage";

// Mock i18n
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key, // just return the key
    }),
}));

// Mock DashboardLayout
vi.mock("../../components/dashboard/DashboardLayout", () => ({
    default: ({ children }) => <div data-testid="dashboard-layout">{children}</div>,
}));

// Mock IdeasTable
vi.mock("../../components/ideas/IdeasTable", () => ({
    default: ({ ideas, filter, showActions }) => (
        <div data-testid="ideas-table">
            {ideas?.length || 0} ideas, filter: {filter}, showActions: {showActions.toString()}
        </div>
    ),
}));

// Mock API
vi.mock("../../api/ideas", () => ({
    getPublicIdeas: vi.fn().mockResolvedValue([{ id: 1, title: "Idea 1" }]),
}));

describe("PublicIdeasPage", () => {
    beforeEach(() => {
        localStorage.setItem("token", "mock-token");
        vi.clearAllMocks();
    });

    it("renders the page correctly", async () => {
        await act(async () => {
            render(<PublicIdeasPage />);
        });

        // Check DashboardLayout wrapper
        expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();

        // Check header text
        expect(screen.getByText("idea.public_ideas")).toBeInTheDocument();

        // Check ToggleButtons
        expect(screen.getByText("idea.all")).toBeInTheDocument();
        expect(screen.getByText("idea.mine")).toBeInTheDocument();
        expect(screen.getByText("idea.others")).toBeInTheDocument();

        // Check IdeasTable
        expect(screen.getByTestId("ideas-table")).toHaveTextContent("1 ideas, filter: all, showActions: false");
    });

    it("updates filter when ToggleButtons are clicked", async () => {
        await act(async () => {
            render(<PublicIdeasPage />);
        });

        // Default filter is "all"
        expect(screen.getByTestId("ideas-table")).toHaveTextContent("filter: all");

        // Switch to "mine"
        await act(async () => {
            fireEvent.click(screen.getByText("idea.mine"));
        });
        expect(screen.getByTestId("ideas-table")).toHaveTextContent("filter: mine");

        // Switch to "others"
        await act(async () => {
            fireEvent.click(screen.getByText("idea.others"));
        });
        expect(screen.getByTestId("ideas-table")).toHaveTextContent("filter: others");
    });
});
