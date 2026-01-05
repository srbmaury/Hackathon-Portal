import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n/i18n";
import MembersTab from "../MembersTab";
import { AuthContext } from "../../../context/AuthContext";
import { vi } from "vitest";

const mockSetConfirmDialog = vi.fn();
const mockSetInfoModal = vi.fn();
const mockLoadTeams = vi.fn();
const mockLoadMembers = vi.fn();

const mockAuthValue = {
  token: "test-token",
  user: { role: "admin", name: "Admin User" },
};

const allUsers = [
  { _id: "u1", name: "Alice", email: "alice@example.com", role: "user" },
  { _id: "u2", name: "Bob", email: "bob@example.com", role: "user" },
];

const members = [
  { _id: "m1", user: { _id: "u1", name: "Alice", email: "alice@example.com" }, role: "mentor" },
  { _id: "m2", user: { _id: "u2", name: "Bob", email: "bob@example.com" }, role: "participant" },
];

const membersByRole = {
  mentor: [members[0]],
  participant: [members[1]],
  organizer: [],
  judge: [],
};

const defaultProps = {
  myRole: "organizer",
  id: "hackathon1",
  setConfirmDialog: mockSetConfirmDialog,
  setInfoModal: mockSetInfoModal,
  loadTeams: mockLoadTeams,
  loadMembers: mockLoadMembers,
  allUsers,
  members,
  membersByRole,
};

const renderWithProviders = (ui, providerProps = {}) =>
  render(
    <AuthContext.Provider value={providerProps.auth || mockAuthValue}>
      <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
    </AuthContext.Provider>
  );

describe("MembersTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders members by role", () => {
    renderWithProviders(<MembersTab {...defaultProps} />);
    // Use flexible matcher for translation keys that may include counts or be split
    expect(
      screen.getByText((content) =>
        content.replace(/\s/g, "").startsWith("roles.mentor_plural(")
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.replace(/\s/g, "").startsWith("roles.participant_plural(")
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  test("shows add member section for organizer/admin", () => {
    renderWithProviders(<MembersTab {...defaultProps} />);
    expect(screen.getByText("members.add")).toBeInTheDocument();
    expect(screen.getAllByText("members.select_user").length).toBeGreaterThan(0);
    expect(screen.getAllByText("members.role").length).toBeGreaterThan(0);
    expect(screen.getByText("members.assign")).toBeInTheDocument();
  });

  test("shows assign mentors section for organizer/admin", () => {
    renderWithProviders(<MembersTab {...defaultProps} />);
    expect(screen.getByText("mentor.assign_teams")).toBeInTheDocument();
    expect(screen.getByText("mentor.assign_mentors")).toBeInTheDocument();
  });

  test("shows no members alert when members is empty", () => {
    renderWithProviders(<MembersTab {...defaultProps} members={[]} membersByRole={{ mentor: [], participant: [], organizer: [], judge: [] }} />);
    expect(screen.getAllByText("members.no_members").length).toBeGreaterThan(0);
  });

  test("calls setConfirmDialog when remove button is clicked", () => {
    renderWithProviders(<MembersTab {...defaultProps} />);
    const removeButtons = screen.getAllByText("common.remove");
    fireEvent.click(removeButtons[0]);
    expect(mockSetConfirmDialog).toHaveBeenCalled();
  });
});
