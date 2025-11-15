import React, { createContext, useState, useMemo, useEffect } from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import i18n from "../i18n/i18n"; // ✅ import i18n instance

export const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
    // Load saved settings or defaults
    const savedTheme = localStorage.getItem("theme") || "light";
    const savedLanguage = localStorage.getItem("language") || "en";
    const savedNotificationsEnabled = localStorage.getItem("notificationsEnabled");
    const notificationsEnabledDefault = savedNotificationsEnabled !== null 
        ? savedNotificationsEnabled === "true" 
        : true; // Default to true if not set

    const [themeMode, setThemeMode] = useState(savedTheme);
    const [language, setLanguage] = useState(savedLanguage);
    const [notificationsEnabled, setNotificationsEnabled] = useState(notificationsEnabledDefault);
    const [systemTheme, setSystemTheme] = useState(
        window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
    );

    // Listen to system theme changes
    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (e) =>
            setSystemTheme(e.matches ? "dark" : "light");

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    // Save theme changes
    const handleSetTheme = (mode) => {
        setThemeMode(mode);
        localStorage.setItem("theme", mode);
    };

    // Update language and sync with i18next
    const handleSetLanguage = (lang) => {
        setLanguage(lang);
        localStorage.setItem("language", lang);
        i18n.changeLanguage(lang); // ✅ dynamically change language
    };

    // Update notification preferences
    const handleSetNotificationsEnabled = (enabled) => {
        setNotificationsEnabled(enabled);
        localStorage.setItem("notificationsEnabled", enabled.toString());
    };

    // Initialize i18n on mount
    useEffect(() => {
        if (i18n.language !== language) {
            i18n.changeLanguage(language);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Memoized theme object
    const muiTheme = useMemo(() => {
        let paletteMode = themeMode === "system" ? systemTheme : themeMode;

        return createTheme({
            palette: {
                mode: paletteMode,
                primary: { main: "#1976d2" },
                secondary: { main: "#9c27b0" },
            },
            typography: { fontFamily: "Roboto, Arial, sans-serif" },
        });
    }, [themeMode, systemTheme]);

    return (
        <SettingsContext.Provider
            value={{
                theme: themeMode,
                setTheme: handleSetTheme,
                language,
                setLanguage: handleSetLanguage, // ✅ use updated handler
                notificationsEnabled,
                setNotificationsEnabled: handleSetNotificationsEnabled,
            }}
        >
            <ThemeProvider theme={muiTheme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </SettingsContext.Provider>
    );
};
