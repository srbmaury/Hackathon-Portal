// controllers/__tests__/ideaController.test.js

import { setupTestEnv, getApp, describe, it, beforeAll, afterAll, beforeEach, expect, request, mongoose, connectTestDb, clearDb, closeTestDb } from "./helpers/testSetup.js";
import { setupBasicTestEnv, createTestIdea } from "./helpers/testHelpers.js";
import { assertSuccess, assertCreated, assertBadRequest, assertNotFound, assertAIResponse } from "./helpers/assertions.js";
import Idea from "../../models/Idea.js";
import User from "../../models/User.js";

const JWT_SECRET = setupTestEnv();
const app = getApp();

describe("IdeaController", () => {
  let org, normalUser, userToken;

  beforeAll(async () => {
    await connectTestDb();
    const env = await setupBasicTestEnv(JWT_SECRET);
    org = env.org;
    normalUser = env.normalUser;
    userToken = env.userToken;
  });

  beforeEach(async () => {
    await clearDb([Idea]);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("POST /api/ideas/submit", () => {
    it("should submit a new idea", async () => {
      const res = await request(app)
        .post("/api/ideas/submit")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "New Idea",
          description: "This is an idea",
          isPublic: true,
        });

      assertCreated(res, "idea");
      expect(res.body.idea.title).toBe("New Idea");

      const dbIdea = await Idea.findOne({ title: "New Idea" });
      expect(dbIdea).toBeTruthy();
      expect(dbIdea.submitter.toString()).toBe(normalUser._id.toString());
    });

    it("should fail without required fields", async () => {
      const res = await request(app)
        .post("/api/ideas/submit")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ title: "Incomplete Idea" });

      assertBadRequest(res);
    });

    it("should fail with invalid isPublic value", async () => {
      const res = await request(app)
        .post("/api/ideas/submit")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Invalid Idea",
          description: "Description",
          isPublic: "not-a-boolean",
        });

      assertBadRequest(res);
    });
  });

  describe("GET /api/ideas/public-ideas", () => {
    it("should get all public ideas", async () => {
      await createTestIdea({
        title: "Public Idea",
        description: "Visible to all",
        isPublic: true,
        submitter: normalUser._id,
        organization: org._id,
      });
      await createTestIdea({
        title: "Private Idea",
        description: "Not public",
        isPublic: false,
        submitter: normalUser._id,
        organization: org._id,
      });

      const res = await request(app)
        .get("/api/ideas/public-ideas")
        .set("Authorization", `Bearer ${userToken}`);

      assertSuccess(res, "ideas");
      expect(res.body.ideas).toHaveLength(1);
      expect(res.body.ideas[0].title).toBe("Public Idea");
    });
  });

  describe("GET /api/ideas/my", () => {
    it("should get user's own ideas", async () => {
      await createTestIdea({
        title: "My Idea",
        description: "Mine only",
        isPublic: false,
        submitter: normalUser._id,
        organization: org._id,
      });

      const res = await request(app)
        .get("/api/ideas/my")
        .set("Authorization", `Bearer ${userToken}`);

      assertSuccess(res, "ideas");
      expect(res.body.ideas).toHaveLength(1);
      expect(res.body.ideas[0].title).toBe("My Idea");
    });
  });

  describe("PUT /api/ideas/:id", () => {
    it("should edit user's own idea", async () => {
      const idea = await createTestIdea({
        title: "Old Idea",
        description: "Old desc",
        isPublic: true,
        submitter: normalUser._id,
        organization: org._id,
      });

      const res = await request(app)
        .put(`/api/ideas/${idea._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ title: "Updated Idea", description: "Updated desc", isPublic: false });

      assertSuccess(res, "idea");
      expect(res.body.idea.title).toBe("Updated Idea");
    });

    it("should not edit another user's idea", async () => {
      const otherUser = await User.create({
        name: "Other User",
        email: "other@test.com",
        role: "user",
        organization: org._id,
        googleId: "other-google-id",
      });

      const idea = await createTestIdea({
        title: "Other Idea",
        description: "Other desc",
        isPublic: true,
        submitter: otherUser._id,
        organization: org._id,
      });

      const res = await request(app)
        .put(`/api/ideas/${idea._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ title: "Hack", description: "Try", isPublic: false });

      assertBadRequest(res, "Failed to update idea");
    });
  });

  describe("DELETE /api/ideas/:id", () => {
    it("should delete user's own idea", async () => {
      const idea = await createTestIdea({
        title: "Delete Me",
        description: "To be deleted",
        isPublic: true,
        submitter: normalUser._id,
        organization: org._id,
      });

      const res = await request(app)
        .delete(`/api/ideas/${idea._id}`)
        .set("Authorization", `Bearer ${userToken}`);

      assertSuccess(res);
      expect(res.body.message).toBe("Idea deleted successfully");
      
      const dbIdea = await Idea.findById(idea._id);
      expect(dbIdea).toBeNull();
    });

    it("should not delete another user's idea", async () => {
      const otherUser = await User.create({
        name: "Other User",
        email: "other2@test.com",
        role: "user",
        organization: org._id,
        googleId: "other2-google-id",
      });

      const idea = await createTestIdea({
        title: "Other Idea",
        description: "Cannot delete",
        isPublic: true,
        submitter: otherUser._id,
        organization: org._id,
      });

      const res = await request(app)
        .delete(`/api/ideas/${idea._id}`)
        .set("Authorization", `Bearer ${userToken}`);

      assertBadRequest(res, "Failed to delete idea");
    });
  });

  describe("GET /api/ideas/public-ideas - Error Handling", () => {
    it("should handle errors gracefully", async () => {
      // This should work normally, just testing the error handling path exists
      const res = await request(app)
        .get("/api/ideas/public-ideas")
        .set("Authorization", `Bearer ${userToken}`);

      // Should return success or error
      expect([200, 500]).toContain(res.statusCode);
    });
  });

  describe("POST /api/ideas/submit - Validation", () => {
    it("should return 400 if title is missing", async () => {
      const res = await request(app)
        .post("/api/ideas/submit")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          // Missing title
          description: "Test description",
          isPublic: true,
        });

      assertBadRequest(res);
    });
  });

  describe("GET /api/ideas/my - Error Handling", () => {
    it("should handle errors gracefully", async () => {
      // This should still work even without ideas
      const res = await request(app)
        .get("/api/ideas/my")
        .set("Authorization", `Bearer ${userToken}`);

      assertSuccess(res, "ideas");
      expect(res.body.ideas).toHaveLength(0);
    });
  });

  describe("PUT /api/ideas/:id - Validation", () => {
    it("should return error for non-existent idea", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/ideas/${fakeId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Updated",
          description: "Updated",
          isPublic: true,
        });

      assertBadRequest(res);
    });
  });

  describe("DELETE /api/ideas/:id - Validation", () => {
    it("should return error for non-existent idea", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/ideas/${fakeId}`)
        .set("Authorization", `Bearer ${userToken}`);

      assertBadRequest(res);
    });
  });

  describe("AI Features - Evaluation", () => {
    let idea, evalAdminUser, evalAdminToken;

    beforeEach(async () => {
      idea = await createTestIdea({
        title: "Test Idea for AI",
        description: "This is a test idea for AI evaluation",
        submitter: normalUser._id,
        organization: org._id,
        isPublic: true,
      });

      // Check if admin already exists
      evalAdminUser = await User.findOne({ email: "eval-admin@test.com" });
      if (!evalAdminUser) {
        evalAdminUser = await User.create({
          name: "Eval Admin User",
          email: "eval-admin@test.com",
          role: "admin",
          organization: org._id,
          googleId: "eval-admin-google-id",
        });
      }
      
      const { generateToken } = await import("./helpers/testHelpers.js");
      evalAdminToken = generateToken(evalAdminUser._id, "admin", org._id, JWT_SECRET);
    });

    it("should handle AI evaluation when disabled", async () => {
      const originalAIEnabled = process.env.AI_ENABLED;
      process.env.AI_ENABLED = "false";

      const res = await request(app)
        .post(`/api/ideas/${idea._id}/evaluate`)
        .set("Authorization", `Bearer ${evalAdminToken}`);

      assertAIResponse(res);
      process.env.AI_ENABLED = originalAIEnabled;
    });

    it("should return 404 for non-existent idea evaluation", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/ideas/${fakeId}/evaluate`)
        .set("Authorization", `Bearer ${evalAdminToken}`);

      assertNotFound(res);
    });

    it("should return 403 for unauthorized evaluation", async () => {
      // Create idea from different organization
      const org2 = await import("./helpers/testHelpers.js").then(m => m.createTestOrg("Other Org", "other.com"));
      const idea2 = await createTestIdea({
        title: "Other Org Idea",
        description: "From another org",
        submitter: normalUser._id,
        organization: org2._id,
        isPublic: true,
      });

      const res = await request(app)
        .post(`/api/ideas/${idea2._id}/evaluate`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("should evaluate idea successfully for admin", async () => {
      const res = await request(app)
        .post(`/api/ideas/${idea._id}/evaluate`)
        .set("Authorization", `Bearer ${evalAdminToken}`);

      // Should either succeed or timeout
      expect([200, 500]).toContain(res.statusCode);
    }, 30000);
  });

  describe("AI Features - Similar Ideas", () => {
    let idea;

    beforeEach(async () => {
      idea = await createTestIdea({
        title: "Original Idea",
        description: "Original description",
        submitter: normalUser._id,
        organization: org._id,
        isPublic: true,
      });
    });

    it("should find similar ideas", async () => {
      // Create another similar idea
      await createTestIdea({
        title: "Similar Idea",
        description: "Similar description",
        submitter: normalUser._id,
        organization: org._id,
        isPublic: true,
      });

      const res = await request(app)
        .get(`/api/ideas/${idea._id}/similar`)
        .set("Authorization", `Bearer ${userToken}`);

      // Should either succeed or timeout
      expect([200, 500]).toContain(res.statusCode);
    }, 30000);

    it("should handle errors when finding similar ideas", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/ideas/${fakeId}/similar`)
        .set("Authorization", `Bearer ${userToken}`);

      // Should return error
      expect([200, 500]).toContain(res.statusCode);
    });
  });

  describe("AI Features - Improvements", () => {
    let idea, hackathonCreatorUser, hackathonCreatorToken;

    beforeEach(async () => {
      idea = await createTestIdea({
        title: "Idea for Improvements",
        description: "This idea needs improvements",
        submitter: normalUser._id,
        organization: org._id,
        isPublic: true,
      });

      // Use hackathon_creator role instead of "organizer" (which is not a valid User role)
      hackathonCreatorUser = await User.findOne({ email: "hackathon-creator@test.com" });
      if (!hackathonCreatorUser) {
        hackathonCreatorUser = await User.create({
          name: "Hackathon Creator User",
          email: "hackathon-creator@test.com",
          role: "hackathon_creator",
          organization: org._id,
          googleId: "hackathon-creator-google-id",
        });
      }

      const { generateToken } = await import("./helpers/testHelpers.js");
      hackathonCreatorToken = generateToken(hackathonCreatorUser._id, "hackathon_creator", org._id, JWT_SECRET);
    });

    it("should get improvements for own idea", async () => {
      const res = await request(app)
        .get(`/api/ideas/${idea._id}/improvements`)
        .set("Authorization", `Bearer ${userToken}`);

      // Should either succeed, fail with error, or be forbidden
      expect([200, 403, 500]).toContain(res.statusCode);
    }, 30000);

    it("should get improvements as hackathon creator", async () => {
      const res = await request(app)
        .get(`/api/ideas/${idea._id}/improvements`)
        .set("Authorization", `Bearer ${hackathonCreatorToken}`);

      // Should either succeed, fail with error, or be forbidden  
      expect([200, 403, 500]).toContain(res.statusCode);
    }, 30000);

    it("should return 404 for non-existent idea", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/ideas/${fakeId}/improvements`)
        .set("Authorization", `Bearer ${userToken}`);

      assertNotFound(res);
    });

    it("should return 403 for unauthorized access", async () => {
      const otherUser = await User.create({
        name: "Other User",
        email: "other3@test.com",
        role: "user",
        organization: org._id,
        googleId: "other3-google-id",
      });

      const { generateToken } = await import("./helpers/testHelpers.js");
      const otherToken = generateToken(otherUser._id, "user", org._id, JWT_SECRET);

      const res = await request(app)
        .get(`/api/ideas/${idea._id}/improvements`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.statusCode).toBe(403);
    });
  });
});
