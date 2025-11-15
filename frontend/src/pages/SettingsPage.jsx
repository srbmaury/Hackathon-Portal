import React, { useContext, useState, useEffect } from "react";
import {
    Container,
    Typography,
    Stack,
    Card,
    CardContent,
    FormControl,
    RadioGroup,
    FormControlLabel,
    Radio,
    Switch,
    CircularProgress,
} from "@mui/material";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { SettingsContext } from "../context/SettingsContext.jsx";
import { AuthContext } from "../context/AuthContext.jsx";
import { useTranslation } from "react-i18next";
import { updateNotificationPreferences, getMyProfile } from "../api/users";
import toast from "react-hot-toast";

const SettingsPage = () => {
    const { theme, setTheme, language, setLanguage, notificationsEnabled, setNotificationsEnabled } =
        useContext(SettingsContext);
    const { token, user, login } = useContext(AuthContext);
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);

    // Sync notification preference from user profile on mount
    useEffect(() => {
        if (user?.notificationsEnabled !== undefined) {
            setNotificationsEnabled(user.notificationsEnabled);
            localStorage.setItem("notificationsEnabled", user.notificationsEnabled.toString());
        }
    }, [user, setNotificationsEnabled]);

    const handleNotificationToggle = async (event) => {
        const newValue = event.target.checked;
        setNotificationsEnabled(newValue);
        localStorage.setItem("notificationsEnabled", newValue.toString());

        // Update on backend
        if (token) {
            setLoading(true);
            try {
                const updatedUser = await updateNotificationPreferences(newValue, token);
                // Update AuthContext with the updated user data
                if (updatedUser) {
                    const updatedAuthUser = {
                        ...user,
                        notificationsEnabled: updatedUser.notificationsEnabled,
                    };
                    login(updatedAuthUser, token);
                }
                toast.success(t("settings.notification_updated") || "Notification preferences updated");
            } catch (error) {
                console.error("Error updating notification preferences:", error);
                toast.error(t("settings.notification_update_failed") || "Failed to update notification preferences");
                // Revert on error
                setNotificationsEnabled(!newValue);
                localStorage.setItem("notificationsEnabled", (!newValue).toString());
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <DashboardLayout>
            <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                    {t("settings.title")}
                </Typography>

                <Stack spacing={4}>
                    {/* THEME CARD */}
                    <Card
                        sx={{
                            borderRadius: 3,
                            overflow: "hidden",
                            border: (theme) =>
                                `1px solid ${theme.palette.divider}`,
                        }}
                    >
                        <CardContent>
                            <Typography
                                variant="h6"
                                fontWeight={600}
                                gutterBottom
                            >
                                {t("settings.theme")}
                            </Typography>
                            <FormControl component="fieldset">
                                <RadioGroup
                                    row
                                    value={theme}
                                    onChange={(e) => setTheme(e.target.value)}
                                >
                                    <FormControlLabel
                                        value="light"
                                        control={<Radio color="primary" />}
                                        label={t("settings.light")}
                                    />
                                    <FormControlLabel
                                        value="dark"
                                        control={<Radio color="primary" />}
                                        label={t("settings.dark")}
                                    />
                                    <FormControlLabel
                                        value="system"
                                        control={<Radio color="primary" />}
                                        label={t("settings.system")}
                                    />
                                </RadioGroup>
                            </FormControl>
                        </CardContent>
                    </Card>

                    {/* LANGUAGE CARD */}
                    <Card
                        sx={{
                            borderRadius: 3,
                            overflow: "hidden",
                            border: (theme) =>
                                `1px solid ${theme.palette.divider}`,
                        }}
                    >
                        <CardContent>
                            <Typography
                                variant="h6"
                                fontWeight={600}
                                gutterBottom
                            >
                                {t("settings.language")}
                            </Typography>
                            <FormControl component="fieldset">
                                <RadioGroup
                                    row
                                    value={language}
                                    onChange={(e) =>
                                        setLanguage(e.target.value)
                                    }
                                >
                                    <FormControlLabel
                                        value="en"
                                        control={<Radio color="primary" />}
                                        label="English"
                                    />
                                    <FormControlLabel
                                        value="hi"
                                        control={<Radio color="primary" />}
                                        label="हिन्दी"
                                    />
                                    <FormControlLabel
                                        value="te"
                                        control={<Radio color="primary" />}
                                        label="తెలుగు"
                                    />
                                </RadioGroup>
                            </FormControl>
                        </CardContent>
                    </Card>

                    {/* NOTIFICATIONS CARD */}
                    <Card
                        sx={{
                            borderRadius: 3,
                            overflow: "hidden",
                            border: (theme) =>
                                `1px solid ${theme.palette.divider}`,
                        }}
                    >
                        <CardContent>
                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                            >
                                <Typography variant="h6" fontWeight={600}>
                                    {t("settings.notifications")}
                                </Typography>
                                {loading ? (
                                    <CircularProgress size={24} />
                                ) : (
                                    <Switch
                                        color="primary"
                                        checked={notificationsEnabled}
                                        onChange={handleNotificationToggle}
                                    />
                                )}
                            </Stack>
                        </CardContent>
                    </Card>
                </Stack>
            </Container>
        </DashboardLayout>
    );
};

export default SettingsPage;
