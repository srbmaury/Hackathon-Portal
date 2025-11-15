// src/components/announcements/__tests__/AnnouncementItem.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AnnouncementItem from "../AnnouncementItem";
import { vi } from "vitest";
import * as api from "../../../api/announcements";
import * as socketService from "../../../services/socket";
import toast from "react-hot-toast";

// Mock API functions
vi.mock("../../../api/announcements", () => ({
  updateAnnouncement: vi.fn(),
  formatAnnouncement: vi.fn(),
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
vi.mock("react-hot-toast", () => {
  return {
    default: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
  test('renders without user prop (no edit/delete)', () => {
    render(<AnnouncementItem announcement={{ ...announcement }} />);
    expect(screen.getByText('Test Announcement')).toBeInTheDocument();
    expect(screen.queryByTestId('EditIcon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('DeleteIcon')).not.toBeInTheDocument();
  });

  test('renders with missing createdBy and createdAt', () => {
    render(<AnnouncementItem announcement={{ ...announcement, createdBy: undefined, createdAt: undefined }} user={user} />);
    expect(screen.getByText('Test Announcement')).toBeInTheDocument();
  });

  test('renders long markdown message', () => {
    render(<AnnouncementItem announcement={{ ...announcement, message: '# Heading\n**Bold**\nText' }} user={user} />);
    expect(screen.getByText('Test Announcement')).toBeInTheDocument();
    expect(screen.getByText(/Heading|Bold|Text/)).toBeInTheDocument();
  });

  test('does not show edit/delete for non-organizer', () => {
    render(<AnnouncementItem announcement={announcement} user={{ ...user, role: 'participant' }} />);
    expect(screen.queryByTestId('EditIcon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('DeleteIcon')).not.toBeInTheDocument();
  });

  test('websocket disconnect disables delete', async () => {
    mockSocket.connected = false;
    render(<AnnouncementItem announcement={announcement} user={user} />);
    fireEvent.click(screen.getByTestId('DeleteIcon').closest('button'));
    expect(screen.queryByText('announcement.delete')).not.toBeInTheDocument();
  });

  test('update with empty title shows error toast', async () => {
    render(<AnnouncementItem announcement={announcement} user={user} />);
    fireEvent.click(screen.getByTestId('EditIcon').closest('button'));
    const titleInput = screen.getByDisplayValue('Test Announcement');
    fireEvent.change(titleInput, { target: { value: '' } });
    fireEvent.click(screen.getByText('announcement.update'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  test('delete calls onDeleted callback', async () => {
    const onDeleted = vi.fn();
    render(<AnnouncementItem announcement={announcement} user={user} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByTestId('DeleteIcon').closest('button'));
    mockSocket.on.mockImplementation((event, handler) => {
      if (event === 'announcement_deleted') {
        setTimeout(() => handler({ announcementId: '1' }), 50);
      }
    });
    fireEvent.click(screen.getByText('announcement.delete'));
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalled();
    });
  });
});

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

  beforeEach(() => {
    // Reset socket mock before each test
    mockSocket.connected = true;
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.once.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("renders announcement title and message", () => {
    render(<AnnouncementItem announcement={announcement} user={user} />);
    expect(screen.getByText("Test Announcement")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
    // The "Posted by" text uses translation with interpolation
    expect(screen.getByText(/announcement.posted_by_with_name/i)).toBeInTheDocument();
  });

  test("opens edit mode when edit button is clicked", () => {
    render(<AnnouncementItem announcement={announcement} user={user} />);
    const editButton = screen.getByTestId("EditIcon").closest("button");
    fireEvent.click(editButton);

    expect(screen.getByDisplayValue("Test Announcement")).toBeInTheDocument();
    expect(screen.getByText("announcement.update")).toBeInTheDocument();
    expect(screen.getByText("announcement.cancel")).toBeInTheDocument();
  });

  test("calls updateAnnouncement API and toast on update", async () => {
    api.updateAnnouncement.mockResolvedValue({});
    render(<AnnouncementItem announcement={announcement} user={user} />);

    fireEvent.click(screen.getByTestId("EditIcon").closest("button"));

    const titleInput = screen.getByDisplayValue("Test Announcement");
    fireEvent.change(titleInput, { target: { value: "Updated Title" } });

    fireEvent.click(screen.getByText("announcement.update"));

    await waitFor(() => {
      expect(api.updateAnnouncement).toHaveBeenCalledWith(
        "1",
        { title: "Updated Title", message: "Hello world" },
        localStorage.getItem("token")
      );
      expect(toast.success).toHaveBeenCalledWith("announcement.announcement_updated");
    });
  });

  test("opens delete confirmation dialog and emits websocket delete event", async () => {
    render(<AnnouncementItem announcement={announcement} user={user} onDeleted={vi.fn()} />);

    fireEvent.click(screen.getByTestId("DeleteIcon").closest("button"));
    expect(screen.getByText("announcement.confirm_delete")).toBeInTheDocument();

    // Set up mock for websocket success event
    const successHandler = vi.fn();
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

  test("shows error toast on API failure during update", async () => {
    api.updateAnnouncement.mockRejectedValue({ response: { data: { message: "Failed!" } } });
    render(<AnnouncementItem announcement={announcement} user={user} />);

    fireEvent.click(screen.getByTestId("EditIcon").closest("button"));
    fireEvent.click(screen.getByText("announcement.update"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed!");
    });
  });

  test("shows error toast on websocket delete failure", async () => {
    mockSocket.connected = true;
    render(<AnnouncementItem announcement={announcement} user={user} onDeleted={vi.fn()} />);

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
});
