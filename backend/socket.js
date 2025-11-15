const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./models/User");

let io;

const initializeSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:5173",
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    // Socket authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error("Authentication error"));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).populate("organization");
            
            if (!user) {
                return next(new Error("User not found"));
            }

            socket.userId = user._id.toString();
            socket.user = user;
            next();
        } catch (error) {
            next(new Error("Authentication error"));
        }
    });

    io.on("connection", (socket) => {
        console.log(`User connected: ${socket.userId}`);

        // Join user's personal room for targeted updates
        socket.join(`user:${socket.userId}`);
        
        // Join organization room for organization-wide updates
        if (socket.user?.organization?._id) {
            socket.join(`org:${socket.user.organization._id}`);
        }

        socket.on("disconnect", () => {
            console.log(`User disconnected: ${socket.userId}`);
        });
    });

    return io;
};

// Function to emit role update to a specific user
const emitRoleUpdate = (userId, updatedUser) => {
    if (io) {
        io.to(`user:${userId}`).emit("role_updated", {
            user: {
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                organization: updatedUser.organization,
            },
        });
    }
};

// Function to emit hackathon updates to organization
const emitHackathonUpdate = (organizationId, eventType, hackathon) => {
    if (io) {
        io.to(`org:${organizationId}`).emit("hackathon_updated", {
            eventType, // 'created', 'updated', 'deleted'
            hackathon,
        });
    }
};

// Function to emit team updates to organization
const emitTeamUpdate = (organizationId, eventType, team) => {
    if (io) {
        io.to(`org:${organizationId}`).emit("team_updated", {
            eventType, // 'created', 'updated', 'deleted'
            team,
        });
    }
};

// Function to emit hackathon role assignment to organization
const emitHackathonRoleUpdate = (organizationId, hackathonId, eventType, data) => {
    if (io) {
        io.to(`org:${organizationId}`).emit("hackathon_role_updated", {
            eventType, // 'assigned', 'removed'
            hackathonId,
            ...data,
        });
    }
};

// Function to emit message to team members and mentor
const emitMessage = (organizationId, teamId, data) => {
    if (io) {
        // Emit to all users in the organization who are in the team room
        io.to(`org:${organizationId}`).emit("team_message", {
            teamId,
            ...data,
        });
    }
};

module.exports = { 
    initializeSocket, 
    emitRoleUpdate,
    emitHackathonUpdate,
    emitTeamUpdate,
    emitHackathonRoleUpdate,
    emitMessage,
};

