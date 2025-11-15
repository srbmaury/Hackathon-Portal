// controllers/__tests__/registrationController.test.js

// 1️⃣ Load dotenv and set env variables BEFORE anything else
import dotenv from "dotenv";
dotenv.config();
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "testsecret";
const JWT_SECRET = process.env.JWT_SECRET;

// 2️⃣ Imports after env setup
import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const app = require("../../app");

import { connectTestDb, clearDb, closeTestDb } from "../../setup/testDb.js";
import User from "../../models/User.js";
import Organization from "../../models/Organization.js";
import Hackathon from "../../models/Hackathon.js";
import Idea from "../../models/Idea.js";
import Team from "../../models/Team.js";
import HackathonRole from "../../models/HackathonRole.js";

describe("RegistrationController", () => {
    let org, participant1, participant2, organizer, hackathon, idea;
    let participantToken, organizerToken;

    beforeAll(async () => {
        await connectTestDb();

        // Create organization
        org = await Organization.create({
            name: "Test Org",
            domain: "testorg.com",
        });

        // Users
        organizer = await User.create({
            name: "Organizer User",
            email: "organizer@test.com",
            role: "hackathon_creator",
            organization: org._id,
            googleId: "google-org",
        });

        participant1 = await User.create({
            name: "User 1",
            email: "p1@test.com",
            role: "user",
            organization: org._id,
            googleId: "google-p1",
        });

        participant2 = await User.create({
            name: "User 2",
            email: "p2@test.com",
            role: "user",
            organization: org._id,
            googleId: "google-p2",
        });

        // Hackathon
        hackathon = await Hackathon.create({
            title: "AI Hack 2025",
            description: "AI-based challenge",
            organization: org._id,
            isActive: true,
            mnimumTeamSize: 1,
            maximumTeamSize: 5,
        });

        // Idea
        idea = await Idea.create({
            title: "Smart Chatbot",
            description: "AI-powered chatbot system",
            createdBy: participant1._id,
            organization: org._id,
        });

        // Tokens
        participantToken = jwt.sign(
            { id: participant1._id.toString(), role: "user", organization: org._id.toString() },
            JWT_SECRET
        );
        organizerToken = jwt.sign(
            { id: organizer._id.toString(), role: "hackathon_creator", organization: org._id.toString() },
            JWT_SECRET
        );
    });

    beforeEach(async () => {
        await clearDb([Team]);
    });

    afterAll(async () => {
        await closeTestDb();
    });

    // 1️⃣ Register a team successfully
    it("should register a team successfully", async () => {
        const res = await request(app)
            .post(`/api/register/${hackathon._id}/register`)
            .set("Authorization", `Bearer ${participantToken}`)
            .send({
                teamName: "AI Masters",
                ideaId: idea._id,
                memberIds: [participant1._id, participant2._id],
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.team.name).toBe("AI Masters");

        const teamInDb = await Team.findOne({ name: "AI Masters" });
        expect(teamInDb).toBeTruthy();
    });

    // 2️⃣ Fail if required fields are missing
    it("should fail if required fields are missing", async () => {
        const res = await request(app)
            .post(`/api/register/${hackathon._id}/register`)
            .set("Authorization", `Bearer ${participantToken}`)
            .send({
                ideaId: idea._id,
                memberIds: [participant1._id],
            });

        expect(res.statusCode).toBe(400);
    });

    // 3️⃣ Fail if hackathon not found
    it("should return 404 if hackathon not found", async () => {
        const fakeHackathonId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/register/${fakeHackathonId}/register`)
            .set("Authorization", `Bearer ${participantToken}`)
            .send({
                teamName: "Ghost Team",
                ideaId: idea._id,
                memberIds: [participant1._id],
            });

        expect(res.statusCode).toBe(404);
    });

    // 4️⃣ Fail if team size invalid
    it("should fail if team size exceeds max limit", async () => {
        const bigTeam = Array(6).fill(participant1._id);
        const res = await request(app)
            .post(`/api/register/${hackathon._id}/register`)
            .set("Authorization", `Bearer ${participantToken}`)
            .send({
                teamName: "Big Team",
                ideaId: idea._id,
                memberIds: bigTeam,
            });

        expect(res.statusCode).toBe(400);
    });

    // 5️⃣ Fail if idea not found
    it("should fail if idea not found", async () => {
        const fakeIdeaId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/register/${hackathon._id}/register`)
            .set("Authorization", `Bearer ${participantToken}`)
            .send({
                teamName: "IdeaLess Team",
                ideaId: fakeIdeaId,
                memberIds: [participant1._id],
            });

        expect(res.statusCode).toBe(404);
    });

    // 6️⃣ Prevent duplicate registration
    it("should prevent duplicate registration for same member", async () => {
        await Team.create({
            name: "Existing Team",
            idea: idea._id,
            members: [participant1._id],
            organization: org._id,
            hackathon: hackathon._id,
        });

        const res = await request(app)
            .post(`/api/register/${hackathon._id}/register`)
            .set("Authorization", `Bearer ${participantToken}`)
            .send({
                teamName: "Duplicate Team",
                ideaId: idea._id,
                memberIds: [participant1._id],
            });

        expect(res.statusCode).toBe(400);
    });

    // 7️⃣ Get all teams for hackathon (admin/organizer)
    it("should get all teams for hackathon", async () => {
        // The route uses roleCheck("organizer", "admin") which checks organization-level roles
        // So we need to make the organizer an admin, or use adminToken
        // Let's use adminUser instead
        const adminUser = await User.create({
            name: "Admin User",
            email: "admin@test.com",
            role: "admin",
            organization: org._id,
            googleId: "google-admin",
        });
        const adminToken = jwt.sign(
            { id: adminUser._id.toString(), role: "admin", organization: org._id.toString() },
            JWT_SECRET
        );

        await Team.create({
            name: "Test Team",
            idea: idea._id,
            members: [participant1._id],
            organization: org._id,
            hackathon: hackathon._id,
        });

        const res = await request(app)
            .get(`/api/register/${hackathon._id}/teams`)
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.teams.length).toBe(1);
    });

    // 8️⃣ Withdraw team (by member)
    it("should withdraw team successfully by member", async () => {
        const team = await Team.create({
            name: "Withdraw Team",
            idea: idea._id,
            members: [participant1._id],
            organization: org._id,
            hackathon: hackathon._id,
        });

        const res = await request(app)
            .delete(`/api/register/${hackathon._id}/teams/${team._id}`)
            .set("Authorization", `Bearer ${participantToken}`);

        expect(res.statusCode).toBe(200);
        expect(await Team.findById(team._id)).toBeNull();
    });

    // 9️⃣ Withdraw fails if team not found
    it("should return 404 if withdrawing non-existent team", async () => {
        const fakeTeamId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .delete(`/api/register/${hackathon._id}/teams/${fakeTeamId}`)
            .set("Authorization", `Bearer ${participantToken}`);

        expect(res.statusCode).toBe(404);
    });

    // 🔟 Withdraw fails if not authorized
    it("should forbid withdraw if not a member or organizer", async () => {
        const otherParticipant = await User.create({
            name: "Stranger",
            email: "stranger@test.com",
            role: "user",
            organization: org._id,
            googleId: "google-stranger",
        });
        const strangerToken = jwt.sign(
            { id: otherParticipant._id.toString(), role: "user", organization: org._id.toString() },
            JWT_SECRET
        );

        const team = await Team.create({
            name: "Protected Team",
            idea: idea._id,
            members: [participant1._id],
            organization: org._id,
            hackathon: hackathon._id,
        });

        const res = await request(app)
            .delete(`/api/register/${hackathon._id}/teams/${team._id}`)
            .set("Authorization", `Bearer ${strangerToken}`);

        expect(res.statusCode).toBe(403);
    });

    // 1️⃣1️⃣ Update team registration
    it("should update team registration successfully", async () => {
        const team = await Team.create({
            name: "Original Team",
            idea: idea._id,
            members: [participant1._id],
            leader: participant1._id,
            organization: org._id,
            hackathon: hackathon._id,
        });

        const newIdea = await Idea.create({
            title: "New Idea",
            description: "New idea description",
            createdBy: participant1._id,
            organization: org._id,
        });

        const res = await request(app)
            .put(`/api/register/${hackathon._id}/teams/${team._id}`)
            .set("Authorization", `Bearer ${participantToken}`)
            .send({
                teamName: "Updated Team",
                ideaId: newIdea._id,
                memberIds: [participant1._id, participant2._id],
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.team.name).toBe("Updated Team");

        const updatedTeam = await Team.findById(team._id);
        expect(updatedTeam.name).toBe("Updated Team");
        expect(updatedTeam.members).toHaveLength(2);
    });

    // 1️⃣2️⃣ Fail to update team if not leader
    it("should fail to update team if not leader or organizer", async () => {
        const team = await Team.create({
            name: "Protected Team",
            idea: idea._id,
            members: [participant1._id],
            leader: participant1._id,
            organization: org._id,
            hackathon: hackathon._id,
        });

        const otherUser = await User.create({
            name: "Other User",
            email: "other@test.com",
            role: "user",
            organization: org._id,
            googleId: "google-other",
        });

        const otherToken = jwt.sign(
            { id: otherUser._id.toString(), role: "user", organization: org._id.toString() },
            JWT_SECRET
        );

        const res = await request(app)
            .put(`/api/register/${hackathon._id}/teams/${team._id}`)
            .set("Authorization", `Bearer ${otherToken}`)
            .send({
                teamName: "Hacked Team",
                ideaId: idea._id,
                memberIds: [otherUser._id],
            });

        expect(res.statusCode).toBe(403);
    });

    // 1️⃣3️⃣ Fail to update team with invalid team size
    it("should fail to update team with invalid team size", async () => {
        const team = await Team.create({
            name: "Team to Update",
            idea: idea._id,
            members: [participant1._id],
            leader: participant1._id,
            organization: org._id,
            hackathon: hackathon._id,
        });

        const bigTeam = Array(6).fill(participant1._id);
        const res = await request(app)
            .put(`/api/register/${hackathon._id}/teams/${team._id}`)
            .set("Authorization", `Bearer ${participantToken}`)
            .send({
                teamName: "Big Team",
                ideaId: idea._id,
                memberIds: bigTeam,
            });

        expect(res.statusCode).toBe(400);
    });

    // 1️⃣4️⃣ Get my team for hackathon
    it("should get my team for a hackathon", async () => {
        const team = await Team.create({
            name: "My Team",
            idea: idea._id,
            members: [participant1._id],
            leader: participant1._id,
            organization: org._id,
            hackathon: hackathon._id,
        });

        const res = await request(app)
            .get(`/api/register/${hackathon._id}/my`)
            .set("Authorization", `Bearer ${participantToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.team).toBeTruthy();
        expect(res.body.team.name).toBe("My Team");
    });

    // 1️⃣5️⃣ Get all my teams
    it("should get all my teams across hackathons", async () => {
        const hackathon2 = await Hackathon.create({
            title: "Hackathon 2",
            description: "Second hackathon",
            organization: org._id,
            isActive: true,
            mnimumTeamSize: 1,
            maximumTeamSize: 5,
        });

        await Team.create({
            name: "Team 1",
            idea: idea._id,
            members: [participant1._id],
            leader: participant1._id,
            organization: org._id,
            hackathon: hackathon._id,
        });

        await Team.create({
            name: "Team 2",
            idea: idea._id,
            members: [participant1._id],
            leader: participant1._id,
            organization: org._id,
            hackathon: hackathon2._id,
        });

        const res = await request(app)
            .get("/api/register/my-teams")
            .set("Authorization", `Bearer ${participantToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.teams.length).toBeGreaterThanOrEqual(2);
    });

    // 1️⃣6️⃣ Get teams public endpoint
    it("should get teams via public endpoint", async () => {
        await Team.create({
            name: "Public Team",
            idea: idea._id,
            members: [participant1._id],
            leader: participant1._id,
            organization: org._id,
            hackathon: hackathon._id,
        });

        const res = await request(app)
            .get(`/api/register/${hackathon._id}/teams/public`)
            .set("Authorization", `Bearer ${participantToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.teams.length).toBeGreaterThanOrEqual(1);
    });

    // 1️⃣7️⃣ Fail to update team with mismatched hackathon
    it("should fail to update team with mismatched hackathon", async () => {
        const hackathon2 = await Hackathon.create({
            title: "Hackathon 2",
            description: "Second hackathon",
            organization: org._id,
            isActive: true,
            mnimumTeamSize: 1,
            maximumTeamSize: 5,
        });

        const team = await Team.create({
            name: "Team",
            idea: idea._id,
            members: [participant1._id],
            leader: participant1._id,
            organization: org._id,
            hackathon: hackathon._id,
        });

        const res = await request(app)
            .put(`/api/register/${hackathon2._id}/teams/${team._id}`)
            .set("Authorization", `Bearer ${participantToken}`)
            .send({
                teamName: "Updated",
                ideaId: idea._id,
                memberIds: [participant1._id],
            });

        expect(res.statusCode).toBe(400);
    });

    // 1️⃣8️⃣ Fail to update team with conflict (member already in another team)
    it("should fail to update team if member is already in another team", async () => {
        const team1 = await Team.create({
            name: "Team 1",
            idea: idea._id,
            members: [participant1._id],
            leader: participant1._id,
            organization: org._id,
            hackathon: hackathon._id,
        });

        const team2 = await Team.create({
            name: "Team 2",
            idea: idea._id,
            members: [participant2._id],
            leader: participant2._id,
            organization: org._id,
            hackathon: hackathon._id,
        });

        // Try to add participant2 to team1
        const res = await request(app)
            .put(`/api/register/${hackathon._id}/teams/${team1._id}`)
            .set("Authorization", `Bearer ${participantToken}`)
            .send({
                teamName: "Team 1",
                ideaId: idea._id,
                memberIds: [participant1._id, participant2._id],
            });

        expect(res.statusCode).toBe(400);
    });

    // 1️⃣9️⃣ Fail to update team with inactive hackathon
    it("should fail to update team for inactive hackathon", async () => {
        const inactiveHackathon = await Hackathon.create({
            title: "Inactive Hackathon",
            description: "Inactive",
            organization: org._id,
            isActive: false,
            mnimumTeamSize: 1,
            maximumTeamSize: 5,
        });

        const team = await Team.create({
            name: "Team",
            idea: idea._id,
            members: [participant1._id],
            leader: participant1._id,
            organization: org._id,
            hackathon: inactiveHackathon._id,
        });

        const res = await request(app)
            .put(`/api/register/${inactiveHackathon._id}/teams/${team._id}`)
            .set("Authorization", `Bearer ${participantToken}`)
            .send({
                teamName: "Updated",
                ideaId: idea._id,
                memberIds: [participant1._id],
            });

        expect(res.statusCode).toBe(400);
    });

    // 2️⃣0️⃣ Fail to withdraw non-existent team
    it("should fail to withdraw non-existent team", async () => {
        const fakeTeamId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .delete(`/api/register/${hackathon._id}/teams/${fakeTeamId}`)
            .set("Authorization", `Bearer ${participantToken}`);

        expect(res.statusCode).toBe(404);
    });

    // 2️⃣1️⃣ Fail to update non-existent team
    it("should fail to update non-existent team", async () => {
        const fakeTeamId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .put(`/api/register/${hackathon._id}/teams/${fakeTeamId}`)
            .set("Authorization", `Bearer ${participantToken}`)
            .send({
                teamName: "Updated",
                ideaId: idea._id,
                memberIds: [participant1._id],
            });

        expect(res.statusCode).toBe(404);
    });

    // 2️⃣2️⃣ Fail to update team with invalid idea
    it("should fail to update team with invalid idea", async () => {
        const team = await Team.create({
            name: "Team",
            idea: idea._id,
            members: [participant1._id],
            leader: participant1._id,
            organization: org._id,
            hackathon: hackathon._id,
        });

        const fakeIdeaId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .put(`/api/register/${hackathon._id}/teams/${team._id}`)
            .set("Authorization", `Bearer ${participantToken}`)
            .send({
                teamName: "Updated",
                ideaId: fakeIdeaId,
                memberIds: [participant1._id],
            });

        expect(res.statusCode).toBe(404);
    });
});
