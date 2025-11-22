// controllers/__tests__/registrationController.test.js

import { setupTestEnv, getApp, describe, it, beforeAll, afterAll, beforeEach, expect, request, mongoose, connectTestDb, clearDb, closeTestDb } from "./helpers/testSetup.js";
import { createTestOrg, createTestUser, createTestHackathon, createTestIdea, generateToken } from "./helpers/testHelpers.js";
import { assertSuccess, assertCreated, assertForbidden, assertBadRequest } from "./helpers/assertions.js";
import Team from "../../models/Team.js";

const JWT_SECRET = setupTestEnv();
const app = getApp();

describe("RegistrationController", () => {
    let org, participant1, participant2, organizer, admin, hackathon, idea;
    let participantToken, organizerToken, adminToken;

    beforeAll(async () => {
        await connectTestDb();

        org = await createTestOrg();

        organizer = await createTestUser({
            name: "Organizer User",
            email: "organizer@test.com",
            role: "hackathon_creator",
            organization: org._id,
            googleId: "google-org",
        });

        admin = await createTestUser({
            name: "Admin User",
            email: "admin@test.com",
            role: "admin",
            organization: org._id,
            googleId: "google-admin",
        });

        participant1 = await createTestUser({
            name: "User 1",
            email: "p1@test.com",
            role: "user",
            organization: org._id,
            googleId: "google-p1",
        });

        participant2 = await createTestUser({
            name: "User 2",
            email: "p2@test.com",
            role: "user",
            organization: org._id,
            googleId: "google-p2",
        });

        hackathon = await createTestHackathon({
            title: "AI Hack 2025",
            description: "AI-based challenge",
            organization: org._id,
            isActive: true,
            mnimumTeamSize: 1,
            maximumTeamSize: 5,
        });

        idea = await createTestIdea({
            title: "Smart Chatbot",
            description: "AI-powered chatbot system",
            createdBy: participant1._id,
            organization: org._id,
        });

        participantToken = generateToken(participant1._id, "user", org._id, JWT_SECRET);
        organizerToken = generateToken(organizer._id, "hackathon_creator", org._id, JWT_SECRET);
        adminToken = generateToken(admin._id, "admin", org._id, JWT_SECRET);
    });

    beforeEach(async () => {
        await clearDb([Team]);
    });

    afterAll(async () => {
        await closeTestDb();
    });

    describe("POST /api/register/:hackathonId/register", () => {
        it("should register team with idea successfully", async () => {
            const res = await request(app)
                .post(`/api/register/${hackathon._id}/register`)
                .set("Authorization", `Bearer ${participantToken}`)
                .send({
                    teamName: "Cool Team",
                    ideaId: idea._id.toString(),
                });

            assertCreated(res, "team");
            expect(res.body.team.name).toBe("Cool Team");

            const team = await Team.findOne({ name: "Cool Team" });
            expect(team).toBeTruthy();
            expect(team.members).toContainEqual(participant1._id);
        });

        it("should fail without required fields", async () => {
            const res = await request(app)
                .post(`/api/register/${hackathon._id}/register`)
                .set("Authorization", `Bearer ${participantToken}`)
                .send({ teamName: "" });

            assertBadRequest(res);
        });
    });

    describe("GET /api/register/:hackathonId/teams", () => {
        it("should get all teams for hackathon (organizer/admin)", async () => {
            await Team.create({
                name: "Team 1",
                hackathon: hackathon._id,
                idea: idea._id,
                leader: participant1._id,
                members: [participant1._id],
                organization: org._id,
            });

            const res = await request(app)
                .get(`/api/register/${hackathon._id}/teams`)
                .set("Authorization", `Bearer ${adminToken}`);

            assertSuccess(res, "teams");
            expect(res.body.teams).toHaveLength(1);
        });

        it("should return 404 for non-existent hackathon", async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .get(`/api/register/${fakeId}/teams`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(404);
        });

        it("should return 403 for wrong organization", async () => {
            const org2 = await createTestOrg("Other Org", "other.com");
            const hackathon2 = await createTestHackathon({
                title: "Other Hack",
                organization: org2._id,
                isActive: true,
            });

            const res = await request(app)
                .get(`/api/register/${hackathon2._id}/teams`)
                .set("Authorization", `Bearer ${adminToken}`);

            assertForbidden(res);
        });
    });

    describe("GET /api/register/:hackathonId/my", () => {
        it("should get current user's team", async () => {
            await Team.create({
                name: "My Team",
                hackathon: hackathon._id,
                idea: idea._id,
                leader: participant1._id,
                members: [participant1._id],
                organization: org._id,
            });

            const res = await request(app)
                .get(`/api/register/${hackathon._id}/my`)
                .set("Authorization", `Bearer ${participantToken}`);

            assertSuccess(res, "team");
            expect(res.body.team.name).toBe("My Team");
        });

        it("should return 404 if user has no team", async () => {
            const res = await request(app)
                .get(`/api/register/${hackathon._id}/my`)
                .set("Authorization", `Bearer ${participantToken}`);

            expect(res.statusCode).toBe(404);
        });
    });

    describe("GET /api/register/my-teams", () => {
        it("should get all teams for current user", async () => {
            await Team.create({
                name: "Team Alpha",
                hackathon: hackathon._id,
                idea: idea._id,
                leader: participant1._id,
                members: [participant1._id],
                organization: org._id,
            });

            const res = await request(app)
                .get("/api/register/my-teams")
                .set("Authorization", `Bearer ${participantToken}`);

            assertSuccess(res, "teams");
            expect(res.body.teams).toHaveLength(1);
        });
    });

    describe("POST /api/register/:hackathonId/register - Validation", () => {
        it("should return 404 for non-existent hackathon", async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post(`/api/register/${fakeId}/register`)
                .set("Authorization", `Bearer ${participantToken}`)
                .send({
                    teamName: "Test Team",
                    ideaId: idea._id.toString(),
                });

            expect(res.statusCode).toBe(404);
        });

        it("should return 403 for hackathon from different organization", async () => {
            const org2 = await createTestOrg("Other Org2", "other2.com");
            const hackathon2 = await createTestHackathon({
                title: "Other Hack2",
                organization: org2._id,
                isActive: true,
            });

            const res = await request(app)
                .post(`/api/register/${hackathon2._id}/register`)
                .set("Authorization", `Bearer ${participantToken}`)
                .send({
                    teamName: "Test Team",
                    ideaId: idea._id.toString(),
                });

            assertForbidden(res);
        });

        it("should return 400 for inactive hackathon", async () => {
            const inactiveHackathon = await createTestHackathon({
                title: "Inactive Hack",
                organization: org._id,
                isActive: false,
            });

            const res = await request(app)
                .post(`/api/register/${inactiveHackathon._id}/register`)
                .set("Authorization", `Bearer ${participantToken}`)
                .send({
                    teamName: "Test Team",
                    ideaId: idea._id.toString(),
                });

            assertBadRequest(res);
        });

        it("should return 400 for invalid team size", async () => {
            const tooManyMembers = [participant1._id, participant2._id];
            for (let i = 0; i < 8; i++) {
                tooManyMembers.push(new mongoose.Types.ObjectId());
            }
            
            const res = await request(app)
                .post(`/api/register/${hackathon._id}/register`)
                .set("Authorization", `Bearer ${participantToken}`)
                .send({
                    teamName: "Big Team",
                    ideaId: idea._id.toString(),
                    memberIds: tooManyMembers,
                });

            assertBadRequest(res);
        });

        it("should return 404 for non-existent idea", async () => {
            const fakeIdeaId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post(`/api/register/${hackathon._id}/register`)
                .set("Authorization", `Bearer ${participantToken}`)
                .send({
                    teamName: "Test Team",
                    ideaId: fakeIdeaId.toString(),
                });

            expect(res.statusCode).toBe(404);
        });

        it("should return 400 if member already registered", async () => {
            // Register first team
            await request(app)
                .post(`/api/register/${hackathon._id}/register`)
                .set("Authorization", `Bearer ${participantToken}`)
                .send({
                    teamName: "First Team",
                    ideaId: idea._id.toString(),
                });

            // Try to register again
            const res = await request(app)
                .post(`/api/register/${hackathon._id}/register`)
                .set("Authorization", `Bearer ${participantToken}`)
                .send({
                    teamName: "Second Team",
                    ideaId: idea._id.toString(),
                });

            assertBadRequest(res);
        });
    });

    describe("DELETE /api/register/:hackathonId/teams/:teamId", () => {
        let team;

        beforeEach(async () => {
            team = await Team.create({
                name: "Team to Delete",
                hackathon: hackathon._id,
                idea: idea._id,
                leader: participant1._id,
                members: [participant1._id],
                organization: org._id,
            });
        });

        it("should allow team member to withdraw", async () => {
            const res = await request(app)
                .delete(`/api/register/${hackathon._id}/teams/${team._id}`)
                .set("Authorization", `Bearer ${participantToken}`);

            assertSuccess(res);
            expect(await Team.findById(team._id)).toBeNull();
        });

        it("should allow admin to withdraw team", async () => {
            const res = await request(app)
                .delete(`/api/register/${hackathon._id}/teams/${team._id}`)
                .set("Authorization", `Bearer ${adminToken}`);

            assertSuccess(res);
        });

        it("should return 404 for non-existent team", async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .delete(`/api/register/${hackathon._id}/teams/${fakeId}`)
                .set("Authorization", `Bearer ${participantToken}`);

            expect(res.statusCode).toBe(404);
        });

        it("should return error for mismatched hackathon", async () => {
            const hackathon2 = await createTestHackathon({
                title: "Other Hack3",
                organization: org._id,
                isActive: true,
            });

            const res = await request(app)
                .delete(`/api/register/${hackathon2._id}/teams/${team._id}`)
                .set("Authorization", `Bearer ${participantToken}`);

            // Could be 400 (mismatch) or 404 (team not found in context of new hackathon)
            expect([400, 404]).toContain(res.statusCode);
        });

        it("should return error for non-member", async () => {
            const participant3Token = generateToken(participant2._id, "user", org._id, JWT_SECRET);
            const res = await request(app)
                .delete(`/api/register/${hackathon._id}/teams/${team._id}`)
                .set("Authorization", `Bearer ${participant3Token}`);

            // Could be 403 (forbidden) or 404 (not found)
            expect([403, 404]).toContain(res.statusCode);
        });
    });

    describe("PUT /api/register/:hackathonId/teams/:teamId", () => {
        let team;

        beforeEach(async () => {
            team = await Team.create({
                name: "Team to Update",
                hackathon: hackathon._id,
                idea: idea._id,
                leader: participant1._id,
                members: [participant1._id],
                organization: org._id,
            });
        });

        it("should allow team leader to update", async () => {
            const res = await request(app)
                .put(`/api/register/${hackathon._id}/teams/${team._id}`)
                .set("Authorization", `Bearer ${participantToken}`)
                .send({
                    teamName: "Updated Team",
                    ideaId: idea._id.toString(),
                    memberIds: [participant1._id],
                });

            assertSuccess(res, "team");
            expect(res.body.team.name).toBe("Updated Team");
        });

        it("should return 404 for non-existent team", async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .put(`/api/register/${hackathon._id}/teams/${fakeId}`)
                .set("Authorization", `Bearer ${participantToken}`)
                .send({
                    teamName: "Updated",
                    ideaId: idea._id.toString(),
                });

            expect(res.statusCode).toBe(404);
        });

        it("should return error for mismatched hackathon", async () => {
            const hackathon2 = await createTestHackathon({
                title: "Other Hack4",
                organization: org._id,
                isActive: true,
            });

            const res = await request(app)
                .put(`/api/register/${hackathon2._id}/teams/${team._id}`)
                .set("Authorization", `Bearer ${participantToken}`)
                .send({
                    teamName: "Updated",
                    ideaId: idea._id.toString(),
                });

            // Could be 400 (mismatch) or 404 (team not found)
            expect([400, 404]).toContain(res.statusCode);
        });

        it("should return error for non-leader", async () => {
            const participant3Token = generateToken(participant2._id, "user", org._id, JWT_SECRET);
            const res = await request(app)
                .put(`/api/register/${hackathon._id}/teams/${team._id}`)
                .set("Authorization", `Bearer ${participant3Token}`)
                .send({
                    teamName: "Updated",
                    ideaId: idea._id.toString(),
                    memberIds: [participant2._id],
                });

            // Could be 403 (forbidden) or 404 (not found)
            expect([403, 404]).toContain(res.statusCode);
        });

        it("should return error for inactive hackathon", async () => {
            // Modify existing hackathon to be inactive temporarily
            hackathon.isActive = false;
            await hackathon.save();

            const res = await request(app)
                .put(`/api/register/${hackathon._id}/teams/${team._id}`)
                .set("Authorization", `Bearer ${participantToken}`)
                .send({
                    teamName: "Updated",
                    ideaId: idea._id.toString(),
                    memberIds: [participant1._id],
                });

            // Could be 400 (validation) or 404 (not found)
            expect([400, 404]).toContain(res.statusCode);

            // Restore hackathon state
            hackathon.isActive = true;
            await hackathon.save();
        });

        it("should return 404 for non-existent idea", async () => {
            const fakeIdeaId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .put(`/api/register/${hackathon._id}/teams/${team._id}`)
                .set("Authorization", `Bearer ${participantToken}`)
                .send({
                    teamName: "Updated",
                    ideaId: fakeIdeaId.toString(),
                });

            expect(res.statusCode).toBe(404);
        });

        it("should return error for invalid team size", async () => {
            const largeTeamMembers = Array(10).fill(null).map(() => new mongoose.Types.ObjectId());
            
            const res = await request(app)
                .put(`/api/register/${hackathon._id}/teams/${team._id}`)
                .set("Authorization", `Bearer ${participantToken}`)
                .send({
                    teamName: "Updated",
                    ideaId: idea._id.toString(),
                    memberIds: largeTeamMembers,
                });

            // Should return error (400 for validation or 404 if user lookup fails)
            expect([400, 404]).toContain(res.statusCode);
        });

        it("should validate member conflicts when updating team", async () => {
            // Create another team with participant2 using the same idea
            const otherTeam = await Team.create({
                name: "Other Team",
                hackathon: hackathon._id,
                idea: idea._id,
                leader: participant2._id,
                members: [participant2._id],
                organization: org._id,
            });

            // Verify both teams exist
            expect(await Team.findById(team._id)).toBeTruthy();
            expect(await Team.findById(otherTeam._id)).toBeTruthy();

            // Try to add participant2 to team (who is already in another team)
            const res = await request(app)
                .put(`/api/register/${hackathon._id}/teams/${team._id}`)
                .set("Authorization", `Bearer ${participantToken}`)
                .send({
                    teamName: "Updated",
                    ideaId: idea._id.toString(),
                    memberIds: [participant1._id, participant2._id],
                });

            // Should return error (400 for already registered or 404 for user not found)
            expect([400, 404]).toContain(res.statusCode);
        });
    });
});
