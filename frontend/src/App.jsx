import React from "react";
import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "react-hot-toast";
import { useTheme } from "@mui/material/styles";

function AppContent() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <>
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: isDark ? '#424242' : '#fff',
                        color: isDark ? '#fff' : '#333',
                        border: isDark ? '1px solid #616161' : '1px solid #e0e0e0',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    },
                    success: {
                        duration: 3000,
                        iconTheme: {
                            primary: '#4caf50',
                            secondary: isDark ? '#fff' : '#fff',
                        },
                    },
                    error: {
                        duration: 4000,
                        iconTheme: {
                            primary: '#f44336',
                            secondary: isDark ? '#fff' : '#fff',
                        },
                    },
                }}
            />
            <AppRoutes />
        </>
    );
}

function App() {
    return (
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
            <AuthProvider>
                <NotificationProvider>
                    <AppContent />
                </NotificationProvider>
            </AuthProvider>
        </GoogleOAuthProvider>
    );
}

export default App;
