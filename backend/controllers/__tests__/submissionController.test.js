// controllers/__tests__/submissionController.test.js

import { vi } from "vitest";
import { setupTestEnv, getApp, describe, it, beforeAll, afterAll, beforeEach, expect, request, connectTestDb, clearDb, closeTestDb } from "./helpers/testSetup.js";
import { setupBasicTestEnv, createTestHackathon, createTestRound, createTestIdea, createTestTeam, createTestUser, assignHackathonRole, generateToken } from "./helpers/testHelpers.js";
import { assertSuccess, assertCreated, assertForbidden, assertNotFound, assertBadRequest, assertAIResponse } from "./helpers/assertions.js";
import Submission from "../../models/Submission.js";

const JWT_SECRET = setupTestEnv();

// Mock upload middleware
vi.mock("../../middleware/upload.js", () => {
    const mockMulter = {
        single: (fieldName) => {
            return (req, res, next) => {
                req.file = {
                    fieldname: fieldName || "file",
                    originalname: "test-file.jpg",
                    encoding: "7bit",
                    mimetype: "image/jpeg",
                    path: "https://cloudinary.com/test-file.jpg",
                    filename: "test-file",
                    size: 1024,
                    cloudinary: {
                        secure_url: "https://cloudinary.com/test-file.jpg",
                        public_id: "test-file",
                    },
                };
                next();
            };
        },
    };
    return mockMulter;
});

const app = getApp();

