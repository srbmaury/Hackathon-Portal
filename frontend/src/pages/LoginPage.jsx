import React from "react";
import { Typography, Box, Paper } from "@mui/material";
import { useTranslation } from "react-i18next";
import GoogleLoginButton from "../components/auth/GoogleLoginButton";
import TestLoginPanel from "../components/auth/TestLoginPanel";

const LoginPage = () => {
    const { t } = useTranslation();

    return (
        <Box
            sx={{
                height: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundImage:
                    'url("https://images.unsplash.com/photo-1522199710521-72d69614c702?auto=format&fit=crop&w=1950&q=80")',
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                overflow: "hidden",
            }}
        >
            <Paper
                elevation={12}
                sx={{
                    padding: 6,
                    maxWidth: 400,
                    width: "100%",
                    textAlign: "center",
                    borderRadius: 3,
                    backdropFilter: "blur(10px)",
                    backgroundColor: (theme) =>
                        theme.palette.mode === "dark"
                            ? "rgba(30, 30, 30, 0.85)"
                            : "rgba(255, 255, 255, 0.85)",
                    transition: "background-color 0.3s ease",
                }}
            >
                <Typography
                    variant="h3"
                    component="h1"
                    sx={{ fontWeight: "bold", color: "primary.main", mb: 2 }}
                >
                    {t("auth.app_title")}
                </Typography>

                <Typography variant="body1" sx={{ mb: 4, color: "text.secondary" }}>
                    {t("auth.login_subtext")}
                </Typography>

                <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <GoogleLoginButton />
                </Box>

                <Typography
                    variant="caption"
                    sx={{ display: "block", mt: 4, color: "text.secondary" }}
                >
                    © 2025 {t("auth.app_title")}. {t("auth.all_rights_reserved")}
                </Typography>
            </Paper>

            {/* Test Login Panel - only visible in development */}
            <TestLoginPanel />
        </Box>
    );
};

export default LoginPage;
