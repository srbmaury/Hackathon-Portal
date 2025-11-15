import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import IdeaForm from "../IdeaForm";
import * as api from "../../../api/ideas";
import toast from "react-hot-toast";

// Mock the API and toast
vi.mock("../../../api/ideas");
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("IdeaForm", () => {
  const token = "dummy-token";
  const onIdeaSubmitted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders form fields", () => {
    render(<IdeaForm token={token} onIdeaSubmitted={onIdeaSubmitted} />);

    // Form uses translation keys
    expect(screen.getByLabelText("idea.title")).toBeInTheDocument();
    expect(screen.getByLabelText("idea.description")).toBeInTheDocument();
    expect(screen.getByText("idea.make_public")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "idea.submit" })).toBeInTheDocument();
  });

  test("shows error toast when fields are empty", async () => {
    render(<IdeaForm token={token} onIdeaSubmitted={onIdeaSubmitted} />);

    fireEvent.click(screen.getByRole("button", { name: "idea.submit" }));

    await waitFor(() => {
      // Error message uses translation key
      expect(toast.error).toHaveBeenCalledWith("idea.all_fields_required");
    });

    expect(api.submitIdea).not.toHaveBeenCalled();
  });

  test("submits idea successfully", async () => {
    api.submitIdea.mockResolvedValueOnce({});

    render(<IdeaForm token={token} onIdeaSubmitted={onIdeaSubmitted} />);

    fireEvent.change(screen.getByLabelText("idea.title"), {
      target: { value: "Test Idea" },
    });
    fireEvent.change(screen.getByLabelText("idea.description"), {
      target: { value: "Test Description" },
    });

    fireEvent.click(screen.getByRole("button", { name: "idea.submit" }));

    await waitFor(() => {
      expect(api.submitIdea).toHaveBeenCalledWith(
        { title: "Test Idea", description: "Test Description", isPublic: true },
        token
      );
      // Success message uses translation key
      expect(toast.success).toHaveBeenCalledWith("idea.idea_submitted");
      expect(onIdeaSubmitted).toHaveBeenCalled();
    });
  });

  test("shows error toast when API fails", async () => {
    api.submitIdea.mockRejectedValueOnce(new Error("API failed"));

    render(<IdeaForm token={token} onIdeaSubmitted={onIdeaSubmitted} />);

    fireEvent.change(screen.getByLabelText("idea.title"), {
      target: { value: "Test Idea" },
    });
    fireEvent.change(screen.getByLabelText("idea.description"), {
      target: { value: "Test Description" },
    });

    fireEvent.click(screen.getByRole("button", { name: "idea.submit" }));

    await waitFor(() => {
      // Error message uses translation key
      expect(toast.error).toHaveBeenCalledWith("idea.idea_submit_failed");
    });
  });
});
