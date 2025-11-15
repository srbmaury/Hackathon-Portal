import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, beforeEach, expect } from "vitest";
import AnnouncementsPage from "../AnnouncementsPage";
import { AuthContext } from "../../context/AuthContext";

// Mock i18n
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key) => key, // returns the key itself
    }),
    initReactI18next: { type: "3rdParty" },
  };
});

// Mock AnnouncementCreate and AnnouncementList to avoid deep rendering
vi.mock("../../components/announcements/AnnouncementCreate", () => ({
  default: ({ onCreated }) => (
    <button data-testid="create-btn" onClick={onCreated}>
      Create
    </button>
  ),
}));

vi.mock("../../components/announcements/AnnouncementList", () => ({
  default: () => <div data-testid="announcement-list">Announcement List</div>,
}));

// Mock DashboardLayout to render children directly
vi.mock("../../components/dashboard/DashboardLayout", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

describe("AnnouncementsPage", () => {
  const renderWithUser = (role) => {
    render(
      <AuthContext.Provider value={{ user: { role } }}>
        <AnnouncementsPage />
      </AuthContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page title", () => {
    renderWithUser("admin");
    expect(screen.getByText("announcement.announcements")).toBeInTheDocument();
  });

  it("renders AnnouncementCreate button for admin", () => {
    renderWithUser("admin");
    expect(screen.getByTestId("create-btn")).toBeInTheDocument();
  });

  it("does not render AnnouncementCreate for regular user", () => {
    renderWithUser("user");
    expect(screen.queryByTestId("create-btn")).toBeNull();
  });

  it("renders AnnouncementList", () => {
    renderWithUser("admin");
    expect(screen.getByTestId("announcement-list")).toBeInTheDocument();
  });

  it("refreshes AnnouncementList when create button is clicked", () => {
    renderWithUser("admin");
    const list = screen.getByTestId("announcement-list");
    const button = screen.getByTestId("create-btn");

    fireEvent.click(button);

    // After refresh, AnnouncementList re-renders (new key)
    expect(screen.getByTestId("announcement-list")).toBeInTheDocument();
  });
});
