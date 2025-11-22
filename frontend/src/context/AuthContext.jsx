import React, { createContext, useState, useContext, useEffect } from "react";
import { initializeSocket, disconnectSocket } from "../services/socket";
import { getMyProfile } from "../api/users";

export const AuthContext = createContext();

// Custom hook to use the AuthContext
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem("user");
        return saved ? JSON.parse(saved) : null;
    });

    const [token, setToken] = useState(() => {
        return localStorage.getItem("token") || null;
    });

    // Initialize socket when user logs in
    useEffect(() => {
        if (token) {
            const socket = initializeSocket(token);

            // Listen for role updates
            const handleRoleUpdate = (data) => {
                // Update user in state and localStorage
                setUser((currentUser) => {
                    if (currentUser && String(currentUser._id) === String(data.user._id)) {
                        const updatedUser = {
                            ...currentUser,
                            ...data.user,
                        };
                        localStorage.setItem("user", JSON.stringify(updatedUser));
                        return updatedUser;
                    }
                    return currentUser;
                });
            };

            socket.on("role_updated", handleRoleUpdate);

            // Store socket in context for other components to use
            socket.on("hackathon_updated", (data) => {
                // Dispatch custom event for components to listen
                window.dispatchEvent(new CustomEvent("hackathon_updated", { detail: data }));
            });

            socket.on("team_updated", (data) => {
                // Dispatch custom event for components to listen
                window.dispatchEvent(new CustomEvent("team_updated", { detail: data }));
            });

            socket.on("hackathon_role_updated", (data) => {
                // Dispatch custom event for components to listen
                window.dispatchEvent(new CustomEvent("hackathon_role_updated", { detail: data }));
            });

            socket.on("team_message", (data) => {
                // Dispatch custom event for components to listen
                window.dispatchEvent(new CustomEvent("team_message", { detail: data }));
            });

            return () => {
                socket.off("role_updated", handleRoleUpdate);
                socket.off("hackathon_updated");
                socket.off("team_updated");
                socket.off("hackathon_role_updated");
                socket.off("team_message");
            };
        } else {
            disconnectSocket();
        }
    }, [token]);

    const login = async (userData, authToken) => {
        setUser(userData);
        setToken(authToken);
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("token", authToken);

        // Fetch full user profile to ensure we have all fields including notificationsEnabled
        if (authToken) {
            try {
                const fullProfile = await getMyProfile(authToken);
                if (fullProfile) {
                    const updatedUser = {
                        ...userData,
                        ...fullProfile,
                    };
                    setUser(updatedUser);
                    localStorage.setItem("user", JSON.stringify(updatedUser));
                }
            } catch (error) {
                console.error("Error fetching user profile:", error);
                // Continue with login even if profile fetch fails
            }
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        disconnectSocket();
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
