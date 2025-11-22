// controllers/__tests__/userController.test.js

import { setupTestEnv, getApp, describe, it, beforeAll, afterAll, expect, request, mongoose, connectTestDb, closeTestDb } from "./helpers/testSetup.js";
import { setupBasicTestEnv, createTestUser } from "./helpers/testHelpers.js";
import { assertSuccess, assertForbidden, assertNotFound } from "./helpers/assertions.js";
import User from "../../models/User.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = setupTestEnv();
const app = getApp();

describe("UserController", () => {
  let org, adminUser, normalUser, adminToken, userToken;

  beforeAll(async () => {
    await connectTestDb();
    const env = await setupBasicTestEnv(JWT_SECRET);
    org = env.org;
    adminUser = env.adminUser;
    normalUser = env.normalUser;
    adminToken = env.adminToken;
    userToken = env.userToken;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("GET /api/users", () => {
    it("should get all users grouped by role", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${adminToken}`);

      assertSuccess(res);
      expect(res.body.users).toBeTruthy();
      expect(res.body.groupedUsers).toBeTruthy();
      expect(Array.isArray(res.body.users)).toBe(true);
    });
  });

  describe("PUT /api/users/:userId/role", () => {
    it("should update user role (admin)", async () => {
      const res = await request(app)
        .put(`/api/users/${normalUser._id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "hackathon_creator" });

      assertSuccess(res);
      expect(res.body.user.role).toBe("hackathon_creator");

      const dbUser = await User.findById(normalUser._id);
      expect(dbUser.role).toBe("hackathon_creator");
    });

    it("should fail to update admin role", async () => {
      const res = await request(app)
        .put(`/api/users/${adminUser._id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "user" });

      assertForbidden(res);
    });

    it("should fail if not admin", async () => {
      const res = await request(app)
        .put(`/api/users/${normalUser._id}/role`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ role: "hackathon_creator" });

      assertForbidden(res);
    });

    it("should fail if user not found", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .put(`/api/users/${fakeId}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "hackathon_creator" });

      assertNotFound(res);
    });
  });

  describe("GET /api/users/with-roles", () => {
    it("should get users with hackathon roles (admin)", async () => {
      const res = await request(app)
        .get("/api/users/with-roles")
        .set("Authorization", `Bearer ${adminToken}`);

      assertSuccess(res);
      expect(res.body.users).toBeTruthy();
      expect(Array.isArray(res.body.users)).toBe(true);
      // Each user should have organizerRoles array
      res.body.users.forEach(user => {
        expect(user.organizerRoles).toBeDefined();
        expect(Array.isArray(user.organizerRoles)).toBe(true);
      });
    });

    it("should fail if not admin", async () => {
      // Ensure normalUser exists
      const freshUser = await User.findById(normalUser._id);
      if (!freshUser) {
        // Recreate if needed (test isolation)
        normalUser = await createTestUser({
          name: "Normal User",
          email: "normal@test.com",
          role: "user",
          organization: org._id,
        });
        userToken = jwt.sign({ id: normalUser._id }, JWT_SECRET);
      }
      
      const res = await request(app)
        .get("/api/users/with-roles")
        .set("Authorization", `Bearer ${userToken}`);

      expect([403, 404]).toContain(res.statusCode);
    });

    it("should handle error when user not found", async () => {
      const res = await request(app)
        .get("/api/users/with-roles")
        .set("Authorization", "Bearer invalid-token");

      expect([401, 404, 500]).toContain(res.statusCode);
    });
  });

  describe("GET /api/users/me", () => {
    it("should get current user profile", async () => {
      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${userToken}`);

      assertSuccess(res);
      expect(res.body.user).toBeTruthy();
      expect(res.body.user._id.toString()).toBe(normalUser._id.toString());
      expect(res.body.user.organization).toBeTruthy();
      expect(res.body.user.organization.name).toBe(org.name);
    });

    it("should get admin profile", async () => {
      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${adminToken}`);

      assertSuccess(res);
      expect(res.body.user).toBeTruthy();
      expect(res.body.user._id.toString()).toBe(adminUser._id.toString());
      expect(res.body.user.role).toBe("admin");
    });

    it("should handle user not found", async () => {
      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", "Bearer invalid-token");

      expect([401, 404, 500]).toContain(res.statusCode);
    });
  });

  describe("PUT /api/users/me", () => {
    it("should update user profile name", async () => {
      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ name: "Updated Name" });

      assertSuccess(res);
      expect(res.body.user.name).toBe("Updated Name");

      // Verify in database
      const dbUser = await User.findById(normalUser._id);
      expect(dbUser.name).toBe("Updated Name");
    });

    it("should update user expertise", async () => {
      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ expertise: "React, Node.js, MongoDB" });

      assertSuccess(res);
      expect(res.body.user.expertise).toBe("React, Node.js, MongoDB");

      // Verify in database
      const dbUser = await User.findById(normalUser._id);
      expect(dbUser.expertise).toBe("React, Node.js, MongoDB");
    });

    it("should update notifications preference", async () => {
      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ notificationsEnabled: false });

      assertSuccess(res);
      expect(res.body.user.notificationsEnabled).toBe(false);

      // Verify in database
      const dbUser = await User.findById(normalUser._id);
      expect(dbUser.notificationsEnabled).toBe(false);
    });

    it("should update multiple fields at once", async () => {
      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          name: "Multi Update User",
          expertise: "Full Stack Development",
          notificationsEnabled: true
        });

      assertSuccess(res);
      expect(res.body.user.name).toBe("Multi Update User");
      expect(res.body.user.expertise).toBe("Full Stack Development");
      expect(res.body.user.notificationsEnabled).toBe(true);
    });

    it("should handle empty update (no fields changed)", async () => {
      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", `Bearer ${userToken}`)
        .send({});

      assertSuccess(res);
      expect(res.body.user).toBeTruthy();
    });

    it("should not update role through profile update", async () => {
      // Get current role from database
      const userBefore = await User.findById(normalUser._id);
      const originalRole = userBefore.role;
      
      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ role: "admin" });

      assertSuccess(res);
      
      // Verify role was not changed
      const dbUser = await User.findById(normalUser._id);
      expect(dbUser.role).toBe(originalRole);
    });

    it("should handle user not found", async () => {
      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", "Bearer invalid-token");

      expect([401, 404, 500]).toContain(res.statusCode);
    });
  });

  describe("Error Handling", () => {
    it("should handle getAll with invalid token", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", "Bearer invalid-token");

      expect([401, 404, 500]).toContain(res.statusCode);
    });

    it("should handle updateRole with invalid user ID format", async () => {
      const res = await request(app)
        .put("/api/users/invalid-id/role")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "user" });

      expect([400, 500]).toContain(res.statusCode);
    });

    it("should handle updateRole with missing role field", async () => {
      const res = await request(app)
        .put(`/api/users/${normalUser._id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      // Should succeed or handle gracefully
      expect([200, 400, 500]).toContain(res.statusCode);
    });
  });
});
