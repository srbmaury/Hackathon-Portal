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

        // Handle announcement deletion via websocket
        socket.on("delete_announcement", async (data) => {
            try {
                const Announcement = require("./models/Announcement");
                const { announcementId, hackathonId } = data;

                if (!announcementId) {
                    socket.emit("announcement_delete_error", {
                        announcementId: announcementId || "unknown",
                        error: "Announcement ID is required"
                    });
                    return;
                }

                const announcement = await Announcement.findById(announcementId);
                
                if (!announcement) {
                    socket.emit("announcement_delete_error", {
                        announcementId,
                        error: "Announcement not found"
                    });
                    return;
                }

                // Get organization ID properly
                const userOrgId = socket.user?.organization?._id 
                    ? String(socket.user.organization._id)
                    : String(socket.user?.organization || "");
                const announcementOrgId = String(announcement.organization);

                // Verify organization match first
                if (announcementOrgId !== userOrgId) {
                    socket.emit("announcement_delete_error", {
                        announcementId,
                        error: "Permission denied: Organization mismatch"
                    });
                    return;
                }

                // Verify permissions
                const isCreator = announcement.createdBy && announcement.createdBy.equals(socket.userId);
                const isAdmin = socket.user.role === "admin";
                const isHackathonOrganizer = hackathonId && socket.user.role === "organizer";
                const isGeneralOrganizer = !hackathonId && socket.user.role === "organizer" && isCreator;

                const canDelete = isAdmin || isHackathonOrganizer || isGeneralOrganizer || isCreator;

                if (!canDelete) {
                    socket.emit("announcement_delete_error", {
                        announcementId,
                        error: "Permission denied: You don't have permission to delete this announcement"
                    });
                    return;
                }

                // Delete the announcement
                await Announcement.findByIdAndDelete(announcementId);

                // Prepare deletion event data
                const deletionData = {
                    announcementId,
                    hackathonId: announcement.hackathon ? String(announcement.hackathon) : (hackathonId || null)
                };

                // Emit to organization room so all users see the deletion
                // This includes the user who deleted it, so we don't need a separate emit
                if (userOrgId) {
                    io.to(`org:${userOrgId}`).emit("announcement_deleted", deletionData);
                    console.log(`Announcement ${announcementId} deleted, broadcasted to org:${userOrgId}`);
                } else {
                    // Fallback: emit to the user who deleted if org ID is missing
                    socket.emit("announcement_deleted", deletionData);
                    console.warn(`Organization ID missing, only emitting to user ${socket.userId}`);
                }
            } catch (error) {
                console.error("Error deleting announcement via websocket:", error);
                socket.emit("announcement_delete_error", {
                    announcementId: data?.announcementId || "unknown",
                    error: error.message || "Failed to delete announcement"
                });
            }
        });

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

// Function to emit announcement deletion to organization
const emitAnnouncementDeleted = (organizationId, announcementId, hackathonId) => {
    if (io) {
        io.to(`org:${organizationId}`).emit("announcement_deleted", {
            announcementId,
            hackathonId,
        });
    }
};

// Function to emit announcement creation to organization
const emitAnnouncementCreated = (organizationId, announcement, hackathonId) => {
    if (io) {
        io.to(`org:${organizationId}`).emit("announcement_created", {
            announcement,
            hackathonId: hackathonId || (announcement.hackathon ? String(announcement.hackathon) : null),
        });
    }
};

// Function to emit announcement update to organization
const emitAnnouncementUpdated = (organizationId, announcementId, updates, hackathonId) => {
    if (io) {
        io.to(`org:${organizationId}`).emit("announcement_updated", {
            announcementId,
            updates,
            hackathonId,
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
    emitAnnouncementDeleted,
    emitAnnouncementCreated,
    emitAnnouncementUpdated,
};

