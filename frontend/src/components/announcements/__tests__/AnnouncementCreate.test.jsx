import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AnnouncementCreate from "../AnnouncementCreate";
import { vi } from "vitest";
import * as api from "../../../api/announcements";
import toast from "react-hot-toast";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n/i18n";

// Mock API
vi.mock("../../../api/announcements", () => ({
  createAnnouncement: vi.fn(),
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
  it('shows fallback success toast if response.message is missing', async () => {
    const titleInput = screen.getByRole('textbox', { name: /title/i });
    fireEvent.change(titleInput, { target: { value: 'Title' } });
    const messageTextarea = screen.getByTestId('md-editor');
    fireEvent.change(messageTextarea, { target: { value: 'Message' } });

    // Mock API success with no message
    api.createAnnouncement.mockResolvedValueOnce({});

    const createBtn = screen.getByRole('button', { name: /create/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('announcement.announcement_created')
      );
    });
  });
});

describe("AnnouncementCreate component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    render(
      <I18nextProvider i18n={i18n}>
        <AnnouncementCreate />
      </I18nextProvider>
    );
  });

  it("shows error toast when fields are empty", async () => {
    const createBtn = screen.getByRole("button", { name: /create/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("announcement.all_fields_required");
    });
  });

  it("can fill title and message", async () => {
    const titleInput = screen.getByRole("textbox", { name: /title/i });
    fireEvent.change(titleInput, { target: { value: "Title" } });

    const messageTextarea = screen.getByTestId("md-editor");
    fireEvent.change(messageTextarea, { target: { value: "Message" } });

    expect(titleInput).toHaveValue("Title");
    expect(messageTextarea).toHaveValue("Message");
  });

  it("shows error toast when API fails", async () => {
    // Fill title
    const titleInput = screen.getByRole("textbox", { name: /title/i });
    fireEvent.change(titleInput, { target: { value: "Title" } });

    // Fill message
    const messageTextarea = screen.getByTestId("md-editor");
    fireEvent.change(messageTextarea, { target: { value: "Message" } });

    // Mock API failure
    api.createAnnouncement.mockRejectedValueOnce({
      response: { data: { message: "Failed to create announcement" } },
    });

    // Click create
    const createBtn = screen.getByRole("button", { name: /create/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to create announcement"
      );
    });
  });
});
