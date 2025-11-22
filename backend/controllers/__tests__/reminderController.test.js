// controllers/__tests__/reminderController.test.js

import { setupTestEnv, getApp, describe, it, beforeAll, afterAll, beforeEach, expect, request, connectTestDb, clearDb, closeTestDb } from "./helpers/testSetup.js";
import { setupHackathonTestEnv, createTestIdea, createTestTeam, assignHackathonRole, createTestUser, generateToken } from "./helpers/testHelpers.js";
import { assertSuccess, assertForbidden } from "./helpers/assertions.js";
import Message from "../../models/Message.js";
import Submission from "../../models/Submission.js";
import Round from "../../models/Round.js";

const JWT_SECRET = setupTestEnv();
const app = getApp();

describe("ReminderController", () => {
    let org, adminUser, normalUser, organizer, hackathon, team, round;
    let adminToken, userToken, organizerToken;

    beforeAll(async () => {
        await connectTestDb();

        const env = await setupHackathonTestEnv(JWT_SECRET);
        org = env.org;
        adminUser = env.adminUser;
        normalUser = env.normalUser;
        organizer = env.organizer;
        hackathon = env.hackathon;
        adminToken = env.adminToken;
        userToken = env.userToken;
        organizerToken = env.organizerToken;

        round = await Round.create({
            name: "Round 1",
            description: "First round",
            isActive: true,
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        hackathon.rounds.push(round._id);
        await hackathon.save();

        const idea = await createTestIdea({
            submitter: normalUser._id,
            organization: org._id,
        });

        team = await createTestTeam({
            hackathon: hackathon._id,
            idea: idea._id,
            members: [normalUser._id],
            organization: org._id,
        });

        await assignHackathonRole(normalUser._id, hackathon._id, "participant", adminUser._id);
    }, 30000);

    beforeEach(async () => {
        await clearDb([Message, Submission]);
    });

    afterAll(async () => {
        await closeTestDb();
    });

    describe("GET /api/reminders/team/:teamId/round/:roundId", () => {
        it("should analyze team risk for team member", async () => {
            const res = await request(app)
                .get(`/api/reminders/team/${team._id}/round/${round._id}`)
                .set("Authorization", `Bearer ${userToken}`);

            assertSuccess(res);
            expect(res.body).toHaveProperty("analysis");
            expect(res.body.analysis).toHaveProperty("riskScore");
        }, 10000);

        it("should analyze team risk for admin", async () => {
            const res = await request(app)
                .get(`/api/reminders/team/${team._id}/round/${round._id}`)
                .set("Authorization", `Bearer ${adminToken}`);

            assertSuccess(res);
            expect(res.body).toHaveProperty("analysis");
            expect(res.body.analysis).toHaveProperty("riskScore");
        }, 10000);

        it("should forbid unauthorized user", async () => {
            const outsider = await createTestUser({
                name: "Outsider",
                email: "outsider@test.com",
                role: "user",
                organization: org._id,
                googleId: "google-outsider",
            });

            const outsiderToken = generateToken(outsider._id, "user", org._id, JWT_SECRET);

            const res = await request(app)
                .get(`/api/reminders/team/${team._id}/round/${round._id}`)
                .set("Authorization", `Bearer ${outsiderToken}`);

            assertForbidden(res);
        }, 10000);
    });

    describe("GET /api/reminders/round/:roundId/at-risk", () => {
        it("should get at-risk teams for organizer", async () => {
            const res = await request(app)
                .get(`/api/reminders/round/${round._id}/at-risk`)
                .set("Authorization", `Bearer ${organizerToken}`);

            assertSuccess(res, "atRiskTeams");
            expect(Array.isArray(res.body.atRiskTeams)).toBe(true);
        }, 30000); // Increased timeout for AI processing

        it("should get at-risk teams for admin", async () => {
            const res = await request(app)
                .get(`/api/reminders/round/${round._id}/at-risk`)
                .set("Authorization", `Bearer ${adminToken}`);

            assertSuccess(res, "atRiskTeams");
        }, 30000); // Increased timeout for AI processing

        it("should forbid for regular user", async () => {
            const res = await request(app)
                .get(`/api/reminders/round/${round._id}/at-risk`)
                .set("Authorization", `Bearer ${userToken}`);

            assertForbidden(res);
        }, 10000);
    });

    describe("POST /api/reminders/team/:teamId/round/:roundId/send", () => {
        it("should send reminder for organizer", async () => {
            const res = await request(app)
                .post(`/api/reminders/team/${team._id}/round/${round._id}/send`)
                .set("Authorization", `Bearer ${organizerToken}`)
                .send({
                    message: "Please submit your work!",
                });

            assertSuccess(res);
        }, 15000);

        it("should forbid for regular user", async () => {
            const res = await request(app)
                .post(`/api/reminders/team/${team._id}/round/${round._id}/send`)
                .set("Authorization", `Bearer ${userToken}`)
                .send({
                    message: "Test reminder",
                });

            assertForbidden(res);
        }, 10000);
    });
});
