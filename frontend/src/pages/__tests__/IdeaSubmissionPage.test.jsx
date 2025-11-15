import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, beforeEach, expect } from "vitest";
import IdeaSubmissionPage from "../IdeaSubmissionPage";
import * as api from "../../api/ideas";

// Mock i18n
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

// Mock API
vi.mock("../../api/ideas", () => ({
  getUserIdeas: vi.fn(),
}));

// Mock child components
vi.mock("../../components/dashboard/DashboardLayout", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock("../../components/ideas/IdeaForm", () => ({
  default: ({ onIdeaSubmitted }) => (
    <button
      data-testid="submit-idea-btn"
      onClick={onIdeaSubmitted}
    >
      Submit Idea
    </button>
  ),
}));

vi.mock("../../components/ideas/IdeasTable", () => ({
  default: ({ ideas, filter, onIdeaUpdated }) => (
    <div data-testid="ideas-table">
      {ideas.map((idea) => (
        <div key={idea.id}>{idea.title}</div>
      ))}
      <button data-testid="refresh-btn" onClick={onIdeaUpdated}>Refresh</button>
    </div>
  ),
}));

describe("IdeaSubmissionPage", () => {
  const mockIdeas = [
    { id: 1, title: "Idea 1", visibility: "public" },
    { id: 2, title: "Idea 2", visibility: "private" },
  ];

  beforeEach(() => {
    localStorage.setItem("token", "mock-token");
    vi.clearAllMocks();
    api.getUserIdeas.mockResolvedValue(mockIdeas);
  });

  it("renders the page and fetches ideas on mount", async () => {
    render(<IdeaSubmissionPage />);
    expect(screen.getByText("idea.my_submitted_ideas")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Idea 1")).toBeInTheDocument();
      expect(screen.getByText("Idea 2")).toBeInTheDocument();
    });
  });

  it("calls fetchMyIdeas when submitting an idea", async () => {
    render(<IdeaSubmissionPage />);
    const submitBtn = screen.getByTestId("submit-idea-btn");

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.getUserIdeas).toHaveBeenCalledTimes(2); // 1 for mount, 1 after submit
    });
  });

  it("updates filter when toggle button is clicked", async () => {
    render(<IdeaSubmissionPage />);
    const publicFilter = screen.getByText("idea.public");

    fireEvent.click(publicFilter);

    expect(publicFilter).toHaveAttribute("aria-pressed", "true");
  });

  it("refreshes IdeasTable when refresh button is clicked", async () => {
    render(<IdeaSubmissionPage />);
    const refreshBtn = screen.getByTestId("refresh-btn");

    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(api.getUserIdeas).toHaveBeenCalledTimes(2); // mount + refresh
    });
  });
});
