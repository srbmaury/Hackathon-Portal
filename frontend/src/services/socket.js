import { io } from "socket.io-client";

let socket = null;

export const initializeSocket = (token) => {
    if (socket?.connected) {
        return socket;
    }

    const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    
    socket = io(backendUrl, {
        auth: {
            token: token,
        },
        transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
        console.log("Socket connected");
    });

    socket.on("disconnect", () => {
        console.log("Socket disconnected");
    });

    socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
    });

    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export const getSocket = () => {
    return socket;
};

