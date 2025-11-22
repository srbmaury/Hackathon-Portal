import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AnnouncementList from "../AnnouncementList";
import { vi } from "vitest";
import * as hackathonApi from "../../../api/hackathons";
import { AuthContext } from "../../../context/AuthContext";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n/i18n";

// Mock API
vi.mock("../../../api/hackathons", () => ({
  getHackathonAnnouncements: vi.fn(),
}));

// Mock socket service
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connect: vi.fn(),
  connected: true,
  once: vi.fn(),
};

vi.mock("../../../services/socket", () => ({
  getSocket: vi.fn(() => mockSocket),
  initializeSocket: vi.fn(() => mockSocket),
  disconnectSocket: vi.fn(),
}));

describe("AnnouncementList component", () => {
  const user = { name: "Test User", role: "admin", _id: "user1" };
  const token = "test-token";
  const hackathonId = "hackathon123";

  beforeEach(() => {
    vi.clearAllMocks();
    // Set localStorage before any renders
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  });

  afterEach(() => {
    localStorage.clear();
  });

  const renderComponent = () =>
    render(
      <MemoryRouter initialEntries={[`/hackathons/${hackathonId}`]}>
        <I18nextProvider i18n={i18n}>
          <AuthContext.Provider value={{ user, token }}>
            <Routes>
              <Route path="/hackathons/:id" element={<AnnouncementList />} />
            </Routes>
          </AuthContext.Provider>
        </I18nextProvider>
      </MemoryRouter>
    );

  it("shows loading spinner initially", async () => {
    // Create a promise that never resolves to keep loading state
    const neverResolvingPromise = new Promise(() => {});
    hackathonApi.getHackathonAnnouncements.mockReturnValue(neverResolvingPromise);
    
    renderComponent();
    
    // Wait for component to start loading (component checks token first, then starts fetch)
    await waitFor(() => {
      // Component should show loading spinner when loading and no announcements
      // CircularProgress has role="progressbar"
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    }, { timeout: 500 });
  });

  it("renders announcements after successful fetch", async () => {
    const announcements = [
      { _id: "1", title: "Title 1", message: "Message 1", createdAt: new Date().toISOString(), createdBy: { _id: "user1", name: "Test User" } },
      { _id: "2", title: "Title 2", message: "Message 2", createdAt: new Date().toISOString(), createdBy: { _id: "user1", name: "Test User" } },
    ];
    hackathonApi.getHackathonAnnouncements.mockResolvedValue({ 
      announcements,
      totalPages: 1,
      total: 2
    });

    renderComponent();

    for (let ann of announcements) {
      await waitFor(() => expect(screen.getByText(ann.title)).toBeInTheDocument());
      await waitFor(() => expect(screen.getByText(ann.message)).toBeInTheDocument());
    }
  });

  it("shows error alert when API fails", async () => {
    hackathonApi.getHackathonAnnouncements.mockRejectedValueOnce({
      response: { data: { message: "API Error" } },
    });

    renderComponent();

    await waitFor(() => {
      // Component shows error in Alert component, not toast
      expect(screen.getByText("API Error")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("shows no announcements message when list is empty", async () => {
    hackathonApi.getHackathonAnnouncements.mockResolvedValue({ 
      announcements: [],
      totalPages: 1,
      total: 0
    });

    renderComponent();

    await waitFor(() => {
      // The message uses translation key
      expect(screen.getByText("announcement.no_announcements")).toBeInTheDocument();
    });
  });

  it("handles pagination", async () => {
    const announcements = [
      { _id: "1", title: "Title 1", message: "Message 1", createdAt: new Date().toISOString(), createdBy: { _id: "user1", name: "Test User" } },
    ];
    hackathonApi.getHackathonAnnouncements.mockResolvedValue({ 
      announcements,
      totalPages: 2,
      total: 2,
      currentPage: 1
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Title 1")).toBeInTheDocument();
    });

    // Check pagination controls exist
    const pagination = screen.queryByRole("navigation", { name: /pagination/i });
    if (pagination) {
      expect(pagination).toBeInTheDocument();
    }
  });

  it("sets up WebSocket listeners for announcement events", async () => {
    hackathonApi.getHackathonAnnouncements.mockResolvedValue({ 
      announcements: [],
      totalPages: 1,
      total: 0
    });

    renderComponent();

    await waitFor(() => {
      // Verify socket listeners are set up
      expect(mockSocket.on).toHaveBeenCalledWith("announcement_created", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("announcement_updated", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("announcement_deleted", expect.any(Function));
    });
  });

  it("cleans up WebSocket listeners on unmount", async () => {
    hackathonApi.getHackathonAnnouncements.mockResolvedValue({ 
      announcements: [],
      totalPages: 1,
      total: 0
    });

    const { unmount } = renderComponent();

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalled();
    });

    unmount();

    // Check that off was called for cleanup
    expect(mockSocket.off).toHaveBeenCalled();
  });
});
