// src/components/announcements/__tests__/AnnouncementItem.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AnnouncementItem from "../AnnouncementItem";
import { vi } from "vitest";
import * as api from "../../../api/announcements";
import toast from "react-hot-toast";

// Mock API functions
vi.mock("../../../api/announcements", () => ({
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => {
  return {
    default: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
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

  test("opens delete confirmation dialog and calls deleteAnnouncement API", async () => {
    api.deleteAnnouncement.mockResolvedValue({});
    render(<AnnouncementItem announcement={announcement} user={user} />);

    fireEvent.click(screen.getByTestId("DeleteIcon").closest("button"));
    expect(screen.getByText("announcement.confirm_delete")).toBeInTheDocument();

    fireEvent.click(screen.getByText("announcement.delete"));

    await waitFor(() => {
      expect(api.deleteAnnouncement).toHaveBeenCalledWith("1", localStorage.getItem("token"));
      expect(toast.success).toHaveBeenCalledWith("announcement.announcement_deleted");
    });
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

  test("shows error toast on API failure during delete", async () => {
    api.deleteAnnouncement.mockRejectedValue({ response: { data: { message: "Delete Failed!" } } });
    render(<AnnouncementItem announcement={announcement} user={user} />);

    fireEvent.click(screen.getByTestId("DeleteIcon").closest("button"));
    fireEvent.click(screen.getByText("announcement.delete"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Delete Failed!");
    });
  });
});
