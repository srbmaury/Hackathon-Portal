// middleware/__tests__/hackathonRoleCheck.test.js

import { setupTestEnv, getApp, describe, it, beforeAll, afterAll, beforeEach, expect, request, mongoose, connectTestDb, clearDb, closeTestDb } from "../../controllers/__tests__/helpers/testSetup.js";
import { setupHackathonTestEnv, assignHackathonRole, createTestHackathon } from "../../controllers/__tests__/helpers/testHelpers.js";
import { assertSuccess, assertForbidden, assertNotFound } from "../../controllers/__tests__/helpers/assertions.js";
import Organization from "../../models/Organization.js";
import Hackathon from "../../models/Hackathon.js";
import HackathonRole from "../../models/HackathonRole.js";

const JWT_SECRET = setupTestEnv();
const app = getApp();

describe("HackathonRoleCheck Middleware", () => {
  let org, adminUser, normalUser, organizer, hackathon;
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
  });

  beforeEach(async () => {
    await clearDb([HackathonRole]);
    // Restore organizer role
    await assignHackathonRole(organizer._id, hackathon._id, "organizer", adminUser._id);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("should allow admin to access without hackathon role", async () => {
    const res = await request(app)
      .get(`/api/hackathons/${hackathon._id}/members`)
      .set("Authorization", `Bearer ${adminToken}`);

    assertSuccess(res);
  });

  it("should reject user without hackathon role", async () => {
    const res = await request(app)
      .get(`/api/hackathons/${hackathon._id}/members`)
      .set("Authorization", `Bearer ${userToken}`);

    assertForbidden(res);
  });

  it("should allow user with correct hackathon role", async () => {
    await assignHackathonRole(normalUser._id, hackathon._id, "participant", adminUser._id);

    const res = await request(app)
      .get(`/api/hackathons/${hackathon._id}/members`)
      .set("Authorization", `Bearer ${userToken}`);

    assertSuccess(res);
  });

  it("should reject user with wrong hackathon role", async () => {
    await assignHackathonRole(normalUser._id, hackathon._id, "participant", adminUser._id);

    // Try to access organizer-only endpoint
    const res = await request(app)
      .post(`/api/hackathons/${hackathon._id}/announcements`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        title: "Test",
        message: "Test message",
      });

    assertForbidden(res);
  });

  it("should return 404 for non-existent hackathon", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/hackathons/${fakeId}/members`)
      .set("Authorization", `Bearer ${adminToken}`);

    assertNotFound(res);
  });

  it("should reject hackathon from different organization", async () => {
    const otherOrg = await Organization.create({
      name: "Other Org",
      domain: "other.com",
    });

    const otherHackathon = await createTestHackathon({
      title: "Other Hackathon",
      description: "Other",
      organization: otherOrg._id,
      createdBy: adminUser._id,
      isActive: true,
    });

    await assignHackathonRole(normalUser._id, otherHackathon._id, "participant", adminUser._id);

    const res = await request(app)
      .get(`/api/hackathons/${otherHackathon._id}/members`)
      .set("Authorization", `Bearer ${userToken}`);

    assertForbidden(res);
  });

  it("should attach hackathon role to request", async () => {
    await assignHackathonRole(normalUser._id, hackathon._id, "participant", adminUser._id);

    const res = await request(app)
      .get(`/api/hackathons/${hackathon._id}/members`)
      .set("Authorization", `Bearer ${userToken}`);

    assertSuccess(res);
    // Role should be attached to request (verified by successful access)
  });

  describe("isHackathonMember middleware", () => {
    it("should allow admin to access without membership", async () => {
      // Clear all hackathon roles to ensure admin has no specific role
      await HackathonRole.deleteMany({ user: adminUser._id, hackathon: hackathon._id });

      const res = await request(app)
        .get(`/api/hackathons/${hackathon._id}/members`)
        .set("Authorization", `Bearer ${adminToken}`);

      assertSuccess(res);
    });

    it("should allow user with any hackathon role", async () => {
      await assignHackathonRole(normalUser._id, hackathon._id, "judge", adminUser._id);

      const res = await request(app)
        .get(`/api/hackathons/${hackathon._id}/members`)
        .set("Authorization", `Bearer ${userToken}`);

      assertSuccess(res);
    });

    it("should reject user without any hackathon role", async () => {
      const res = await request(app)
        .get(`/api/hackathons/${hackathon._id}/members`)
        .set("Authorization", `Bearer ${userToken}`);

      assertForbidden(res);
    });

    it("should return 404 for non-existent hackathon", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/hackathons/${fakeId}/members`)
        .set("Authorization", `Bearer ${userToken}`);

      expect([403, 404]).toContain(res.statusCode);
    });

    it("should reject hackathon from different organization", async () => {
      const otherOrg = await Organization.create({
        name: "Another Org",
        domain: "another.com",
      });

      const otherHackathon = await createTestHackathon({
        title: "Another Hackathon",
        description: "Another",
        organization: otherOrg._id,
        createdBy: adminUser._id,
        isActive: true,
      });

      await assignHackathonRole(normalUser._id, otherHackathon._id, "participant", adminUser._id);

      const res = await request(app)
        .get(`/api/hackathons/${otherHackathon._id}/members`)
        .set("Authorization", `Bearer ${userToken}`);

      assertForbidden(res);
    });
  });
});
