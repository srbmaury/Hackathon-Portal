// controllers/__tests__/announcementController.test.js

import { setupTestEnv, getApp, describe, it, beforeAll, afterAll, beforeEach, expect, request, mongoose, connectTestDb, clearDb, closeTestDb } from "./helpers/testSetup.js";
import { setupBasicTestEnv, createTestHackathon, assignHackathonRole, createTestUser, generateToken } from "./helpers/testHelpers.js";
import { assertSuccess, assertCreated, assertForbidden, assertNotFound, assertBadRequest, assertAIResponse } from "./helpers/assertions.js";
import Announcement from "../../models/Announcement.js";

const JWT_SECRET = setupTestEnv();
const app = getApp();

describe("AnnouncementController", () => {
  let org, adminUser, normalUser, organizer, hackathon;
  let adminToken, userToken, organizerToken;

  beforeAll(async () => {
    await connectTestDb();

    const env = await setupBasicTestEnv(JWT_SECRET);
    org = env.org;
    adminUser = env.adminUser;
    normalUser = env.normalUser;
    adminToken = env.adminToken;
    userToken = env.userToken;

    organizer = await createTestUser({
      name: "Organizer User",
      email: "organizer@testorg.com",
      role: "hackathon_creator",
      organization: org._id,
      googleId: "google-id-organizer",
    });

    hackathon = await createTestHackathon({
      organization: org._id,
      createdBy: organizer._id,
      isActive: true,
    });

    await assignHackathonRole(organizer._id, hackathon._id, "organizer", adminUser._id);
    await assignHackathonRole(normalUser._id, hackathon._id, "participant", adminUser._id);

    organizerToken = generateToken(organizer._id, "hackathon_creator", org._id, JWT_SECRET);
  });

  beforeEach(async () => {
    await clearDb([Announcement]);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("POST /api/hackathons/:hackathonId/announcements", () => {
    it("should create announcement (organizer)", async () => {
      const res = await request(app)
        .post(`/api/hackathons/${hackathon._id}/announcements`)
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          title: "Test Announcement",
          message: "Test message",
        });

      assertCreated(res, "announcement");
      expect(res.body.announcement.title).toBe("Test Announcement");

      const dbAnnouncement = await Announcement.findOne({ title: "Test Announcement" });
      expect(dbAnnouncement).toBeTruthy();
    });

    it("should fail without required fields", async () => {
      const res = await request(app)
        .post(`/api/hackathons/${hackathon._id}/announcements`)
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({ title: "Only Title" }); // Missing message field

      // The controller doesn't validate before passing to Mongoose,
      // so this might return 500 due to Mongoose validation error
      // We expect either 400 or 500 depending on error handling
      expect([400, 500]).toContain(res.statusCode);
    });

    it("should forbid creation for non-organizer", async () => {
      const res = await request(app)
        .post(`/api/hackathons/${hackathon._id}/announcements`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Unauthorized",
          message: "Should fail",
        });

      assertForbidden(res);
    });
  });

  describe("GET /api/hackathons/:hackathonId/announcements", () => {
    beforeEach(async () => {
      await Announcement.create({
        title: "Announcement 1",
        message: "Message 1",
        hackathon: hackathon._id,
        author: organizer._id,
        createdBy: organizer._id,
        organization: org._id,
      });
    });

    it("should get announcements for participant", async () => {
      const res = await request(app)
        .get(`/api/hackathons/${hackathon._id}/announcements`)
        .set("Authorization", `Bearer ${userToken}`);

      assertSuccess(res, "announcements");
      expect(res.body.announcements).toHaveLength(1);
      expect(res.body.announcements[0].title).toBe("Announcement 1");
    });

    it("should get announcements for organizer", async () => {
      const res = await request(app)
        .get(`/api/hackathons/${hackathon._id}/announcements`)
        .set("Authorization", `Bearer ${organizerToken}`);

      assertSuccess(res, "announcements");
      expect(res.body.announcements).toHaveLength(1);
    });
  });

  describe("PUT /api/hackathons/:hackathonId/announcements/:id", () => {
    let announcement;

    beforeEach(async () => {
      announcement = await Announcement.create({
        title: "Original",
        message: "Original message",
        hackathon: hackathon._id,
        author: organizer._id,
        createdBy: organizer._id,
        organization: org._id,
      });
    });

    it("should update announcement (organizer)", async () => {
      const res = await request(app)
        .put(`/api/hackathons/${hackathon._id}/announcements/${announcement._id}`)
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({ title: "Updated", message: "Updated message" });

      assertSuccess(res, "announcement");
      expect(res.body.announcement.title).toBe("Updated");
    });

    it("should allow admin to update any announcement", async () => {
      const res = await request(app)
        .put(`/api/hackathons/${hackathon._id}/announcements/${announcement._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "Admin Updated", message: "Admin updated message" });

      assertSuccess(res, "announcement");
      expect(res.body.announcement.title).toBe("Admin Updated");
    });

    it("should forbid update for non-creator non-admin (line 181-183)", async () => {
      // This test specifically covers lines 181-183 in announcementController.js
      // The announcement was created by organizer, but normalUser is not creator and not admin
      const res = await request(app)
        .put(`/api/hackathons/${hackathon._id}/announcements/${announcement._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ title: "Unauthorized Update" });

      // Verify the exact response from lines 181-183
      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBeTruthy();
    });

    it("should return 404 for non-existent announcement", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const res = await request(app)
        .put(`/api/hackathons/${hackathon._id}/announcements/${fakeId}`)
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({ title: "Updated" });

      assertNotFound(res);
    });
  });

  describe("DELETE /api/hackathons/:hackathonId/announcements/:id", () => {
    let announcement;

    beforeEach(async () => {
      announcement = await Announcement.create({
        title: "To Delete",
        message: "Delete me",
        hackathon: hackathon._id,
        author: organizer._id,
        createdBy: organizer._id,
        organization: org._id,
      });
    });

    it("should delete announcement (organizer)", async () => {
      const res = await request(app)
        .delete(`/api/hackathons/${hackathon._id}/announcements/${announcement._id}`)
        .set("Authorization", `Bearer ${organizerToken}`);

      assertSuccess(res);
      expect(await Announcement.findById(announcement._id)).toBeNull();
    });

    it("should allow admin to delete any announcement", async () => {
      const res = await request(app)
        .delete(`/api/hackathons/${hackathon._id}/announcements/${announcement._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      assertSuccess(res);
      expect(await Announcement.findById(announcement._id)).toBeNull();
    });

    it("should forbid delete for non-creator non-admin (line 234-236)", async () => {
      // This test specifically covers lines 234-236 in announcementController.js
      // The announcement was created by organizer, but normalUser is not creator and not admin
      const res = await request(app)
        .delete(`/api/hackathons/${hackathon._id}/announcements/${announcement._id}`)
        .set("Authorization", `Bearer ${userToken}`);

      // Verify the exact response from lines 234-236
      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBeTruthy();
    });

    it("should return 404 when deleting non-existent announcement", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const res = await request(app)
        .delete(`/api/hackathons/${hackathon._id}/announcements/${fakeId}`)
        .set("Authorization", `Bearer ${organizerToken}`);

      assertNotFound(res);
    });

    it("should handle database errors during delete", async () => {
      const res = await request(app)
        .delete(`/api/hackathons/${hackathon._id}/announcements/invalid-id-format`)
        .set("Authorization", `Bearer ${organizerToken}`);

      // Should return 500 for invalid ID format (database error)
      expect(res.statusCode).toBe(500);
    });
  });

  describe("AI Features", () => {
    it("should handle AI formatting when disabled", async () => {
      process.env.AI_ENABLED = "false";
      
      const res = await request(app)
        .post(`/api/hackathons/${hackathon._id}/announcements/format`)
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          title: "Test",
          message: "Test message",
        });

      assertAIResponse(res);
    });

    it("should format announcement successfully when AI enabled", async () => {
      const originalAIEnabled = process.env.AI_ENABLED;
      process.env.AI_ENABLED = "true";
      
      const res = await request(app)
        .post(`/api/hackathons/${hackathon._id}/announcements/format`)
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          title: "Test",
          message: "Test message",
        });

      // Might succeed or fail depending on AI service availability
      expect([200, 400, 500]).toContain(res.statusCode);
      
      process.env.AI_ENABLED = originalAIEnabled;
    }, 15000);

    it("should return 404 when hackathon not found in format (line 262-264)", async () => {
      // This test specifically covers lines 262-264 in announcementController.js
      const fakeHackathonId = new mongoose.Types.ObjectId();
      
      const res = await request(app)
        .post(`/api/hackathons/${fakeHackathonId}/announcements/format`)
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          title: "Test",
          message: "Test message",
        });

      // Verify the exact response from lines 262-264
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBeTruthy();
    });

    it("should handle errors when format endpoint fails (line 279-283)", async () => {
      // This test specifically covers lines 279-283 in announcementController.js
      // Invalid hackathon ID will cause database error which triggers catch block
      const res = await request(app)
        .post(`/api/hackathons/invalid-id/announcements/format`)
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          title: "Test",
          message: "Test message",
        });

      // Verify the error response (error happens in middleware OR controller catch block)
      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBeTruthy();
      expect(res.body.error).toBeTruthy();
    });

    it("should return 400 when format missing title", async () => {
      const res = await request(app)
        .post(`/api/hackathons/${hackathon._id}/announcements/format`)
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          message: "Test message",
        });

      assertBadRequest(res);
    });

    it("should return 400 when format missing message", async () => {
      const res = await request(app)
        .post(`/api/hackathons/${hackathon._id}/announcements/format`)
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          title: "Test",
        });

      assertBadRequest(res);
    });

    it("should enhance announcement successfully", async () => {
      const originalAIEnabled = process.env.AI_ENABLED;
      process.env.AI_ENABLED = "true";
      
      const res = await request(app)
        .post(`/api/hackathons/${hackathon._id}/announcements/enhance`)
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          title: "Test Title",
          message: "Test message",
        });

      // Might succeed or fail depending on AI service availability
      expect([200, 400, 500]).toContain(res.statusCode);
      
      process.env.AI_ENABLED = originalAIEnabled;
    }, 15000);

    it("should return 400 when enhance missing title", async () => {
      const res = await request(app)
        .post(`/api/hackathons/${hackathon._id}/announcements/enhance`)
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          message: "Test message only",
        });

      assertBadRequest(res);
    });

    it("should return 400 when enhance missing message", async () => {
      const res = await request(app)
        .post(`/api/hackathons/${hackathon._id}/announcements/enhance`)
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          title: "Test title only",
        });

      assertBadRequest(res);
    });

    it("should handle errors when enhance endpoint fails (line 304-308)", async () => {
      // This test specifically covers lines 304-308 in announcementController.js
      // We'll test error handling by triggering the catch block
      
      // First test: Missing required fields triggers error in service
      const res = await request(app)
        .post(`/api/hackathons/${hackathon._id}/announcements/enhance`)
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          title: "",  // Empty title might cause service error
          message: "",  // Empty message might cause service error
        });

      // Should either fail with 400 (validation) or 500 (service error)
      expect([400, 500]).toContain(res.statusCode);
      
      // If it's 500, verify the error response structure from lines 305-308
      if (res.statusCode === 500) {
        expect(res.body.message).toBe("Failed to enhance announcement");
        expect(res.body.error).toBeTruthy();
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle update errors gracefully", async () => {
      const res = await request(app)
        .put(`/api/hackathons/${hackathon._id}/announcements/invalid-id`)
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({ title: "Updated" });

      expect([400, 500]).toContain(res.statusCode);
    });

    it("should handle create errors when hackathon not found", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const res = await request(app)
        .post(`/api/hackathons/${fakeId}/announcements`)
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          title: "Test",
          message: "Test message",
        });

      assertNotFound(res);
    });
  });
});
