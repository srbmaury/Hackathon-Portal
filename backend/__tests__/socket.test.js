import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Server } from "socket.io";
import { createServer } from "http";
import { io as ioClient } from "socket.io-client";
import jwt from "jsonwebtoken";
import { initializeSocket, emitRoleUpdate, emitHackathonUpdate, emitTeamUpdate, emitHackathonRoleUpdate, emitMessage, emitAnnouncementDeleted, emitAnnouncementCreated, emitAnnouncementUpdated, emitNotification } from "../socket.js";
import User from "../models/User.js";
import Announcement from "../models/Announcement.js";
import Organization from "../models/Organization.js";
import Hackathon from "../models/Hackathon.js";
import { connectTestDb, closeTestDb } from "../setup/testDb.js";
import mongoose from "mongoose";

const JWT_SECRET = process.env.JWT_SECRET || "test-secret-key";
const TEST_PORT = 3001;

describe("Socket.IO Server", () => {
    let httpServer;
    let io;
    let clientSocket;
    let org;
    let testUser;
    let adminUser;
    let hackathon;
    let announcement;

    beforeAll(async () => {
        await connectTestDb();
        
        // Create test organization
        org = await Organization.create({
            name: "Test Org",
            domain: "test.com",
            createdBy: new mongoose.Types.ObjectId(),
        });

        // Create test users
        testUser = await User.create({
            name: "Test User",
            email: "test@test.com",
            googleId: "google-test",
            role: "user",
            organization: org._id,
        });

        adminUser = await User.create({
            name: "Admin User",
            email: "admin@test.com",
            googleId: "google-admin",
            role: "admin",
            organization: org._id,
        });

        // Create test hackathon
        hackathon = await Hackathon.create({
            title: "Test Hackathon",
            description: "Test Description",
            organization: org._id,
            startDate: new Date(Date.now() + 86400000),
            endDate: new Date(Date.now() + 86400000 * 2),
            maxTeamSize: 5,
            minTeamSize: 2,
            status: "active",
        });

        // Create HTTP server
        httpServer = createServer();
        io = initializeSocket(httpServer);
        
        await new Promise((resolve) => {
            httpServer.listen(TEST_PORT, resolve);
        });
    });

    afterAll(async () => {
        if (clientSocket) {
            clientSocket.disconnect();
        }
        if (io) {
            io.close();
        }
        if (httpServer) {
            httpServer.close();
        }
        await closeTestDb();
    });

    beforeEach(async () => {
        // Clean up announcements
        await Announcement.deleteMany({});
        
        if (clientSocket) {
            clientSocket.disconnect();
        }
    });

    describe("Authentication", () => {
        it("should reject connection without token", (done) => {
            clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: {},
                reconnection: false,
            });

            clientSocket.on("connect_error", (error) => {
                expect(error.message).toBe("Authentication error");
                clientSocket.disconnect();
                done();
            });

            setTimeout(() => {
                if (!clientSocket.connected) {
                    clientSocket.disconnect();
                    done(new Error("Timeout: should have received connect_error"));
                }
            }, 2000);
        });

        it("should reject connection with invalid token", (done) => {
            clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token: "invalid-token" },
                reconnection: false,
            });

            clientSocket.on("connect_error", (error) => {
                expect(error.message).toBe("Authentication error");
                clientSocket.disconnect();
                done();
            });

            setTimeout(() => {
                if (!clientSocket.connected) {
                    clientSocket.disconnect();
                    done(new Error("Timeout: should have received connect_error"));
                }
            }, 2000);
        });

        it("should reject connection for non-existent user", (done) => {
            const fakeUserId = new mongoose.Types.ObjectId();
            const token = jwt.sign({ id: fakeUserId }, JWT_SECRET);

            clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token },
                reconnection: false,
            });

            clientSocket.on("connect_error", (error) => {
                expect(error.message).toBe("User not found");
                clientSocket.disconnect();
                done();
            });

            setTimeout(() => {
                if (!clientSocket.connected) {
                    clientSocket.disconnect();
                    done(new Error("Timeout: should have received connect_error"));
                }
            }, 2000);
        });

        it("should accept connection with valid token", (done) => {
            const token = jwt.sign({ id: testUser._id }, JWT_SECRET);

            clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token },
                reconnection: false,
            });

            clientSocket.on("connect", () => {
                expect(clientSocket.connected).toBe(true);
                clientSocket.disconnect();
                done();
            });

            setTimeout(() => {
                if (!clientSocket.connected) {
                    clientSocket.disconnect();
                    done(new Error("Timeout: should have connected"));
                }
            }, 2000);
        });

        it("should accept connection with valid token and populate user data", (done) => {
            const token = jwt.sign({ id: testUser._id }, JWT_SECRET);

            clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token },
                reconnection: false,
            });

            clientSocket.on("connect", () => {
                expect(clientSocket.connected).toBe(true);
                // Socket should have joined user and org rooms
                setTimeout(() => {
                    clientSocket.disconnect();
                    done();
                }, 100);
            });
        });
    });

    describe("WebSocket Events - Emit Functions", () => {
        beforeEach((done) => {
            const token = jwt.sign({ id: testUser._id }, JWT_SECRET);
            clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token },
            });
            clientSocket.on("connect", done);
        });

        it("should emit role update to user", (done) => {
            clientSocket.on("role_updated", (data) => {
                expect(data.user._id.toString()).toBe(testUser._id.toString());
                expect(data.user.role).toBe("organizer");
                done();
            });

            const updatedUser = { ...testUser.toObject(), role: "organizer" };
            emitRoleUpdate(testUser._id, updatedUser);
        });

        it("should emit hackathon update to organization", (done) => {
            clientSocket.on("hackathon_updated", (data) => {
                expect(data.eventType).toBe("created");
                expect(data.hackathon.title).toBe("New Hackathon");
                done();
            });

            emitHackathonUpdate(org._id, "created", { title: "New Hackathon" });
        });

        it("should emit team update to organization", (done) => {
            clientSocket.on("team_updated", (data) => {
                expect(data.eventType).toBe("created");
                expect(data.team.name).toBe("Test Team");
                done();
            });

            emitTeamUpdate(org._id, "created", { name: "Test Team" });
        });

        it("should emit hackathon role update to organization", (done) => {
            clientSocket.on("hackathon_role_updated", (data) => {
                expect(data.eventType).toBe("assigned");
                expect(data.hackathonId.toString()).toBe(hackathon._id.toString());
                expect(data.userId.toString()).toBe(testUser._id.toString());
                done();
            });

            emitHackathonRoleUpdate(org._id, hackathon._id, "assigned", {
                userId: testUser._id,
                role: "participant",
            });
        });

        it("should emit message to team", (done) => {
            const teamId = new mongoose.Types.ObjectId();
            
            clientSocket.on("team_message", (data) => {
                expect(data.teamId.toString()).toBe(teamId.toString());
                expect(data.message).toBe("Hello Team!");
                done();
            });

            emitMessage(org._id, teamId, { message: "Hello Team!" });
        });

        it("should emit announcement deleted", (done) => {
            const announcementId = new mongoose.Types.ObjectId();
            
            clientSocket.on("announcement_deleted", (data) => {
                expect(data.announcementId.toString()).toBe(announcementId.toString());
                expect(data.hackathonId.toString()).toBe(hackathon._id.toString());
                done();
            });

            emitAnnouncementDeleted(org._id, announcementId, hackathon._id);
        });

        it("should emit announcement created", (done) => {
            const newAnnouncement = {
                _id: new mongoose.Types.ObjectId(),
                title: "New Announcement",
                message: "Test Message",
                hackathon: hackathon._id,
            };
            
            clientSocket.on("announcement_created", (data) => {
                expect(data.announcement.title).toBe("New Announcement");
                expect(data.hackathonId.toString()).toBe(hackathon._id.toString());
                done();
            });

            emitAnnouncementCreated(org._id, newAnnouncement, hackathon._id);
        });

        it("should emit announcement updated", (done) => {
            const announcementId = new mongoose.Types.ObjectId();
            
            clientSocket.on("announcement_updated", (data) => {
                expect(data.announcementId.toString()).toBe(announcementId.toString());
                expect(data.updates.title).toBe("Updated Title");
                done();
            });

            emitAnnouncementUpdated(org._id, announcementId, { title: "Updated Title" }, hackathon._id);
        });

        it("should emit notification to user", (done) => {
            const notification = {
                _id: new mongoose.Types.ObjectId(),
                title: "Test Notification",
                message: "Test Message",
                type: "announcement",
            };
            
            clientSocket.on("notification", (data) => {
                expect(data.notification.title).toBe("Test Notification");
                done();
            });

            emitNotification(testUser._id, notification);
        });
    });

    describe("Announcement Deletion via WebSocket", () => {
        beforeEach(async () => {
            // Create test announcement
            announcement = await Announcement.create({
                title: "Test Announcement",
                message: "Test Message",
                createdBy: testUser._id,
                organization: org._id,
                hackathon: hackathon._id,
            });
        });

        it("should delete announcement as creator", (done) => {
            const token = jwt.sign({ id: testUser._id }, JWT_SECRET);
            clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token },
            });

            clientSocket.on("connect", () => {
                clientSocket.on("announcement_deleted", (data) => {
                    expect(data.announcementId.toString()).toBe(announcement._id.toString());
                    done();
                });

                clientSocket.emit("delete_announcement", {
                    announcementId: announcement._id.toString(),
                    hackathonId: hackathon._id.toString(),
                });
            });
        });

        it("should delete announcement as admin", (done) => {
            const token = jwt.sign({ id: adminUser._id }, JWT_SECRET);
            clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token },
            });

            clientSocket.on("connect", () => {
                clientSocket.on("announcement_deleted", (data) => {
                    expect(data.announcementId.toString()).toBe(announcement._id.toString());
                    done();
                });

                clientSocket.emit("delete_announcement", {
                    announcementId: announcement._id.toString(),
                    hackathonId: hackathon._id.toString(),
                });
            });
        });

        it("should reject deletion without announcementId", (done) => {
            const token = jwt.sign({ id: testUser._id }, JWT_SECRET);
            clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token },
            });

            clientSocket.on("connect", () => {
                clientSocket.on("announcement_delete_error", (data) => {
                    expect(data.error).toBe("Announcement ID is required");
                    done();
                });

                clientSocket.emit("delete_announcement", {
                    hackathonId: hackathon._id.toString(),
                });
            });
        });

        it("should reject deletion for non-existent announcement", (done) => {
            const token = jwt.sign({ id: testUser._id }, JWT_SECRET);
            const fakeId = new mongoose.Types.ObjectId();
            
            clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token },
            });

            clientSocket.on("connect", () => {
                clientSocket.on("announcement_delete_error", (data) => {
                    expect(data.error).toBe("Announcement not found");
                    done();
                });

                clientSocket.emit("delete_announcement", {
                    announcementId: fakeId.toString(),
                    hackathonId: hackathon._id.toString(),
                });
            });
        });

        it("should reject deletion for different organization", (done) => {
            // Create another organization and user
            Organization.create({
                name: "Other Org",
                domain: "other.com",
                createdBy: new mongoose.Types.ObjectId(),
            }).then((otherOrg) => {
                return User.create({
                    name: "Other User",
                    email: "other@test.com",
                    googleId: "google-other",
                    role: "user",
                    organization: otherOrg._id,
                });
            }).then((otherUser) => {
                const token = jwt.sign({ id: otherUser._id }, JWT_SECRET);
                clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                    auth: { token },
                });

                clientSocket.on("connect", () => {
                    clientSocket.on("announcement_delete_error", (data) => {
                        expect(data.error).toContain("Organization mismatch");
                        done();
                    });

                    clientSocket.emit("delete_announcement", {
                        announcementId: announcement._id.toString(),
                        hackathonId: hackathon._id.toString(),
                    });
                });
            });
        });

        it("should reject deletion without permission", (done) => {
            // Create another user in same org
            User.create({
                name: "Other User Same Org",
                email: "otheruser@test.com",
                googleId: "google-other-same",
                role: "user",
                organization: org._id,
            }).then((otherUser) => {
                const token = jwt.sign({ id: otherUser._id }, JWT_SECRET);
                clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                    auth: { token },
                });

                clientSocket.on("connect", () => {
                    clientSocket.on("announcement_delete_error", (data) => {
                        expect(data.error).toContain("Permission denied");
                        done();
                    });

                    clientSocket.emit("delete_announcement", {
                        announcementId: announcement._id.toString(),
                        hackathonId: hackathon._id.toString(),
                    });
                });
            });
        });
    });

    describe("Room Joining", () => {
        it("should join user-specific room on connection", (done) => {
            const token = jwt.sign({ id: testUser._id }, JWT_SECRET);
            clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token },
            });

            clientSocket.on("connect", () => {
                // Verify by emitting to user room and receiving it
                clientSocket.on("notification", (data) => {
                    expect(data.notification.title).toBe("Room Test");
                    done();
                });

                emitNotification(testUser._id, { title: "Room Test" });
            });
        });

        it("should join organization room on connection", (done) => {
            const token = jwt.sign({ id: testUser._id }, JWT_SECRET);
            clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token },
            });

            clientSocket.on("connect", () => {
                clientSocket.on("hackathon_updated", (data) => {
                    expect(data.eventType).toBe("created");
                    done();
                });

                emitHackathonUpdate(org._id, "created", { title: "Org Test" });
            });
        });
    });

    describe("Disconnect", () => {
        it("should handle disconnect gracefully", (done) => {
            const token = jwt.sign({ id: testUser._id }, JWT_SECRET);
            clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token },
            });

            clientSocket.on("connect", () => {
                clientSocket.on("disconnect", () => {
                    expect(clientSocket.connected).toBe(false);
                    done();
                });
                clientSocket.disconnect();
            });
        });
    });

    describe("Edge Cases", () => {
        it("should handle announcement deletion with invalid ID format", (done) => {
            const token = jwt.sign({ id: testUser._id }, JWT_SECRET);
            clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                auth: { token },
            });

            clientSocket.on("connect", () => {
                clientSocket.on("announcement_delete_error", (data) => {
                    expect(data.error).toBeDefined();
                    done();
                });

                clientSocket.emit("delete_announcement", {
                    announcementId: "invalid-id-format",
                    hackathonId: hackathon._id.toString(),
                });
            });
        });

        it("should handle missing hackathonId in announcement", (done) => {
            // Create announcement with hackathon (required field)
            Announcement.create({
                title: "General Announcement",
                message: "Test Message",
                createdBy: testUser._id,
                organization: org._id,
                hackathon: hackathon._id, // Add required field
                author: testUser._id,
            }).then((announcement) => {
                const token = jwt.sign({ id: testUser._id }, JWT_SECRET);
                clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                    auth: { token },
                });

                clientSocket.on("connect", () => {
                    clientSocket.on("announcement_deleted", (data) => {
                        expect(data.announcementId.toString()).toBe(announcement._id.toString());
                        done();
                    });

                    clientSocket.emit("delete_announcement", {
                        announcementId: announcement._id.toString(),
                    });
                });
            });
        });

        it("should allow hackathon creator to delete their own announcement", (done) => {
            // Create hackathon creator user
            User.create({
                name: "Hackathon Creator",
                email: "creator@test.com",
                googleId: "google-creator",
                role: "hackathon_creator",
                organization: org._id,
            }).then((creatorUser) => {
                return Announcement.create({
                    title: "Creator Announcement",
                    message: "Test Message",
                    createdBy: creatorUser._id,
                    organization: org._id,
                }).then((announcement) => ({ creatorUser, announcement }));
            }).then(({ creatorUser, announcement }) => {
                const token = jwt.sign({ id: creatorUser._id }, JWT_SECRET);
                clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
                    auth: { token },
                });

                clientSocket.on("connect", () => {
                    clientSocket.on("announcement_deleted", (data) => {
                        expect(data.announcementId.toString()).toBe(announcement._id.toString());
                        done();
                    });

                    clientSocket.emit("delete_announcement", {
                        announcementId: announcement._id.toString(),
                    });
                });
            });
        });
    });
});

