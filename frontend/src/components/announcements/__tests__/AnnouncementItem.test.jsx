// src/components/announcements/__tests__/AnnouncementItem.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n/i18n";
import AnnouncementItem from "../AnnouncementItem";
import { vi } from "vitest";
import * as announcementApi from "../../../api/announcements";
import * as hackathonApi from "../../../api/hackathons";
import * as socketService from "../../../services/socket";
import toast from "react-hot-toast";

// Mock API functions
vi.mock("../../../api/announcements", () => ({
  updateAnnouncement: vi.fn(),
  formatAnnouncement: vi.fn(),
}));

vi.mock("../../../api/hackathons", () => ({
  updateHackathonAnnouncement: vi.fn(),
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

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock MarkdownViewer component
vi.mock("../../common/MarkdownViewer", () => ({
  default: ({ content }) => <div>{content}</div>,
}));

describe("AnnouncementItem component", () => {
  const announcement = {
    _id: "1",
    title: "Test Announcement",
    message: "Hello world",
    createdAt: "2025-10-25T07:48:00.000Z",
    createdBy: { _id: "user1", name: "Test User" },
  };

  const user = {
    _id: "user1",
    role: "organizer",
  };

  const hackathonId = "hackathon123";
  const myRole = "organizer";

  const renderComponent = (props = {}) =>
    render(
      <I18nextProvider i18n={i18n}>
        <AnnouncementItem announcement={announcement} user={user} {...props} />
      </I18nextProvider>
    );

  beforeEach(() => {
    // Reset socket mock before each test
    mockSocket.connected = true;
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.once.mockClear();
    localStorage.setItem("token", "test-token");
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("renders announcement title and message", () => {
    renderComponent();
    expect(screen.getByText("Test Announcement")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
    // The "Posted by" text uses translation with interpolation
    expect(screen.getByText(/announcement.posted_by_with_name/i)).toBeInTheDocument();
  });

  test("opens edit mode when edit button is clicked", () => {
    renderComponent();
    const editButton = screen.getByTestId("EditIcon").closest("button");
    fireEvent.click(editButton);

    expect(screen.getByDisplayValue("Test Announcement")).toBeInTheDocument();
    expect(screen.getByText("announcement.update")).toBeInTheDocument();
    expect(screen.getByText("announcement.cancel")).toBeInTheDocument();
  });

  test("calls updateAnnouncement API for general announcement", async () => {
    announcementApi.updateAnnouncement.mockResolvedValue({});
    renderComponent({ hackathonId: null });

    fireEvent.click(screen.getByTestId("EditIcon").closest("button"));

    const titleInput = screen.getByDisplayValue("Test Announcement");
    fireEvent.change(titleInput, { target: { value: "Updated Title" } });

    fireEvent.click(screen.getByText("announcement.update"));

    await waitFor(() => {
      expect(announcementApi.updateAnnouncement).toHaveBeenCalledWith(
        "1",
        { title: "Updated Title", message: "Hello world" },
        "test-token"
      );
      expect(toast.success).toHaveBeenCalledWith("announcement.announcement_updated");
    });
  });

  test("calls updateHackathonAnnouncement API for hackathon announcement", async () => {
    hackathonApi.updateHackathonAnnouncement.mockResolvedValue({});
    renderComponent({ hackathonId, myRole });

    fireEvent.click(screen.getByTestId("EditIcon").closest("button"));

    const titleInput = screen.getByDisplayValue("Test Announcement");
    fireEvent.change(titleInput, { target: { value: "Updated Title" } });

    fireEvent.click(screen.getByText("announcement.update"));

    await waitFor(() => {
      expect(hackathonApi.updateHackathonAnnouncement).toHaveBeenCalledWith(
        hackathonId,
        "1",
        { title: "Updated Title", message: "Hello world" },
        "test-token"
      );
      expect(toast.success).toHaveBeenCalledWith("announcement.announcement_updated");
    });
  });

  test("opens delete confirmation dialog and emits websocket delete event", async () => {
    renderComponent({ onDeleted: vi.fn() });

    fireEvent.click(screen.getByTestId("DeleteIcon").closest("button"));
    expect(screen.getByText("announcement.confirm_delete")).toBeInTheDocument();

    // Set up mock for websocket success event
    mockSocket.on.mockImplementation((event, handler) => {
      if (event === "announcement_deleted") {
        // Simulate success response
        setTimeout(() => {
          handler({ announcementId: "1" });
        }, 100);
      }
    });

    fireEvent.click(screen.getByText("announcement.delete"));

    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith("delete_announcement", {
        announcementId: "1",
        hackathonId: null,
      });
    }, { timeout: 2000 });
  });

  test("emits websocket delete with hackathonId for hackathon announcements", async () => {
    renderComponent({ hackathonId, myRole, onDeleted: vi.fn() });

    fireEvent.click(screen.getByTestId("DeleteIcon").closest("button"));

    mockSocket.on.mockImplementation((event, handler) => {
      if (event === "announcement_deleted") {
        setTimeout(() => {
          handler({ announcementId: "1" });
        }, 100);
      }
    });

    fireEvent.click(screen.getByText("announcement.delete"));

    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith("delete_announcement", {
        announcementId: "1",
        hackathonId: hackathonId,
      });
    }, { timeout: 2000 });
  });

  test("shows error toast on API failure during update", async () => {
    announcementApi.updateAnnouncement.mockRejectedValue({ 
      response: { data: { message: "Failed!" } } 
    });
    renderComponent({ hackathonId: null });

    fireEvent.click(screen.getByTestId("EditIcon").closest("button"));
    fireEvent.click(screen.getByText("announcement.update"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed!");
    });
  });

  test("shows error toast on websocket delete failure", async () => {
    mockSocket.connected = true;
    renderComponent({ onDeleted: vi.fn() });

    fireEvent.click(screen.getByTestId("DeleteIcon").closest("button"));
    
    // Set up mock for websocket error event
    mockSocket.on.mockImplementation((event, handler) => {
      if (event === "announcement_delete_error") {
        // Simulate error response
        setTimeout(() => {
          handler({ announcementId: "1", error: "Delete Failed!" });
        }, 100);
      }
    });

    fireEvent.click(screen.getByText("announcement.delete"));

    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith("delete_announcement", {
        announcementId: "1",
        hackathonId: null,
      });
    }, { timeout: 2000 });
  });

  test("hides edit/delete buttons when user cannot edit", () => {
    renderComponent({ 
      user: { ...user, role: "participant" },
      hackathonId: null
    });
    
    expect(screen.queryByTestId("EditIcon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("DeleteIcon")).not.toBeInTheDocument();
  });

  test("shows edit/delete buttons for hackathon organizer", () => {
    renderComponent({ hackathonId, myRole: "organizer" });
    
    expect(screen.getByTestId("EditIcon")).toBeInTheDocument();
    expect(screen.getByTestId("DeleteIcon")).toBeInTheDocument();
  });
});
