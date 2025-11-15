import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, vi, beforeEach } from "vitest";
import SettingsPage from "../SettingsPage";
import { SettingsContext } from "../../context/SettingsContext";
import { AuthContext } from "../../context/AuthContext";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n/i18n";

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

  beforeEach(() => renderPage());

  it("renders dashboard layout and cards", () => {
    expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();

    // Match the translation keys because useTranslation mock returns the key itself
    expect(screen.getByText("settings.title")).toBeInTheDocument();
    expect(screen.getByText("settings.theme")).toBeInTheDocument();
    expect(screen.getByText("settings.language")).toBeInTheDocument();
    expect(screen.getByText("settings.notifications")).toBeInTheDocument();
  });

  it("shows selected theme and can change it", () => {
    const lightRadio = screen.getByLabelText("settings.light");
    const darkRadio = screen.getByLabelText("settings.dark");
    const systemRadio = screen.getByLabelText("settings.system");

    expect(lightRadio.checked).toBe(true);
    expect(darkRadio.checked).toBe(false);

    fireEvent.click(darkRadio);
    expect(setTheme).toHaveBeenCalledWith("dark");

    fireEvent.click(systemRadio);
    expect(setTheme).toHaveBeenCalledWith("system");
  });

  it("shows selected language and can change it", () => {
    const englishRadio = screen.getByLabelText("English");
    const hindiRadio = screen.getByLabelText("हिन्दी");
    const teluguRadio = screen.getByLabelText("తెలుగు");

    expect(englishRadio.checked).toBe(true);
    expect(hindiRadio.checked).toBe(false);

    fireEvent.click(hindiRadio);
    expect(setLanguage).toHaveBeenCalledWith("hi");

    fireEvent.click(teluguRadio);
    expect(setLanguage).toHaveBeenCalledWith("te");
  });
});
