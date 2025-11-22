import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AnnouncementCreateEditDialog from "../AnnouncementCreateEditDialog";
import { vi } from "vitest";
import * as announcementApi from "../../../api/announcements";
import * as hackathonApi from "../../../api/hackathons";
import { AuthContext } from "../../../context/AuthContext";
import toast from "react-hot-toast";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n/i18n";

// Mock API
vi.mock("../../../api/announcements", () => ({
  formatAnnouncement: vi.fn(),
}));

vi.mock("../../../api/hackathons", () => ({
  createHackathonAnnouncement: vi.fn(),
  updateHackathonAnnouncement: vi.fn(),
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock @uiw/react-md-editor
vi.mock("@uiw/react-md-editor", () => {
  return {
    default: ({ value, onChange }) => (
      <textarea
        data-testid="md-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Markdown Editor"
      />
    ),
  };
});

describe("AnnouncementCreateEditDialog component", () => {
  const mockSetShowDialog = vi.fn();
  const mockSetAnnouncementForm = vi.fn();
  const mockLoadAnnouncements = vi.fn();
  const mockSetEditingAnnouncement = vi.fn();
  const mockHandleUpdateAnnouncement = vi.fn();
  const token = "test-token";
  const hackathonId = "hackathon123";

  const defaultProps = {
    id: hackathonId,
    announcementForm: { title: "", message: "" },
    showAnnouncementDialog: true,
    setShowAnnouncementDialog: mockSetShowDialog,
    setAnnouncementForm: mockSetAnnouncementForm,
    loadAnnouncements: mockLoadAnnouncements,
    editingAnnouncement: null,
    setEditingAnnouncement: mockSetEditingAnnouncement,
    handleUpdateAnnouncement: mockHandleUpdateAnnouncement,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) =>
    render(
      <I18nextProvider i18n={i18n}>
        <AuthContext.Provider value={{ token }}>
          <AnnouncementCreateEditDialog {...defaultProps} {...props} />
        </AuthContext.Provider>
      </I18nextProvider>
    );

  it("renders create mode dialog", () => {
    renderComponent();
    expect(screen.getByText("announcement.create_announcement")).toBeInTheDocument();
  });

  it("renders edit mode dialog when editingAnnouncement is provided", () => {
    const editingAnnouncement = {
      _id: "1",
      title: "Test",
      message: "Test message",
    };
    renderComponent({ editingAnnouncement });
    expect(screen.getByText("announcement.edit_announcement")).toBeInTheDocument();
  });

  it("disables create button when fields are empty", () => {
    renderComponent();
    const createBtn = screen.getByText("announcement.create");
    // Button should be disabled when fields are empty
    expect(createBtn).toBeDisabled();
  });

  it("can fill title and message", async () => {
    renderComponent({
      announcementForm: { title: "New Title", message: "New Message" },
    });

    expect(screen.getByDisplayValue("New Title")).toBeInTheDocument();
    expect(screen.getByDisplayValue("New Message")).toBeInTheDocument();
  });

  it("creates announcement successfully", async () => {
    hackathonApi.createHackathonAnnouncement.mockResolvedValue({});

    const filledForm = { title: "Test Title", message: "Test Message" };
    renderComponent({ announcementForm: filledForm });

    const createBtn = screen.getByText("announcement.create");
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(hackathonApi.createHackathonAnnouncement).toHaveBeenCalledWith(
        hackathonId,
        filledForm,
        token
      );
      expect(toast.success).toHaveBeenCalledWith("announcement.announcement_created");
      expect(mockSetShowDialog).toHaveBeenCalledWith(false);
      expect(mockLoadAnnouncements).toHaveBeenCalled();
    });
  });

  it("shows error toast when API fails during create", async () => {
    hackathonApi.createHackathonAnnouncement.mockRejectedValue({
      response: { data: { message: "Failed to create" } },
    });

    const filledForm = { title: "Test Title", message: "Test Message" };
    renderComponent({ announcementForm: filledForm });

    const createBtn = screen.getByText("announcement.create");
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to create");
    });
  });

  it("formats announcement with AI", async () => {
    announcementApi.formatAnnouncement.mockResolvedValue({
      formattedTitle: "Formatted Title",
      formattedMessage: "Formatted Message",
    });

    const filledForm = { title: "Test Title", message: "Test Message" };
    renderComponent({ announcementForm: filledForm });

    const formatBtn = screen.getByText("announcement.format_with_ai");
    fireEvent.click(formatBtn);

    await waitFor(() => {
      expect(announcementApi.formatAnnouncement).toHaveBeenCalledWith(
        hackathonId,
        "Test Title",
        "Test Message",
        token
      );
      expect(toast.success).toHaveBeenCalledWith("announcement.format_success");
      expect(mockSetAnnouncementForm).toHaveBeenCalledWith({
        title: "Formatted Title",
        message: "Formatted Message",
      });
    });
  });

  it("handles update for editing announcement", async () => {
    const editingAnnouncement = {
      _id: "1",
      title: "Old Title",
      message: "Old Message",
    };
    const updatedForm = { title: "Updated Title", message: "Updated Message" };

    renderComponent({
      editingAnnouncement,
      announcementForm: updatedForm,
    });

    const updateBtn = screen.getByText("announcement.update");
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(mockHandleUpdateAnnouncement).toHaveBeenCalledWith("1", updatedForm);
      expect(mockSetShowDialog).toHaveBeenCalledWith(false);
      expect(mockSetEditingAnnouncement).toHaveBeenCalledWith(null);
    });
  });

  it("closes dialog and resets form on cancel", () => {
    renderComponent({ announcementForm: { title: "Test", message: "Test" } });

    const cancelBtn = screen.getByText("common.cancel");
    fireEvent.click(cancelBtn);

    expect(mockSetShowDialog).toHaveBeenCalledWith(false);
    expect(mockSetAnnouncementForm).toHaveBeenCalledWith({ title: "", message: "" });
    expect(mockSetEditingAnnouncement).toHaveBeenCalledWith(null);
  });
});

