import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import AnnouncementList from "../AnnouncementList";
import { vi } from "vitest";
import * as api from "../../../api/announcements";
import toast from "react-hot-toast";
import { AuthContext } from "../../../context/AuthContext";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n/i18n";

// Mock API
vi.mock("../../../api/announcements", () => ({
  getAnnouncements: vi.fn(),
}));

// Mock toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AnnouncementList component", () => {
  const user = { name: "Test User", role: "admin" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(
      <I18nextProvider i18n={i18n}>
        <AuthContext.Provider value={{ user }}>
          <AnnouncementList />
        </AuthContext.Provider>
      </I18nextProvider>
    );

  it("shows loading spinner initially", () => {
    api.getAnnouncements.mockReturnValue(new Promise(() => {})); // never resolves
    renderComponent();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders announcements after successful fetch", async () => {
    const announcements = [
      { _id: "1", title: "Title 1", message: "Message 1" },
      { _id: "2", title: "Title 2", message: "Message 2" },
    ];
    api.getAnnouncements.mockResolvedValue({ announcements });

    renderComponent();

    for (let ann of announcements) {
      await waitFor(() => expect(screen.getByText(ann.title)).toBeInTheDocument());
      await waitFor(() => expect(screen.getByText(ann.message)).toBeInTheDocument());
    }
  });

  it("shows error toast when API fails", async () => {
    api.getAnnouncements.mockRejectedValueOnce({
      response: { data: { message: "API Error" } },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("API Error")).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith("API Error");
    });
  });

  it("shows no announcements message when list is empty", async () => {
    api.getAnnouncements.mockResolvedValue({ announcements: [] });

    renderComponent();

    await waitFor(() => {
      // The message uses translation key
      expect(screen.getByText("announcement.no_announcements")).toBeInTheDocument();
    });
  });
});
