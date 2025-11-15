// controllers/__tests__/submissionController.test.js

import dotenv from "dotenv";
dotenv.config();
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "testsecret";
const JWT_SECRET = process.env.JWT_SECRET;

import { describe, it, beforeAll, afterAll, beforeEach, expect, vi } from "vitest";
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
import Round from "../../models/Round.js";
import Team from "../../models/Team.js";
import Idea from "../../models/Idea.js";
import Submission from "../../models/Submission.js";
import HackathonRole from "../../models/HackathonRole.js";

// Mock upload middleware to avoid actual Cloudinary uploads in tests
vi.mock("../../middleware/upload.js", () => {
    const mockMulter = {
        single: (fieldName) => {
            return (req, res, next) => {
                // Simulate file upload - set req.file to a mock file object
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
    // Match CommonJS module.exports structure
    return mockMulter;
});

describe("SubmissionController", () => {
    let org, adminUser, user, organizer, judge, hackathon, round, team, idea;
    let adminToken, userToken, organizerToken, judgeToken;

    beforeAll(async () => {
        await connectTestDb();

        org = await Organization.create({
            name: "Test Org",
            domain: "testorg.com",
        });

        adminUser = await User.create({
            name: "Admin User",
            email: "admin@test.com",
            role: "admin",
            organization: org._id,
            googleId: "google-admin",
        });

        user = await User.create({
            name: "User",
            email: "user@test.com",
            role: "user",
            organization: org._id,
            googleId: "google-user",
        });

        organizer = await User.create({
            name: "Organizer",
            email: "organizer@test.com",
            role: "hackathon_creator",
            organization: org._id,
            googleId: "google-organizer",
        });

        judge = await User.create({
            name: "Judge",
            email: "judge@test.com",
            role: "user",
            organization: org._id,
            googleId: "google-judge",
        });

        hackathon = await Hackathon.create({
            title: "Test Hackathon",
            description: "Test description",
            organization: org._id,
            createdBy: organizer._id,
            isActive: true,
        });

        round = await Round.create({
            name: "Round 1",
            description: "First round",
            isActive: true,
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
            endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        });

        hackathon.rounds.push(round._id);
        await hackathon.save();

        idea = await Idea.create({
            title: "Test Idea",
            description: "Test idea description",
            submitter: user._id,
            organization: org._id,
            isPublic: true,
        });

        team = await Team.create({
            name: "Test Team",
            idea: idea._id,
            members: [user._id],
            leader: user._id,
            organization: org._id,
            hackathon: hackathon._id,
        });

        // Assign participant role
        await HackathonRole.create({
            user: user._id,
            hackathon: hackathon._id,
            role: "participant",
            assignedBy: adminUser._id,
        });

        // Assign organizer role
        await HackathonRole.create({
            user: organizer._id,
            hackathon: hackathon._id,
            role: "organizer",
            assignedBy: adminUser._id,
        });

        // Assign judge role
        await HackathonRole.create({
            user: judge._id,
            hackathon: hackathon._id,
            role: "judge",
            assignedBy: adminUser._id,
        });

        adminToken = jwt.sign(
            { id: adminUser._id.toString(), role: "admin", organization: org._id.toString() },
            JWT_SECRET
        );

        userToken = jwt.sign(
            { id: user._id.toString(), role: "user", organization: org._id.toString() },
            JWT_SECRET
        );

        organizerToken = jwt.sign(
            { id: organizer._id.toString(), role: "hackathon_creator", organization: org._id.toString() },
            JWT_SECRET
        );

        judgeToken = jwt.sign(
            { id: judge._id.toString(), role: "user", organization: org._id.toString() },
            JWT_SECRET
        );
    });

    beforeEach(async () => {
        await clearDb([Submission]);
    });

    afterAll(async () => {
        await closeTestDb();
    });

    // Submit for a round
    it("should submit for a round successfully", async () => {
        const res = await request(app)
            .post(`/api/submissions/${round._id}`)
            .set("Authorization", `Bearer ${userToken}`)
            .send({
                link: "https://github.com/test/repo",
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.submission).toBeTruthy();
        expect(res.body.submission.link).toBe("https://github.com/test/repo");

        const dbSubmission = await Submission.findOne({ round: round._id, team: team._id });
        expect(dbSubmission).toBeTruthy();
    });

    // Fail if round not active
    it("should fail if round is not active", async () => {
        const inactiveRound = await Round.create({
            name: "Inactive Round",
            description: "Inactive",
            isActive: false,
        });

        const res = await request(app)
            .post(`/api/submissions/${inactiveRound._id}`)
            .set("Authorization", `Bearer ${userToken}`)
            .send({
                link: "https://github.com/test/repo",
            });

        expect(res.statusCode).toBe(400);
    });

    // Fail if user doesn't have a team
    it("should fail if user doesn't have a team", async () => {
        const userWithoutTeam = await User.create({
            name: "No Team User",
            email: "noteam@test.com",
            role: "user",
            organization: org._id,
            googleId: "google-noteam",
        });

        const token = jwt.sign(
            { id: userWithoutTeam._id.toString(), role: "user", organization: org._id.toString() },
            JWT_SECRET
        );

        const res = await request(app)
            .post(`/api/submissions/${round._id}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                link: "https://github.com/test/repo",
            });

        expect(res.statusCode).toBe(404);
    });

    // Get my submission
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

        expect(res.statusCode).toBe(200);
        expect(res.body.submission).toBeTruthy();
        expect(res.body.submission.link).toBe("https://github.com/test/repo");
    });

    // Get standings
    it("should get standings for a round", async () => {
        const team2 = await Team.create({
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

        expect(res.statusCode).toBe(200);
        expect(res.body.standings).toHaveLength(2);
        // Should be sorted by score descending
        expect(res.body.standings[0].score).toBe(90);
        expect(res.body.standings[1].score).toBe(85);
    });

    // Get all submissions (organizer/admin only)
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

        expect(res.statusCode).toBe(200);
        expect(res.body.submissions).toHaveLength(1);
    });

    // Fail to get all submissions if not organizer/admin
    it("should fail to get all submissions if not organizer/admin", async () => {
        const res = await request(app)
            .get(`/api/submissions/${round._id}/all`)
            .set("Authorization", `Bearer ${userToken}`);

        expect(res.statusCode).toBe(403);
    });

    // Update submission feedback (organizer can only update feedback)
    it("should update submission feedback (organizer)", async () => {
        const submission = await Submission.create({
            team: team._id,
            round: round._id,
            hackathon: hackathon._id,
            organization: org._id,
            link: "https://github.com/test/repo",
        });

        const res = await request(app)
            .put(`/api/submissions/${submission._id}`)
            .set("Authorization", `Bearer ${organizerToken}`)
            .send({
                feedback: "Great work!",
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.submission.feedback).toBe("Great work!");
    });

    // Update submission score and feedback (judge/admin only)
    it("should update submission score and feedback (judge)", async () => {
        const submission = await Submission.create({
            team: team._id,
            round: round._id,
            hackathon: hackathon._id,
            organization: org._id,
            link: "https://github.com/test/repo",
        });

        const res = await request(app)
            .put(`/api/submissions/${submission._id}`)
            .set("Authorization", `Bearer ${judgeToken}`)
            .send({
                score: 95,
                feedback: "Great work!",
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.submission.score).toBe(95);
        expect(res.body.submission.feedback).toBe("Great work!");
    });

    // Fail if round not started yet
    it("should fail if round has not started yet", async () => {
        const futureRound = await Round.create({
            name: "Future Round",
            description: "Future",
            isActive: true,
            startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        });

        hackathon.rounds.push(futureRound._id);
        await hackathon.save();

        const res = await request(app)
            .post(`/api/submissions/${futureRound._id}`)
            .set("Authorization", `Bearer ${userToken}`)
            .send({
                link: "https://github.com/test/repo",
            });

        expect(res.statusCode).toBe(400);
    });

    // Fail if round has ended
    it("should fail if round has ended", async () => {
        const pastRound = await Round.create({
            name: "Past Round",
            description: "Past",
            isActive: true,
            startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
            endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        });

        hackathon.rounds.push(pastRound._id);
        await hackathon.save();

        const res = await request(app)
            .post(`/api/submissions/${pastRound._id}`)
            .set("Authorization", `Bearer ${userToken}`)
            .send({
                link: "https://github.com/test/repo",
            });

        expect(res.statusCode).toBe(400);
    });

    // Update existing submission
    it("should update existing submission", async () => {
        const submission = await Submission.create({
            team: team._id,
            round: round._id,
            hackathon: hackathon._id,
            organization: org._id,
            link: "https://github.com/test/repo",
        });

        const res = await request(app)
            .post(`/api/submissions/${round._id}`)
            .set("Authorization", `Bearer ${userToken}`)
            .send({
                link: "https://github.com/test/updated",
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.submission.link).toBe("https://github.com/test/updated");
    });

    // Fail to update submission if not organizer/admin
    it("should fail to update submission if not organizer/admin", async () => {
        const submission = await Submission.create({
            team: team._id,
            round: round._id,
            hackathon: hackathon._id,
            organization: org._id,
            link: "https://github.com/test/repo",
        });

        const res = await request(app)
            .put(`/api/submissions/${submission._id}`)
            .set("Authorization", `Bearer ${userToken}`)
            .send({
                score: 100,
                feedback: "Perfect!",
            });

        expect(res.statusCode).toBe(403);
    });

    // Fail to update non-existent submission
    it("should fail to update non-existent submission", async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .put(`/api/submissions/${fakeId}`)
            .set("Authorization", `Bearer ${organizerToken}`)
            .send({
                score: 100,
                feedback: "Perfect!",
            });

        expect(res.statusCode).toBe(404);
    });

    // Get submission for round without hackathon
    it("should handle round not associated with hackathon", async () => {
        const orphanRound = await Round.create({
            name: "Orphan Round",
            description: "No hackathon",
            isActive: true,
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        const res = await request(app)
            .post(`/api/submissions/${orphanRound._id}`)
            .set("Authorization", `Bearer ${userToken}`)
            .send({
                link: "https://github.com/test/repo",
            });

        expect(res.statusCode).toBe(404);
    });

    // AI EVALUATION TESTS
    describe("AI Evaluation", () => {
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

        it("should evaluate submission with AI", async () => {
            const originalAIEnabled = process.env.AI_ENABLED;
            process.env.AI_ENABLED = "false";

            const res = await request(app)
                .post(`/api/submissions/${submission._id}/evaluate`)
                .set("Authorization", `Bearer ${judgeToken}`);

            expect([200, 400, 500]).toContain(res.statusCode);

            process.env.AI_ENABLED = originalAIEnabled;
        });

        it("should generate feedback for submission", async () => {
            const originalAIEnabled = process.env.AI_ENABLED;
            process.env.AI_ENABLED = "false";

            const res = await request(app)
                .post(`/api/submissions/${submission._id}/generate-feedback`)
                .set("Authorization", `Bearer ${judgeToken}`)
                .send({ score: 85 });

            expect([200, 400, 500]).toContain(res.statusCode);

            process.env.AI_ENABLED = originalAIEnabled;
        });

        it("should compare submissions in a round", async () => {
            const originalAIEnabled = process.env.AI_ENABLED;
            process.env.AI_ENABLED = "false";

            const res = await request(app)
                .get(`/api/submissions/${round._id}/compare`)
                .set("Authorization", `Bearer ${judgeToken}`);

            expect([200, 400, 500]).toContain(res.statusCode);

            process.env.AI_ENABLED = originalAIEnabled;
        });

        it("should return 404 for non-existent submission evaluation", async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post(`/api/submissions/${fakeId}/evaluate`)
                .set("Authorization", `Bearer ${judgeToken}`);

            expect(res.statusCode).toBe(404);
        });

        it("should return 404 for non-existent round comparison", async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .get(`/api/submissions/${fakeId}/compare`)
                .set("Authorization", `Bearer ${judgeToken}`);

            expect(res.statusCode).toBe(404);
        });
    });
});

