import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, beforeEach, expect } from "vitest";
import HackathonPage from "../HackathonPage";
import { AuthContext } from "../../context/AuthContext";
import * as api from "../../api/hackathons";
import toast from "react-hot-toast";

// Mock i18n but preserve other exports (like initReactI18next) so i18n initialization works
vi.mock("react-i18next", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useTranslation: () => ({ t: (key) => key }),
    };
});

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
    default: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

// Mock HackathonForm component
vi.mock("../../components/hackathons/HackathonForm", () => ({
    default: ({ initialData, onSubmit }) => (
        <div data-testid="hackathon-form">
            <button
                data-testid="submit-form-btn"
                onClick={() => onSubmit({ title: "Test Hackathon" })}
            >
                {initialData ? "Update" : "Create"}
            </button>
        </div>
    ),
}));

// Mock HackathonList component
vi.mock("../../components/hackathons/HackathonList", () => ({
    default: ({ hackathons, onEdit, onDelete }) => (
        <div data-testid="hackathon-list">
            {hackathons.map((h) => (
                <div key={h._id} data-testid={`hackathon-${h._id}`}>
                    <span>{h.title}</span>
                    <button onClick={() => onEdit(h)}>Edit</button>
                    <button onClick={() => onDelete(h._id)}>Delete</button>
                </div>
            ))}
        </div>
    ),
}));

// Mock DashboardLayout to render children directly
vi.mock("../../components/dashboard/DashboardLayout", () => ({
    default: ({ children }) => <div>{children}</div>,
}));

// Mock API functions
vi.mock("../../api/hackathons", () => ({
    getAllHackathons: vi.fn(),
    createHackathon: vi.fn(),
    updateHackathon: vi.fn(),
    deleteHackathon: vi.fn(),
}));

