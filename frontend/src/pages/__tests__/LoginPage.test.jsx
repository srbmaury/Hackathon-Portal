import React from "react";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, beforeEach, expect } from "vitest";
import LoginPage from "../LoginPage";

// Mock i18n
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key, // simply return the key for testing
  }),
}));

// Mock GoogleLoginButton
vi.mock("../../components/auth/GoogleLoginButton", () => ({
  default: () => <button data-testid="google-login-btn">Google Login</button>,
}));

// Mock TestLoginPanel
vi.mock("../../components/auth/TestLoginPanel", () => ({
  default: () => <div data-testid="test-login-panel">Test Login Panel</div>,
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the LoginPage correctly", () => {
    render(<LoginPage />);

    // Check headings and subtext
    expect(screen.getByText("auth.app_title")).toBeInTheDocument();
    expect(screen.getByText("auth.login_subtext")).toBeInTheDocument();

    // Check GoogleLoginButton is rendered
    expect(screen.getByTestId("google-login-btn")).toBeInTheDocument();

    // Check footer text
    expect(screen.getByText(/© 2025 auth.app_title/)).toBeInTheDocument();
    expect(screen.getByText(/auth.all_rights_reserved/)).toBeInTheDocument();
  });
});