describe("SubmissionController", () => {
    let org, adminUser, normalUser, organizer, judge, hackathon, round, team, idea;
    let adminToken, userToken, organizerToken, judgeToken;

    beforeAll(async () => {
        await connectTestDb();

        const env = await setupBasicTestEnv(JWT_SECRET);
        org = env.org;
        adminUser = env.adminUser;
        normalUser = env.normalUser;
        adminToken = env.adminToken;
        userToken = env.userToken;

        organizer = await createTestUser({
            name: "Organizer",
            email: "organizer@test.com",
            role: "hackathon_creator",
            organization: org._id,
            googleId: "google-organizer",
        });

        judge = await createTestUser({
            name: "Judge",
            email: "judge@test.com",
            role: "user",
            organization: org._id,
            googleId: "google-judge",
        });

        hackathon = await createTestHackathon({
            organization: org._id,
            createdBy: organizer._id,
            isActive: true,
        });

        round = await createTestRound({
            name: "Round 1",
            description: "First round",
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        hackathon.rounds.push(round._id);
        await hackathon.save();

        idea = await createTestIdea({
            submitter: normalUser._id,
            organization: org._id,
        });

        team = await createTestTeam({
            idea: idea._id,
            members: [normalUser._id],
            leader: normalUser._id,
            organization: org._id,
            hackathon: hackathon._id,
        });

        await assignHackathonRole(normalUser._id, hackathon._id, "participant", adminUser._id);
        await assignHackathonRole(organizer._id, hackathon._id, "organizer", adminUser._id);
        await assignHackathonRole(judge._id, hackathon._id, "judge", adminUser._id);

        organizerToken = generateToken(organizer._id, "hackathon_creator", org._id, JWT_SECRET);
        judgeToken = generateToken(judge._id, "user", org._id, JWT_SECRET);
    });

    beforeEach(async () => {
        await clearDb([Submission]);
    });

    afterAll(async () => {
        await closeTestDb();
    });

    describe("POST /api/submissions/:roundId", () => {
        it("should submit for a round successfully", async () => {
            const res = await request(app)
                .post(`/api/submissions/${round._id}`)
                .set("Authorization", `Bearer ${userToken}`)
                .send({ link: "https://github.com/test/repo" });

            assertCreated(res, "submission");
            expect(res.body.submission.link).toBe("https://github.com/test/repo");

            const dbSubmission = await Submission.findOne({ round: round._id, team: team._id });
            expect(dbSubmission).toBeTruthy();
        });

        it("should fail if round is not active", async () => {
            const inactiveRound = await createTestRound({
                name: "Inactive Round",
                description: "Inactive",
                isActive: false,
            });

            const res = await request(app)
                .post(`/api/submissions/${inactiveRound._id}`)
                .set("Authorization", `Bearer ${userToken}`)
                .send({ link: "https://github.com/test/repo" });

            assertBadRequest(res);
        });

        it("should update existing submission", async () => {
            await Submission.create({
                team: team._id,
                round: round._id,
                hackathon: hackathon._id,
                organization: org._id,
                link: "https://github.com/test/repo",
            });

            const res = await request(app)
                .post(`/api/submissions/${round._id}`)
                .set("Authorization", `Bearer ${userToken}`)
                .send({ link: "https://github.com/test/updated" });

            assertSuccess(res, "submission");
            expect(res.body.submission.link).toBe("https://github.com/test/updated");
        });
    });

    describe("GET /api/submissions/:roundId/my", () => {
        it("should get my submission for a round", async () => {
            await Submission.create({
                team: team._id,
                round: round._id,
                hackathon: hackathon._id,
                organization: org._id,
                link: "https://github.com/test/repo",
            });

            const res = await request(app)
                .get(`/api/submissions/${round._id}/my`)
                .set("Authorization", `Bearer ${userToken}`);

            assertSuccess(res, "submission");
            expect(res.body.submission.link).toBe("https://github.com/test/repo");
        });
    });

    describe("GET /api/submissions/:roundId/standings", () => {
        it("should get standings for a round", async () => {
            const team2 = await createTestTeam({
                name: "Team 2",
                idea: idea._id,
                members: [organizer._id],
                organization: org._id,
                hackathon: hackathon._id,
            });

            await Submission.create([
                {
                    team: team._id,
                    round: round._id,
                    hackathon: hackathon._id,
                    organization: org._id,
                    link: "https://github.com/test/repo1",
                    score: 85,
                },
                {
                    team: team2._id,
                    round: round._id,
                    hackathon: hackathon._id,
                    organization: org._id,
                    link: "https://github.com/test/repo2",
                    score: 90,
                },
            ]);

            const res = await request(app)
                .get(`/api/submissions/${round._id}/standings`)
                .set("Authorization", `Bearer ${userToken}`);

            assertSuccess(res, "standings");
            expect(res.body.standings).toHaveLength(2);
            expect(res.body.standings[0].score).toBe(90);
            expect(res.body.standings[1].score).toBe(85);
        });
    });

    describe("GET /api/submissions/:roundId/all", () => {
        it("should get all submissions for organizer", async () => {
            await Submission.create({
                team: team._id,
                round: round._id,
                hackathon: hackathon._id,
                organization: org._id,
                link: "https://github.com/test/repo",
            });

            const res = await request(app)
                .get(`/api/submissions/${round._id}/all`)
                .set("Authorization", `Bearer ${organizerToken}`);

            assertSuccess(res, "submissions");
            expect(res.body.submissions).toHaveLength(1);
        });

        it("should forbid for non-organizer/admin", async () => {
            const res = await request(app)
                .get(`/api/submissions/${round._id}/all`)
                .set("Authorization", `Bearer ${userToken}`);

            assertForbidden(res);
        });
    });

    describe("PUT /api/submissions/:id", () => {
        let submission;

        beforeEach(async () => {
            submission = await Submission.create({
                team: team._id,
                round: round._id,
                hackathon: hackathon._id,
                organization: org._id,
                link: "https://github.com/test/repo",
            });
        });

        it("should update submission feedback (organizer)", async () => {
            const res = await request(app)
                .put(`/api/submissions/${submission._id}`)
                .set("Authorization", `Bearer ${organizerToken}`)
                .send({ feedback: "Great work!" });

            assertSuccess(res, "submission");
            expect(res.body.submission.feedback).toBe("Great work!");
        });

        it("should update submission score and feedback (judge)", async () => {
            const res = await request(app)
                .put(`/api/submissions/${submission._id}`)
                .set("Authorization", `Bearer ${judgeToken}`)
                .send({
                    score: 95,
                    feedback: "Great work!",
                });

            assertSuccess(res, "submission");
            expect(res.body.submission.score).toBe(95);
            expect(res.body.submission.feedback).toBe("Great work!");
        });

        it("should forbid for regular user", async () => {
            const res = await request(app)
                .put(`/api/submissions/${submission._id}`)
                .set("Authorization", `Bearer ${userToken}`)
                .send({
                    score: 100,
                    feedback: "Perfect!",
                });

            assertForbidden(res);
        });
    });

    describe("POST /api/submissions/:roundId - Additional Cases", () => {
        it("should fail if round not started yet", async () => {
            const futureRound = await createTestRound({
                name: "Future Round",
                description: "Not started",
                startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                endDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
                isActive: true,
            });
            hackathon.rounds.push(futureRound._id);
            await hackathon.save();

            const res = await request(app)
                .post(`/api/submissions/${futureRound._id}`)
                .set("Authorization", `Bearer ${userToken}`)
                .send({ link: "https://github.com/test/repo" });

            assertBadRequest(res);
        });

        it("should fail if round already ended", async () => {
            const pastRound = await createTestRound({
                name: "Past Round",
                description: "Already ended",
                startDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
                endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
                isActive: true,
            });
            hackathon.rounds.push(pastRound._id);
            await hackathon.save();

            const res = await request(app)
                .post(`/api/submissions/${pastRound._id}`)
                .set("Authorization", `Bearer ${userToken}`)
                .send({ link: "https://github.com/test/repo" });

            assertBadRequest(res);
        });

        it("should fail if user not in any team", async () => {
            const nonTeamUser = await createTestUser({
                name: "No Team User",
                email: "noteam@test.com",
                role: "user",
                organization: org._id,
                googleId: "google-noteam",
            });
            const nonTeamToken = generateToken(nonTeamUser._id, "user", org._id, JWT_SECRET);

            const res = await request(app)
                .post(`/api/submissions/${round._id}`)
                .set("Authorization", `Bearer ${nonTeamToken}`)
                .send({ link: "https://github.com/test/repo" });

            assertNotFound(res);
        });

        it("should fail if round not found", async () => {
            const fakeRoundId = "507f1f77bcf86cd799439011";

            const res = await request(app)
                .post(`/api/submissions/${fakeRoundId}`)
                .set("Authorization", `Bearer ${userToken}`)
                .send({ link: "https://github.com/test/repo" });

            assertNotFound(res);
        });

        it("should create submission without link or file", async () => {
            const res = await request(app)
                .post(`/api/submissions/${round._id}`)
                .set("Authorization", `Bearer ${userToken}`)
                .send({});

            assertCreated(res, "submission");
            expect(res.body.submission.link).toBe("");
        });

        it("should update with empty link", async () => {
            await Submission.create({
                team: team._id,
                round: round._id,
                hackathon: hackathon._id,
                organization: org._id,
                link: "https://github.com/test/repo",
            });

            const res = await request(app)
                .post(`/api/submissions/${round._id}`)
                .set("Authorization", `Bearer ${userToken}`)
                .send({ link: "" });

            assertSuccess(res, "submission");
            expect(res.body.submission.link).toBe("");
        });
    });

    describe("GET /api/submissions/:roundId/my - Additional Cases", () => {
        it("should return null if user has no team", async () => {
            const nonTeamUser = await createTestUser({
                name: "No Team User 2",
                email: "noteam2@test.com",
                role: "user",
                organization: org._id,
                googleId: "google-noteam2",
            });
            const nonTeamToken = generateToken(nonTeamUser._id, "user", org._id, JWT_SECRET);

            const res = await request(app)
                .get(`/api/submissions/${round._id}/my`)
                .set("Authorization", `Bearer ${nonTeamToken}`);

            assertSuccess(res);
            expect(res.body.submission).toBeNull();
        });

        it("should handle hackathon not found", async () => {
            const orphanRound = await createTestRound({
                name: "Orphan Round",
                description: "No hackathon",
            });

            const res = await request(app)
                .get(`/api/submissions/${orphanRound._id}/my`)
                .set("Authorization", `Bearer ${userToken}`);

            assertNotFound(res);
        });

        it("should handle errors gracefully", async () => {
            const res = await request(app)
                .get("/api/submissions/invalid-id/my")
                .set("Authorization", `Bearer ${userToken}`);

            expect([400, 500]).toContain(res.statusCode);
        });
    });

    describe("GET /api/submissions/:roundId/standings - Additional Cases", () => {
        it("should hide scores when round.hideScores is true and user is regular participant", async () => {
            round.hideScores = true;
            await round.save();

            await Submission.create({
                team: team._id,
                round: round._id,
                hackathon: hackathon._id,
                organization: org._id,
                link: "https://github.com/test/repo",
                score: 85,
            });

            const res = await request(app)
                .get(`/api/submissions/${round._id}/standings`)
                .set("Authorization", `Bearer ${userToken}`);

            assertSuccess(res, "standings");
            expect(res.body.hideScores).toBe(true);
            expect(res.body.standings[0].score).toBeUndefined();
        });

        it("should show scores to organizer even when hideScores is true", async () => {
            round.hideScores = true;
            await round.save();

            await Submission.create({
                team: team._id,
                round: round._id,
                hackathon: hackathon._id,
                organization: org._id,
                link: "https://github.com/test/repo",
                score: 85,
            });

            const res = await request(app)
                .get(`/api/submissions/${round._id}/standings`)
                .set("Authorization", `Bearer ${organizerToken}`);

            assertSuccess(res, "standings");
            expect(res.body.standings[0].score).toBe(85);
        });

        it("should handle round not found", async () => {
            const fakeRoundId = "507f1f77bcf86cd799439011";

            const res = await request(app)
                .get(`/api/submissions/${fakeRoundId}/standings`)
                .set("Authorization", `Bearer ${userToken}`);

            assertNotFound(res);
        });

        it("should handle errors gracefully", async () => {
            const res = await request(app)
                .get("/api/submissions/invalid-id/standings")
                .set("Authorization", `Bearer ${userToken}`);

            expect([400, 500]).toContain(res.statusCode);
        });
    });

    describe("GET /api/submissions/:roundId/all - Additional Cases", () => {
        it("should allow judge to get all submissions", async () => {
            await Submission.create({
                team: team._id,
                round: round._id,
                hackathon: hackathon._id,
                organization: org._id,
                link: "https://github.com/test/repo",
            });

            const res = await request(app)
                .get(`/api/submissions/${round._id}/all`)
                .set("Authorization", `Bearer ${judgeToken}`);

            assertSuccess(res, "submissions");
            expect(res.body.submissions).toHaveLength(1);
        });

        it("should allow admin to get all submissions", async () => {
            await Submission.create({
                team: team._id,
                round: round._id,
                hackathon: hackathon._id,
                organization: org._id,
                link: "https://github.com/test/repo",
            });

            const res = await request(app)
                .get(`/api/submissions/${round._id}/all`)
                .set("Authorization", `Bearer ${adminToken}`);

            assertSuccess(res, "submissions");
            expect(res.body.submissions).toHaveLength(1);
        });

        it("should handle hackathon not found", async () => {
            const orphanRound = await createTestRound({
                name: "Orphan Round 2",
                description: "No hackathon",
            });

            const res = await request(app)
                .get(`/api/submissions/${orphanRound._id}/all`)
                .set("Authorization", `Bearer ${adminToken}`);

            assertNotFound(res);
        });

        it("should handle errors gracefully", async () => {
            const res = await request(app)
                .get("/api/submissions/invalid-id/all")
                .set("Authorization", `Bearer ${adminToken}`);

            expect([400, 500]).toContain(res.statusCode);
        });
    });

    describe("PUT /api/submissions/:id - Additional Cases", () => {
        let submission;

        beforeEach(async () => {
            submission = await Submission.create({
                team: team._id,
                round: round._id,
                hackathon: hackathon._id,
                organization: org._id,
                link: "https://github.com/test/repo",
            });
        });

        it("should allow admin to update score", async () => {
            const res = await request(app)
                .put(`/api/submissions/${submission._id}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ score: 100 });

            assertSuccess(res, "submission");
            expect(res.body.submission.score).toBe(100);
        });

        it("should forbid organizer from updating score", async () => {
            const res = await request(app)
                .put(`/api/submissions/${submission._id}`)
                .set("Authorization", `Bearer ${organizerToken}`)
                .send({ score: 90 });

            assertForbidden(res);
        });

        it("should handle submission not found", async () => {
            const fakeId = "507f1f77bcf86cd799439011";

            const res = await request(app)
                .put(`/api/submissions/${fakeId}`)
                .set("Authorization", `Bearer ${judgeToken}`)
                .send({ score: 95 });

            assertNotFound(res);
        });

        it("should handle hackathon not found", async () => {
            submission.hackathon = "507f1f77bcf86cd799439011";
            await submission.save();

            const res = await request(app)
                .put(`/api/submissions/${submission._id}`)
                .set("Authorization", `Bearer ${judgeToken}`)
                .send({ score: 95 });

            assertNotFound(res);
        });

        it("should handle errors gracefully", async () => {
            const res = await request(app)
                .put("/api/submissions/invalid-id")
                .set("Authorization", `Bearer ${judgeToken}`)
                .send({ score: 95 });

            expect([400, 500]).toContain(res.statusCode);
        });
    });

    describe("AI Features", () => {
        let submission;

        beforeEach(async () => {
            process.env.AI_ENABLED = "false";
            submission = await Submission.create({
                team: team._id,
                round: round._id,
                hackathon: hackathon._id,
                organization: org._id,
                link: "https://github.com/test/repo",
            });
        });

        it("should handle AI evaluation when disabled", async () => {
            const res = await request(app)
                .post(`/api/submissions/${submission._id}/evaluate`)
                .set("Authorization", `Bearer ${judgeToken}`);

            assertAIResponse(res);
        });

        it("should forbid regular user from evaluating", async () => {
            const res = await request(app)
                .post(`/api/submissions/${submission._id}/evaluate`)
                .set("Authorization", `Bearer ${userToken}`);

            assertForbidden(res);
        });

        it("should handle evaluate submission not found", async () => {
            const fakeId = "507f1f77bcf86cd799439011";

            const res = await request(app)
                .post(`/api/submissions/${fakeId}/evaluate`)
                .set("Authorization", `Bearer ${judgeToken}`);

            assertNotFound(res);
        });

        it("should handle evaluate hackathon not found", async () => {
            submission.hackathon = "507f1f77bcf86cd799439011";
            await submission.save();

            const res = await request(app)
                .post(`/api/submissions/${submission._id}/evaluate`)
                .set("Authorization", `Bearer ${judgeToken}`);

            assertNotFound(res);
        });

        it("should handle AI feedback generation", async () => {
            const res = await request(app)
                .post(`/api/submissions/${submission._id}/generate-feedback`)
                .set("Authorization", `Bearer ${judgeToken}`)
                .send({ score: 85 });

            assertAIResponse(res);
        });

        it("should forbid regular user from generating feedback", async () => {
            const res = await request(app)
                .post(`/api/submissions/${submission._id}/generate-feedback`)
                .set("Authorization", `Bearer ${userToken}`)
                .send({ score: 85 });

            assertForbidden(res);
        });

        it("should handle generate feedback submission not found", async () => {
            const fakeId = "507f1f77bcf86cd799439011";

            const res = await request(app)
                .post(`/api/submissions/${fakeId}/generate-feedback`)
                .set("Authorization", `Bearer ${judgeToken}`)
                .send({ score: 85 });

            assertNotFound(res);
        });

        it("should handle generate feedback hackathon not found", async () => {
            submission.hackathon = "507f1f77bcf86cd799439011";
            await submission.save();

            const res = await request(app)
                .post(`/api/submissions/${submission._id}/generate-feedback`)
                .set("Authorization", `Bearer ${judgeToken}`)
                .send({ score: 85 });

            assertNotFound(res);
        });

        it("should handle compare submissions", async () => {
            const res = await request(app)
                .get(`/api/submissions/${round._id}/compare`)
                .set("Authorization", `Bearer ${judgeToken}`);

            assertAIResponse(res);
        });

        it("should forbid regular user from comparing", async () => {
            const res = await request(app)
                .get(`/api/submissions/${round._id}/compare`)
                .set("Authorization", `Bearer ${userToken}`);

            assertForbidden(res);
        });

        it("should handle compare hackathon not found", async () => {
            const orphanRound = await createTestRound({
                name: "Orphan Round 3",
                description: "No hackathon",
            });

            const res = await request(app)
                .get(`/api/submissions/${orphanRound._id}/compare`)
                .set("Authorization", `Bearer ${judgeToken}`);

            assertNotFound(res);
        });

        it("should handle compare errors gracefully", async () => {
            const res = await request(app)
                .get("/api/submissions/invalid-id/compare")
                .set("Authorization", `Bearer ${judgeToken}`);

            expect([400, 500]).toContain(res.statusCode);
        });
    });
});
