import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import * as notificationService from "../notificationService.js";
import Notification from "../../models/Notification.js";
import User from "../../models/User.js";
import Team from "../../models/Team.js";
import Hackathon from "../../models/Hackathon.js";
import Round from "../../models/Round.js";
import Organization from "../../models/Organization.js";
import Idea from "../../models/Idea.js";
import { connectTestDb, closeTestDb } from "../../setup/testDb.js";
import mongoose from "mongoose";

// Mock socket.io functions
vi.mock("../../socket.js", () => ({
    emitNotification: vi.fn(),
}));

describe("NotificationService", () => {
    let org;
    let user1, user2, user3;
    let hackathon;
    let team;
    let round;
    let idea;

    beforeAll(async () => {
        await connectTestDb();
    });

    afterAll(async () => {
        await closeTestDb();
    });

    beforeEach(async () => {
        // Clear all collections
        await Notification.deleteMany({});
        await User.deleteMany({});
        await Team.deleteMany({});
        await Hackathon.deleteMany({});
        await Round.deleteMany({});
        await Organization.deleteMany({});
        await Idea.deleteMany({});

        // Clear socket mock calls
        vi.clearAllMocks();

        // Create test organization
        org = await Organization.create({
            name: "Test Org",
            domain: "test.com",
            createdBy: new mongoose.Types.ObjectId(),
        });

        // Create test users
        user1 = await User.create({
            name: "User 1",
            email: "user1@test.com",
            googleId: "google-1",
            role: "user",
            organization: org._id,
            notificationsEnabled: true,
        });

        user2 = await User.create({
            name: "User 2",
            email: "user2@test.com",
            googleId: "google-2",
            role: "user",
            organization: org._id,
            notificationsEnabled: true,
        });

        user3 = await User.create({
            name: "User 3 (Disabled Notifications)",
            email: "user3@test.com",
            googleId: "google-3",
            role: "user",
            organization: org._id,
            notificationsEnabled: false,
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

        // Create test idea
        idea = await Idea.create({
            title: "Test Idea",
            description: "Test Idea Description",
            createdBy: user1._id,
            organization: org._id,
            isPublic: false,
        });

        // Create test team
        team = await Team.create({
            name: "Test Team",
            hackathon: hackathon._id,
            members: [user1._id, user2._id],
            organization: org._id,
            idea: idea._id,
        });

        // Create test round
        round = await Round.create({
            name: "Round 1",
            hackathon: hackathon._id,
            startDate: new Date(Date.now() + 86400000),
            endDate: new Date(Date.now() + 86400000 * 2),
            status: "upcoming",
        });
    });

    describe("createNotification", () => {
        it("should create notification for user with notifications enabled", async () => {
            const notification = await notificationService.createNotification({
                userId: user1._id,
                type: "announcement",
                title: "Test Title",
                message: "Test Message",
                relatedEntity: { type: "hackathon", id: hackathon._id },
                organizationId: org._id,
            });

            expect(notification).toBeDefined();
            expect(notification.user.toString()).toBe(user1._id.toString());
            expect(notification.type).toBe("announcement");
            expect(notification.title).toBe("Test Title");
            expect(notification.message).toBe("Test Message");
            expect(notification.relatedEntity.type).toBe("hackathon");
            expect(notification.relatedEntity.id.toString()).toBe(hackathon._id.toString());
        });

        it("should NOT create notification for user with notifications disabled", async () => {
            const notification = await notificationService.createNotification({
                userId: user3._id,
                type: "announcement",
                title: "Test Title",
                message: "Test Message",
                relatedEntity: { type: "hackathon", id: hackathon._id },
                organizationId: org._id,
            });

            expect(notification).toBeNull();
        });

        it("should return null if user not found", async () => {
            const fakeUserId = new mongoose.Types.ObjectId();
            const notification = await notificationService.createNotification({
                userId: fakeUserId,
                type: "announcement",
                title: "Test Title",
                message: "Test Message",
                relatedEntity: { type: "hackathon", id: hackathon._id },
                organizationId: org._id,
            });

            expect(notification).toBeNull();
        });

        it("should default to enabled if notificationsEnabled is not set", async () => {
            // Create user without notificationsEnabled field
            const user4 = await User.create({
                name: "User 4",
                email: "user4@test.com",
                googleId: "google-4",
                role: "user",
                organization: org._id,
            });

            const notification = await notificationService.createNotification({
                userId: user4._id,
                type: "announcement",
                title: "Test Title",
                message: "Test Message",
                relatedEntity: { type: "hackathon", id: hackathon._id },
                organizationId: org._id,
            });

            expect(notification).toBeDefined();
            expect(notification.user.toString()).toBe(user4._id.toString());
        });

        it("should handle errors gracefully", async () => {
            // Force an error by passing invalid data
            const notification = await notificationService.createNotification({
                userId: "invalid-id",
                type: "announcement",
                title: "Test Title",
                message: "Test Message",
                relatedEntity: { type: "hackathon", id: hackathon._id },
                organizationId: org._id,
            });

            expect(notification).toBeNull();
        });
    });

    describe("createNotificationsForUsers", () => {
        it("should create notifications for multiple users", async () => {
            const notifications = await notificationService.createNotificationsForUsers(
                [user1._id, user2._id],
                {
                    type: "announcement",
                    title: "Test Title",
                    message: "Test Message",
                    relatedEntity: { type: "hackathon", id: hackathon._id },
                    organizationId: org._id,
                }
            );

            expect(notifications).toHaveLength(2);
            expect(notifications[0].user.toString()).toBe(user1._id.toString());
            expect(notifications[1].user.toString()).toBe(user2._id.toString());
        });

        it("should skip users with notifications disabled", async () => {
            const notifications = await notificationService.createNotificationsForUsers(
                [user1._id, user3._id],
                {
                    type: "announcement",
                    title: "Test Title",
                    message: "Test Message",
                    relatedEntity: { type: "hackathon", id: hackathon._id },
                    organizationId: org._id,
                }
            );

            expect(notifications).toHaveLength(1);
            expect(notifications[0].user.toString()).toBe(user1._id.toString());
        });

        it("should return empty array if all users not found", async () => {
            const fakeId1 = new mongoose.Types.ObjectId();
            const fakeId2 = new mongoose.Types.ObjectId();

            const notifications = await notificationService.createNotificationsForUsers(
                [fakeId1, fakeId2],
                {
                    type: "announcement",
                    title: "Test Title",
                    message: "Test Message",
                    relatedEntity: { type: "hackathon", id: hackathon._id },
                    organizationId: org._id,
                }
            );

            expect(notifications).toHaveLength(0);
        });

        it("should handle errors gracefully", async () => {
            const notifications = await notificationService.createNotificationsForUsers(
                ["invalid-id"],
                {
                    type: "announcement",
                    title: "Test Title",
                    message: "Test Message",
                    relatedEntity: { type: "hackathon", id: hackathon._id },
                    organizationId: org._id,
                }
            );

            expect(notifications).toHaveLength(0);
        });
    });

    describe("notifyNewHackathon", () => {
        it("should notify all users in organization about new hackathon", async () => {
            const notifications = await notificationService.notifyNewHackathon(
                hackathon,
                org._id
            );

            // Should create 2 notifications (user1 and user2, not user3 who has notifications disabled)
            expect(notifications.length).toBeGreaterThan(0);
            
            // Verify notification content
            const notification = notifications[0];
            expect(notification.type).toBe("new_hackathon");
            expect(notification.title).toBe("New Hackathon Available");
            expect(notification.message).toContain(hackathon.title);
            expect(notification.relatedEntity.type).toBe("hackathon");
            expect(notification.relatedEntity.id.toString()).toBe(hackathon._id.toString());
        });

        it("should handle errors gracefully", async () => {
            const notifications = await notificationService.notifyNewHackathon(
                { _id: "invalid-id", title: "Test" },
                org._id
            );

            expect(notifications).toHaveLength(0);
        });
    });

    describe("notifyHackathonUpdate", () => {
        it("should notify all organization users when participantsOnly=false", async () => {
            const notifications = await notificationService.notifyHackathonUpdate(
                hackathon,
                org._id,
                false
            );

            expect(notifications.length).toBeGreaterThan(0);
            
            const notification = notifications[0];
            expect(notification.type).toBe("hackathon_update");
            expect(notification.title).toBe("Hackathon Updated");
            expect(notification.message).toContain(hackathon.title);
        });

        it("should notify only participants when participantsOnly=true", async () => {
            const notifications = await notificationService.notifyHackathonUpdate(
                hackathon,
                org._id,
                true
            );

            expect(notifications.length).toBeGreaterThan(0);
            
            // Should only notify team members (user1 and user2)
            const userIds = notifications.map(n => n.user.toString());
            expect(userIds).toContain(user1._id.toString());
            expect(userIds).toContain(user2._id.toString());
        });

        it("should return empty array if no teams found", async () => {
            // Create hackathon with no teams
            const hackathon2 = await Hackathon.create({
                title: "Hackathon 2",
                description: "Test Description",
                organization: org._id,
                startDate: new Date(Date.now() + 86400000),
                endDate: new Date(Date.now() + 86400000 * 2),
                maxTeamSize: 5,
                minTeamSize: 2,
                status: "active",
            });

            const notifications = await notificationService.notifyHackathonUpdate(
                hackathon2,
                org._id,
                true
            );

            expect(notifications).toHaveLength(0);
        });

        it("should handle errors gracefully", async () => {
            const notifications = await notificationService.notifyHackathonUpdate(
                { _id: "invalid-id", title: "Test" },
                org._id,
                false
            );

            expect(notifications).toHaveLength(0);
        });
    });

    describe("notifyHackathonDeadline", () => {
        it("should notify participants about hackathon deadline", async () => {
            const deadlineDate = new Date(Date.now() + 86400000);
            const notifications = await notificationService.notifyHackathonDeadline(
                hackathon,
                "hackathon",
                deadlineDate,
                org._id
            );

            expect(notifications.length).toBeGreaterThan(0);
            
            const notification = notifications[0];
            expect(notification.type).toBe("hackathon_deadline");
            expect(notification.title).toBe("Deadline Reminder");
            expect(notification.message).toContain(hackathon.title);
            expect(notification.message).toContain("deadline");
        });

        it("should notify participants about round deadline", async () => {
            const deadlineDate = new Date(Date.now() + 86400000);
            const notifications = await notificationService.notifyHackathonDeadline(
                hackathon,
                "round",
                deadlineDate,
                org._id
            );

            expect(notifications.length).toBeGreaterThan(0);
            
            const notification = notifications[0];
            expect(notification.message).toContain("round deadline");
        });

        it("should return empty array if no teams found", async () => {
            const hackathon2 = await Hackathon.create({
                title: "Hackathon 2",
                description: "Test Description",
                organization: org._id,
                startDate: new Date(Date.now() + 86400000),
                endDate: new Date(Date.now() + 86400000 * 2),
                maxTeamSize: 5,
                minTeamSize: 2,
                status: "active",
            });

            const notifications = await notificationService.notifyHackathonDeadline(
                hackathon2,
                "hackathon",
                new Date(),
                org._id
            );

            expect(notifications).toHaveLength(0);
        });

        it("should handle errors gracefully", async () => {
            const notifications = await notificationService.notifyHackathonDeadline(
                { _id: "invalid-id", title: "Test" },
                "hackathon",
                new Date(),
                org._id
            );

            expect(notifications).toHaveLength(0);
        });
    });

    describe("notifyTeamMessage", () => {
        it("should notify all team members except sender", async () => {
            const notifications = await notificationService.notifyTeamMessage(
                team._id,
                user1._id,
                "Hello team!",
                org._id
            );

            expect(notifications).toHaveLength(1);
            expect(notifications[0].user.toString()).toBe(user2._id.toString());
            expect(notifications[0].type).toBe("team_message");
            expect(notifications[0].title).toContain(team.name);
            expect(notifications[0].message).toBe("Hello team!");
        });

        it("should truncate long messages", async () => {
            const longMessage = "a".repeat(100);
            const notifications = await notificationService.notifyTeamMessage(
                team._id,
                user1._id,
                longMessage,
                org._id
            );

            expect(notifications).toHaveLength(1);
            expect(notifications[0].message).toHaveLength(53); // 50 chars + "..."
            expect(notifications[0].message).toContain("...");
        });

        it("should notify mentor if exists", async () => {
            // Create mentor user
            const mentor = await User.create({
                name: "Mentor",
                email: "mentor@test.com",
                googleId: "google-mentor",
                role: "user",
                organization: org._id,
                notificationsEnabled: true,
            });

            // Update team with mentor
            team.mentor = mentor._id;
            await team.save();

            const notifications = await notificationService.notifyTeamMessage(
                team._id,
                user1._id,
                "Hello team!",
                org._id
            );

            // Should notify user2 and mentor (not user1 who is sender)
            expect(notifications).toHaveLength(2);
            const userIds = notifications.map(n => n.user.toString());
            expect(userIds).toContain(user2._id.toString());
            expect(userIds).toContain(mentor._id.toString());
        });

        it("should NOT notify mentor if mentor is the sender", async () => {
            const mentor = await User.create({
                name: "Mentor",
                email: "mentor@test.com",
                googleId: "google-mentor",
                role: "user",
                organization: org._id,
                notificationsEnabled: true,
            });

            team.mentor = mentor._id;
            await team.save();

            const notifications = await notificationService.notifyTeamMessage(
                team._id,
                mentor._id,
                "Hello team!",
                org._id
            );

            // Should only notify team members, not mentor (who is sender)
            expect(notifications.length).toBeGreaterThan(0);
            const userIds = notifications.map(n => n.user.toString());
            expect(userIds).not.toContain(mentor._id.toString());
        });

        it("should return empty array if team not found", async () => {
            const fakeTeamId = new mongoose.Types.ObjectId();
            const notifications = await notificationService.notifyTeamMessage(
                fakeTeamId,
                user1._id,
                "Hello!",
                org._id
            );

            expect(notifications).toHaveLength(0);
        });

        it("should handle errors gracefully", async () => {
            const notifications = await notificationService.notifyTeamMessage(
                "invalid-id",
                user1._id,
                "Hello!",
                org._id
            );

            expect(notifications).toHaveLength(0);
        });
    });

    describe("notifyRoundDeadline", () => {
        it("should notify participants about round deadline", async () => {
            const notifications = await notificationService.notifyRoundDeadline(
                round,
                hackathon,
                org._id
            );

            expect(notifications.length).toBeGreaterThan(0);
            
            const notification = notifications[0];
            expect(notification.type).toBe("round_deadline");
            expect(notification.title).toBe("Round Deadline Approaching");
            expect(notification.message).toContain(round.name);
            expect(notification.message).toContain(hackathon.title);
            expect(notification.relatedEntity.type).toBe("round");
            expect(notification.relatedEntity.id.toString()).toBe(round._id.toString());
        });

        it("should return empty array if no teams found", async () => {
            const hackathon2 = await Hackathon.create({
                title: "Hackathon 2",
                description: "Test Description",
                organization: org._id,
                startDate: new Date(Date.now() + 86400000),
                endDate: new Date(Date.now() + 86400000 * 2),
                maxTeamSize: 5,
                minTeamSize: 2,
                status: "active",
            });

            const round2 = await Round.create({
                name: "Round 2",
                hackathon: hackathon2._id,
                startDate: new Date(Date.now() + 86400000),
                endDate: new Date(Date.now() + 86400000 * 2),
                status: "upcoming",
            });

            const notifications = await notificationService.notifyRoundDeadline(
                round2,
                hackathon2,
                org._id
            );

            expect(notifications).toHaveLength(0);
        });

        it("should handle errors gracefully", async () => {
            const notifications = await notificationService.notifyRoundDeadline(
                { _id: "invalid-id", name: "Test" },
                { _id: "invalid-id", title: "Test" },
                org._id
            );

            expect(notifications).toHaveLength(0);
        });
    });

    describe("notifyHackathonAnnouncement", () => {
        it("should notify participants about announcement", async () => {
            const announcement = {
                _id: new mongoose.Types.ObjectId(),
                title: "Important Announcement",
                message: "This is an important announcement",
            };

            const notifications = await notificationService.notifyHackathonAnnouncement(
                announcement,
                hackathon._id,
                org._id
            );

            expect(notifications.length).toBeGreaterThan(0);
            
            const notification = notifications[0];
            expect(notification.type).toBe("announcement");
            expect(notification.title).toContain(announcement.title);
            expect(notification.message).toBe(announcement.message);
            expect(notification.relatedEntity.type).toBe("announcement");
            expect(notification.relatedEntity.id.toString()).toBe(announcement._id.toString());
        });

        it("should truncate long announcement messages", async () => {
            const announcement = {
                _id: new mongoose.Types.ObjectId(),
                title: "Important Announcement",
                message: "a".repeat(150),
            };

            const notifications = await notificationService.notifyHackathonAnnouncement(
                announcement,
                hackathon._id,
                org._id
            );

            expect(notifications.length).toBeGreaterThan(0);
            expect(notifications[0].message).toHaveLength(103); // 100 chars + "..."
            expect(notifications[0].message).toContain("...");
        });

        it("should return empty array if no teams found", async () => {
            const hackathon2 = await Hackathon.create({
                title: "Hackathon 2",
                description: "Test Description",
                organization: org._id,
                startDate: new Date(Date.now() + 86400000),
                endDate: new Date(Date.now() + 86400000 * 2),
                maxTeamSize: 5,
                minTeamSize: 2,
                status: "active",
            });

            const announcement = {
                _id: new mongoose.Types.ObjectId(),
                title: "Test",
                message: "Test message",
            };

            const notifications = await notificationService.notifyHackathonAnnouncement(
                announcement,
                hackathon2._id,
                org._id
            );

            expect(notifications).toHaveLength(0);
        });

        it("should handle errors gracefully", async () => {
            const notifications = await notificationService.notifyHackathonAnnouncement(
                { _id: "invalid-id", title: "Test", message: "Test" },
                "invalid-id",
                org._id
            );

            expect(notifications).toHaveLength(0);
        });
    });
});