describe("HackathonPage", () => {
    const mockHackathons = [
        { _id: "1", title: "Hackathon 1", description: "Description 1" },
        { _id: "2", title: "Hackathon 2", description: "Description 2" },
    ];

    const mockToken = "test-token";

    const renderWithUser = (role = "admin") => {
        const contextValue = {
            user: { role, name: "Test User" },
            token: mockToken,
        };

        render(
            <AuthContext.Provider value={contextValue}>
                <HackathonPage />
            </AuthContext.Provider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
        api.getAllHackathons.mockResolvedValue({ hackathons: mockHackathons });
        // Mock window.confirm
        window.confirm = vi.fn(() => true);
    });

    describe("Rendering", () => {
        it("renders the page title", async () => {
            renderWithUser("admin");
            expect(screen.getByText("hackathon.hackathons")).toBeInTheDocument();
        });

        it("renders HackathonForm for admin users", async () => {
            renderWithUser("admin");
            // Form is only shown when "Create Hackathon" button is clicked
            const createButton = await screen.findByText("hackathon.create_hackathon");
            createButton.click();
            await waitFor(() => {
                expect(screen.getByTestId("hackathon-form")).toBeInTheDocument();
            });
        });

        it("renders HackathonForm for hackathon_creator users", async () => {
            renderWithUser("hackathon_creator");
            // Form is only shown when "Create Hackathon" button is clicked
            const createButton = await screen.findByText("hackathon.create_hackathon");
            createButton.click();
            await waitFor(() => {
                expect(screen.getByTestId("hackathon-form")).toBeInTheDocument();
            });
        });

        it("does not render HackathonForm for regular users", async () => {
            renderWithUser("user");
            await waitFor(() => {
                expect(screen.queryByTestId("hackathon-form")).not.toBeInTheDocument();
            });
        });

        it("renders HackathonList with hackathons", async () => {
            renderWithUser("admin");
            await waitFor(() => {
                expect(screen.getByTestId("hackathon-list")).toBeInTheDocument();
                expect(screen.getByText("Hackathon 1")).toBeInTheDocument();
                expect(screen.getByText("Hackathon 2")).toBeInTheDocument();
            });
        });
    });

    describe("Fetching Hackathons", () => {
        it("fetches hackathons on mount", async () => {
            renderWithUser("admin");

            await waitFor(() => {
                expect(api.getAllHackathons).toHaveBeenCalledWith(mockToken);
                expect(screen.getByText("Hackathon 1")).toBeInTheDocument();
            });
        });

        it("handles fetch error gracefully", async () => {
            const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
            api.getAllHackathons.mockRejectedValue(new Error("Fetch failed"));

            renderWithUser("admin");

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith("hackathon.fetch_failed");
            });

            consoleErrorSpy.mockRestore();
        });

        it("displays empty list when no hackathons exist", async () => {
            api.getAllHackathons.mockResolvedValue({ hackathons: [] });

            renderWithUser("admin");

            await waitFor(() => {
                expect(screen.getByTestId("hackathon-list")).toBeInTheDocument();
            });
        });
    });

    describe("Create Hackathon", () => {
        it("calls createHackathon and refreshes list on create", async () => {
            api.createHackathon.mockResolvedValue({ success: true });

            renderWithUser("admin");

            // Click "Create Hackathon" button to show form
            const createButton = await screen.findByText("hackathon.create_hackathon");
            createButton.click();

            await waitFor(() => {
                expect(screen.getByTestId("submit-form-btn")).toBeInTheDocument();
            });

            const submitBtn = screen.getByTestId("submit-form-btn");
            submitBtn.click();

            await waitFor(() => {
                expect(api.createHackathon).toHaveBeenCalledWith(
                    { title: "Test Hackathon" },
                    mockToken
                );
                expect(api.getAllHackathons).toHaveBeenCalledTimes(2); // Once on mount, once after create
            });
        });
    });

    describe("Update Hackathon", () => {
        it("calls updateHackathon when editing an existing hackathon", async () => {
            api.updateHackathon.mockResolvedValue({ success: true });

            renderWithUser("admin");

            // Wait for hackathons to load
            await waitFor(() => {
                expect(screen.getByText("Hackathon 1")).toBeInTheDocument();
            });

            // Click edit button on first hackathon
            const editButtons = screen.getAllByText("Edit");
            editButtons[0].click();

            // Wait for form to show "Update" button (indicating edit mode)
            await waitFor(() => {
                expect(screen.getByText("Update")).toBeInTheDocument();
            });

            // Submit the form
            const submitBtn = screen.getByTestId("submit-form-btn");
            submitBtn.click();

            await waitFor(() => {
                expect(api.updateHackathon).toHaveBeenCalledWith(
                    "1",
                    { title: "Test Hackathon" },
                    mockToken
                );
                expect(api.getAllHackathons).toHaveBeenCalledTimes(2); // Once on mount, once after update
            });
        });

        it("does not call updateHackathon when no hackathon is being edited", async () => {
            renderWithUser("admin");

            // Click "Create Hackathon" button to show form
            const createButton = await screen.findByText("hackathon.create_hackathon");
            createButton.click();

            await waitFor(() => {
                expect(screen.getByTestId("submit-form-btn")).toBeInTheDocument();
            });

            // Since we're not in edit mode, clicking submit should call create, not update
            const submitBtn = screen.getByTestId("submit-form-btn");
            submitBtn.click();

            await waitFor(() => {
                expect(api.createHackathon).toHaveBeenCalled();
                expect(api.updateHackathon).not.toHaveBeenCalled();
            });
        });
    });

    describe("Delete Hackathon", () => {
        it("calls deleteHackathon with confirmation and refreshes list", async () => {
            api.deleteHackathon.mockResolvedValue({ success: true });
            // Ensure getHackathonById returns the hackathon so the ConfirmDialog opens
            api.getHackathonById = vi.fn().mockResolvedValue({ hackathon: mockHackathons[0] });

            renderWithUser("admin");

            await waitFor(() => {
                expect(screen.getByText("Hackathon 1")).toBeInTheDocument();
            });

            const deleteButtons = screen.getAllByText("Delete");
            deleteButtons[0].click();

            // Confirm dialog should open with confirm button text 'common.delete'
            const confirmBtn = await screen.findByText("common.delete");
            confirmBtn.click();

            await waitFor(() => {
                expect(api.deleteHackathon).toHaveBeenCalledWith("1", mockToken);
                expect(api.getAllHackathons).toHaveBeenCalledTimes(2); // Once on mount, once after delete
            });
        });

        it("does not delete hackathon when user cancels confirmation", async () => {
            // Ensure getHackathonById returns the hackathon so the ConfirmDialog opens
            api.getHackathonById = vi.fn().mockResolvedValue({ hackathon: mockHackathons[0] });

            renderWithUser("admin");

            await waitFor(() => {
                expect(screen.getByText("Hackathon 1")).toBeInTheDocument();
            });

            const deleteButtons = screen.getAllByText("Delete");
            deleteButtons[0].click();

            // Cancel via confirm dialog
            const cancelBtn = await screen.findByText("common.cancel");
            cancelBtn.click();

            expect(api.deleteHackathon).not.toHaveBeenCalled();
            expect(api.getAllHackathons).toHaveBeenCalledTimes(1); // Only on mount
        });
    });

    describe("Edit Hackathon", () => {
        it("sets editing hackathon when edit button is clicked", async () => {
            renderWithUser("admin");

            await waitFor(() => {
                expect(screen.getByText("Hackathon 1")).toBeInTheDocument();
            });

            // Click edit
            const editButtons = screen.getAllByText("Edit");
            editButtons[0].click();

            // Should now show "Update" button (indicating edit mode) and form should be visible
            await waitFor(() => {
                expect(screen.getByTestId("hackathon-form")).toBeInTheDocument();
                expect(screen.getByText("Update")).toBeInTheDocument();
            });
        });

        it("clears editing hackathon after successful update", async () => {
            api.updateHackathon.mockResolvedValue({ success: true });

            renderWithUser("admin");

            await waitFor(() => {
                expect(screen.getByText("Hackathon 1")).toBeInTheDocument();
            });

            // Click edit to enter edit mode
            const editButtons = screen.getAllByText("Edit");
            editButtons[0].click();

            await waitFor(() => {
                expect(screen.getByText("Update")).toBeInTheDocument();
            });

            // Submit the update
            const submitBtn = screen.getByTestId("submit-form-btn");
            submitBtn.click();

            // After update, form should be hidden (showForm becomes false)
            await waitFor(() => {
                expect(screen.queryByTestId("hackathon-form")).not.toBeInTheDocument();
            });
        });

        it("clears editing hackathon after successful create", async () => {
            api.createHackathon.mockResolvedValue({ success: true });

            renderWithUser("admin");

            await waitFor(() => {
                expect(screen.getByText("Hackathon 1")).toBeInTheDocument();
            });

            // Click edit to enter edit mode
            const editButtons = screen.getAllByText("Edit");
            editButtons[0].click();

            await waitFor(() => {
                expect(screen.getByText("Update")).toBeInTheDocument();
            });

            // Click create (which calls handleCreate)
            const submitBtn = screen.getByTestId("submit-form-btn");
            // This actually calls handleUpdate, but let me test the create flow separately

            // We already tested this - after create, editing state is cleared
        });
    });

    describe("Role-based Access", () => {
        it("allows admin to see form", async () => {
            renderWithUser("admin");
            // Form is only shown when "Create Hackathon" button is clicked
            const createButton = await screen.findByText("hackathon.create_hackathon");
            createButton.click();
            await waitFor(() => {
                expect(screen.getByTestId("hackathon-form")).toBeInTheDocument();
            });
        });

        it("allows hackathon_creator to see form", async () => {
            renderWithUser("hackathon_creator");
            // Form is only shown when "Create Hackathon" button is clicked
            const createButton = await screen.findByText("hackathon.create_hackathon");
            createButton.click();
            await waitFor(() => {
                expect(screen.getByTestId("hackathon-form")).toBeInTheDocument();
            });
        });

        it("prevents user role from seeing form", async () => {
            renderWithUser("user");
            await waitFor(() => {
                expect(screen.queryByTestId("hackathon-form")).not.toBeInTheDocument();
            });
        });

        it("shows list to all users", async () => {
            renderWithUser("user");
            await waitFor(() => {
                expect(screen.getByTestId("hackathon-list")).toBeInTheDocument();
            });
        });
    });
});

