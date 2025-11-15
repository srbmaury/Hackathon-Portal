vi.spyOn(toast, "success").mockImplementation(() => {});
vi.spyOn(toast, "error").mockImplementation(() => {});
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, vi, beforeEach } from "vitest";
import SettingsPage from "../SettingsPage";
import { SettingsContext } from "../../context/SettingsContext";
import { AuthContext } from "../../context/AuthContext";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n/i18n";
import * as usersApi from "../../api/users";
import toast from "react-hot-toast";

// Mock DashboardLayout
vi.mock("../../components/dashboard/DashboardLayout", () => ({
  default: ({ children }) => <div data-testid="dashboard-layout">{children}</div>,
}));

// Partial mock for react-i18next to avoid initReactI18next errors

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useTranslation: () => ({ t: (key) => key }),
    initReactI18next: { type: "3rdParty" },
  };
});


describe("SettingsPage", () => {
  let theme = "light";
  let language = "en";
  let setTheme, setLanguage, notificationsEnabled, setNotificationsEnabled;

  const renderPage = (initialTheme = "light", initialLanguage = "en") => {
    theme = initialTheme;
    language = initialLanguage;
    notificationsEnabled = true;
    setTheme = vi.fn((val) => { theme = val; });
    setLanguage = vi.fn((val) => { language = val; });
    setNotificationsEnabled = vi.fn((val) => { notificationsEnabled = val; });

    const mockUser = { _id: "123", name: "Test User", notificationsEnabled: true };
    const mockToken = "test-token";
    const mockLogin = vi.fn();

    render(
      <I18nextProvider i18n={i18n}>
        <AuthContext.Provider value={{ token: mockToken, user: mockUser, login: mockLogin }}>
          <SettingsContext.Provider value={{ 
            theme, 
            setTheme, 
            language, 
            setLanguage,
            notificationsEnabled,
            setNotificationsEnabled
          }}>
            <SettingsPage />
          </SettingsContext.Provider>
        </AuthContext.Provider>
      </I18nextProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    renderPage();
  });


  it("renders dashboard layout and cards", () => {
    expect(screen.getAllByTestId("dashboard-layout")[0]).toBeInTheDocument();
    // Match the translation keys because useTranslation mock returns the key itself
    expect(screen.getAllByText("settings.title")[0]).toBeInTheDocument();
    expect(screen.getAllByText("settings.theme")[0]).toBeInTheDocument();
    expect(screen.getAllByText("settings.language")[0]).toBeInTheDocument();
    expect(screen.getAllByText("settings.notifications")[0]).toBeInTheDocument();
  });

  it("shows selected theme and can change it", () => {
    const lightRadio = screen.getAllByLabelText("settings.light")[0];
    const darkRadio = screen.getAllByLabelText("settings.dark")[0];
    const systemRadio = screen.getAllByLabelText("settings.system")[0];

    expect(lightRadio.checked).toBe(true);
    expect(darkRadio.checked).toBe(false);

    fireEvent.click(darkRadio);
    expect(setTheme).toHaveBeenCalledWith("dark");

    fireEvent.click(systemRadio);
    expect(setTheme).toHaveBeenCalledWith("system");
  });


  it("shows selected language and can change it", () => {
    const englishRadio = screen.getAllByLabelText("English")[0];
    const hindiRadio = screen.getAllByLabelText("हिन्दी")[0];
    const teluguRadio = screen.getAllByLabelText("తెలుగు")[0];

    expect(englishRadio.checked).toBe(true);
    expect(hindiRadio.checked).toBe(false);

    fireEvent.click(hindiRadio);
    expect(setLanguage).toHaveBeenCalledWith("hi");

    fireEvent.click(teluguRadio);
    expect(setLanguage).toHaveBeenCalledWith("te");
  });

  it("updates notification preference and shows success toast", async () => {
    vi.spyOn(usersApi, "updateNotificationPreferences").mockResolvedValue({ notificationsEnabled: true });
    const switchInput = screen.getByRole("switch");
    expect(switchInput.checked).toBe(true);
    fireEvent.click(switchInput);
    // Wait for async update
    await screen.findByRole("switch");
    expect(usersApi.updateNotificationPreferences).toHaveBeenCalledWith(false, "test-token");
    expect(toast.success).toHaveBeenCalled();
    expect(localStorage.getItem("notificationsEnabled")).toBe("false");
  });

  it("shows error toast and reverts on API error", async () => {
    vi.spyOn(usersApi, "updateNotificationPreferences").mockRejectedValue(new Error("fail"));
    const switchInput = screen.getByRole("switch");
    expect(switchInput.checked).toBe(true);
    fireEvent.click(switchInput);
    await screen.findByRole("switch");
    expect(toast.error).toHaveBeenCalled();
    expect(localStorage.getItem("notificationsEnabled")).toBe("true");
  });
});
