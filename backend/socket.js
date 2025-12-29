const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./models/User");

let io;

// Track recent join events to prevent duplicate notifications (session-level dedup)
const recentJoinEvents = new Map(); // key: `${sessionId}:${userId}:${memberId}` -> timestamp
const DEDUP_INTERVAL_MS = 60000; // 60 seconds

// Cleanup old entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of recentJoinEvents.entries()) {
        if (now - timestamp > DEDUP_INTERVAL_MS) {
            recentJoinEvents.delete(key);
        }
    }
}, 30000); // Cleanup every 30 seconds

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


        // --- WebRTC Signaling for Demo Streaming ---

        // Join WebRTC room for a demo session
        socket.on("webrtc_join_session", async ({ sessionId, role }) => {
            const room = `webrtc:${sessionId}`;
            // Get existing participants BEFORE joining
            const existingClients = io.sockets.adapter.rooms.get(room);
            const existingPeers = [];
            if (existingClients) {
                for (const clientId of existingClients) {
                    const clientSocket = io.sockets.sockets.get(clientId);
                    if (clientSocket && clientSocket.userId !== socket.userId) {
                        existingPeers.push({
                            oderId: clientSocket.userId,
                            name: clientSocket.user?.name || "Participant",
                            role: clientSocket.webrtcRole || "participant"
                        });
                    }
                }
            }
            socket.join(room);
            socket.webrtcRole = role; // Store role on socket for later
            const userName = socket.user?.name || "Unknown";
            console.log(`User ${socket.userId} (${userName}) joined WebRTC room ${room} as ${role}`);

            // Notify others in the room that someone joined
            socket.to(room).emit("webrtc_peer_joined", {
                oderId: socket.userId,
                role,
                name: userName
            });

            // If judge/organizer joins, notify all team members (participants) who are NOT present in the room
            if (role === "organizer" || role === "judge") {
                try {
                    const DemoSession = require("./models/DemoSession");
                    const Notification = require("./models/Notification");
                    const session = await DemoSession.findById(sessionId).populate("team");
                    if (session && session.team && Array.isArray(session.team.members) && session.team.members.length > 0) {
                        // Get current socket IDs in the room
                        const currentClients = io.sockets.adapter.rooms.get(room) || new Set();
                        // Find userIds of those currently in the room
                        const presentUserIds = new Set();
                        for (const clientId of currentClients) {
                            const clientSocket = io.sockets.sockets.get(clientId);
                            if (clientSocket && clientSocket.userId) {
                                presentUserIds.add(String(clientSocket.userId));
                            }
                        }
                        let notified = 0;
                        for (const memberId of session.team.members) {
                            // Only notify if not the joiner and not already present in the room
                            if (String(memberId) !== String(socket.userId) && !presentUserIds.has(String(memberId))) {
                                // In-memory deduplication to prevent race conditions
                                const dedupKey = `${sessionId}:${socket.userId}:${memberId}`;
                                const lastNotified = recentJoinEvents.get(dedupKey);
                                
                                if (lastNotified && Date.now() - lastNotified < DEDUP_INTERVAL_MS) {
                                    console.log(`[WebRTC][SKIP] In-memory dedup: Already notified ${memberId} about this join (session=${sessionId})`);
                                    continue;
                                }
                                
                                // Mark as notified immediately to prevent race conditions
                                recentJoinEvents.set(dedupKey, Date.now());
                                
                                // Also check database for extra safety
                                const recent = await Notification.findOne({
                                    user: memberId,
                                    type: "team_message",
                                    "relatedEntity.type": "team",
                                    "relatedEntity.id": session.team._id,
                                    message: `${role.charAt(0).toUpperCase() + role.slice(1)} ${userName} joined your demo session.`,
                                    createdAt: { $gte: new Date(Date.now() - 60 * 1000) }
                                });
                                if (!recent) {
                                    console.log(`[WebRTC][NOTIFY] Creating notification for user=${memberId}, session=${sessionId}, role=${role}, userName=${userName}`);
                                    const notif = await Notification.create({
                                        user: memberId,
                                        type: "team_message",
                                        title: "Demo Session Update",
                                        message: `${role.charAt(0).toUpperCase() + role.slice(1)} ${userName} joined your demo session.`,
                                        relatedEntity: { type: "team", id: session.team._id },
                                        organization: session.team.organization,
                                        read: false
                                    });
                                    io.to(`user:${memberId}`).emit("notification", { notification: notif });
                                    notified++;
                                    console.log(`[WebRTC][EMIT] Notified participant ${memberId} about ${role} ${userName} joining session ${sessionId}`);
                                } else {
                                    console.log(`[WebRTC][SKIP] Skipped duplicate notification for participant ${memberId} (session=${sessionId})`);
                                }
                            } else {
                                console.log(`[WebRTC][SKIP] Not notifying user=${memberId} (already present or is joiner)`);
                            }
                        }
                        if (notified === 0) {
                            console.warn(`[WebRTC] No participants notified for session ${sessionId} (team members: ${session.team.members.map(String).join(", ")})`);
                        }
                    } else {
                        console.warn(`[WebRTC] Team or members missing for session ${sessionId}. session.team:`, session?.team);
                    }
                } catch (err) {
                    console.error("Failed to notify team on judge/organizer join:", err);
                }
            }

            // Get updated participant count
            const clients = io.sockets.adapter.rooms.get(room);
            const participants = clients ? Array.from(clients).length : 0;
            // Send room status AND list of existing peers to the new joiner
            socket.emit("webrtc_room_status", {
                sessionId,
                participants,
                ready: participants > 1,
                existingPeers, // Send list of existing peers so new joiner can connect to them
                oderId: socket.userId // Send the user their own ID
            });
        });

        // Leave WebRTC room
        socket.on("webrtc_leave_session", ({ sessionId }) => {
            const room = `webrtc:${sessionId}`;
            socket.leave(room);
            socket.to(room).emit("webrtc_peer_left", { oderId: socket.userId });
            console.log(`User ${socket.userId} left WebRTC room ${room}`);
        });

        // Signal that user is ready (camera started)
        socket.on("webrtc_ready", ({ sessionId, role }) => {
            const room = `webrtc:${sessionId}`;
            socket.to(room).emit("webrtc_peer_ready", {
                oderId: socket.userId,
                role
            });
        });

        // Forward WebRTC offer to a specific user or room
        socket.on("webrtc_offer", ({ sessionId, to, sdp }) => {
            if (to) {
                console.log(`WebRTC offer from ${socket.userId} to user ${to}`);
                io.to(`user:${to}`).emit("webrtc_offer", { from: socket.userId, sdp });
            } else if (sessionId) {
                const room = `webrtc:${sessionId}`;
                console.log(`WebRTC offer from ${socket.userId} to room ${room}`);
                socket.to(room).emit("webrtc_offer", { from: socket.userId, sdp });
            }
        });

        // Forward WebRTC answer to a specific user
        socket.on("webrtc_answer", ({ to, sdp }) => {
            console.log(`WebRTC answer from ${socket.userId} to ${to}`);
            io.to(`user:${to}`).emit("webrtc_answer", { from: socket.userId, sdp });
        });

        // Forward ICE candidates
        socket.on("webrtc_ice_candidate", ({ sessionId, to, candidate }) => {
            if (to) {
                // Send to specific user
                io.to(`user:${to}`).emit("webrtc_ice_candidate", { from: socket.userId, candidate });
            } else if (sessionId) {
                // Broadcast to room
                const room = `webrtc:${sessionId}`;
                socket.to(room).emit("webrtc_ice_candidate", { from: socket.userId, candidate });
            }
        });

        // Organizer calls all team members in the session
        socket.on("webrtc_call_team", ({ sessionId }) => {
            const room = `webrtc:${sessionId}`;
            console.log(`WebRTC call from organizer ${socket.userId} to room ${room}`);
            // Send incoming call to all participants except the caller (no SDP - participants will create offers)
            socket.to(room).emit("webrtc_incoming_call", { from: socket.userId });
        });

        // Participant answers the call
        socket.on("webrtc_answer_call", ({ sessionId, to, sdp }) => {
            const room = `webrtc:${sessionId}`;
            console.log(`WebRTC answer from ${socket.userId} to ${to} for session ${sessionId}`);

            // Send answer to the organizer who called
            io.to(`user:${to}`).emit("webrtc_answer", { from: socket.userId, sdp });

            // Notify others in room that the call was answered (so they don't see the ring anymore)
            socket.to(room).emit("webrtc_call_answered", { oderId: socket.userId });
        });

        // End call notification
        socket.on("webrtc_end_call", ({ sessionId }) => {
            const room = `webrtc:${sessionId}`;
            console.log(`WebRTC call ended by ${socket.userId} in room ${room}`);
            socket.to(room).emit("webrtc_call_ended", { oderId: socket.userId });
        });

        // Handle renegotiation when tracks are added after connection
        socket.on("webrtc_renegotiate", ({ sessionId, sdp }) => {
            const room = `webrtc:${sessionId}`;
            console.log(`WebRTC renegotiation offer from ${socket.userId}`);
            socket.to(room).emit("webrtc_renegotiate", { from: socket.userId, sdp });
        });

        // Handle renegotiation answer
        socket.on("webrtc_renegotiate_answer", ({ sessionId, to, sdp }) => {
            console.log(`WebRTC renegotiation answer from ${socket.userId} to ${to}`);
            io.to(`user:${to}`).emit("webrtc_renegotiate_answer", { from: socket.userId, sdp });
        });

        // Screen share notifications - broadcast to all in room
        socket.on("webrtc_screen_share_started", ({ sessionId, userName }) => {
            const room = `webrtc:${sessionId}`;
            const name = userName || socket.user?.name || "Someone";
            console.log(`Screen share started by ${socket.userId} (${name}) in room ${room}`);
            socket.to(room).emit("webrtc_screen_share_started", {
                oderId: socket.userId,
                name
            });
        });

        socket.on("webrtc_screen_share_stopped", ({ sessionId }) => {
            const room = `webrtc:${sessionId}`;
            console.log(`Screen share stopped by ${socket.userId} in room ${room}`);
            socket.to(room).emit("webrtc_screen_share_stopped", {
                oderId: socket.userId
            });
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

// Function to emit notification to a specific user
const emitNotification = (userId, notification) => {
    if (io) {
        io.to(`user:${userId}`).emit("notification", {
            notification,
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
    emitNotification,
};

