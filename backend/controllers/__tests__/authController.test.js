// controllers/__tests__/authController.test.js

import { vi } from "vitest";
import { setupTestEnv, getApp, describe, it, beforeAll, afterAll, beforeEach, afterEach, expect, request, connectTestDb, clearDb, closeTestDb } from "./helpers/testSetup.js";
import { assertSuccess, assertBadRequest, assertNotFound } from "./helpers/assertions.js";
import { createTestOrg } from "./helpers/testHelpers.js";
import User from "../../models/User.js";
import Organization from "../../models/Organization.js";

const JWT_SECRET = setupTestEnv();
const app = getApp();

// Import OAuth2Client after getApp
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { OAuth2Client } = require("google-auth-library");

describe("AuthController - Test Mode Login", () => {
  let org, testUser;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    await connectTestDb();
  });

  beforeEach(async () => {
    await clearDb([User, Organization]);
    org = await createTestOrg("Test Company", "testcompany.com");
    testUser = await User.create({
      name: "Test User",
      email: "test@testcompany.com",
      googleId: "google-test-123",
      organization: org._id,
      role: "user",
    });
  });

  afterAll(async () => {
    await closeTestDb();
    process.env.NODE_ENV = originalNodeEnv;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("POST /api/auth/test-login", () => {
    it("should allow test login in non-production environment", async () => {
      process.env.NODE_ENV = "test";

      const res = await request(app)
        .post("/api/auth/test-login")
        .send({ userId: testUser._id.toString() });

      assertSuccess(res);
      expect(res.body.user).toBeTruthy();
      expect(res.body.user._id).toBe(testUser._id.toString());
      expect(res.body.token).toBeTruthy();
      expect(res.body.message).toContain("Test login successful");
    });

    it("should return 403 in production environment", async () => {
      process.env.NODE_ENV = "production";

      const res = await request(app)
        .post("/api/auth/test-login")
        .send({ userId: testUser._id.toString() });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain("not available in production");
    });

    it("should return 400 when userId is missing", async () => {
      process.env.NODE_ENV = "test";

      const res = await request(app)
        .post("/api/auth/test-login")
        .send({});

      assertBadRequest(res);
      expect(res.body.message).toContain("User ID is required");
    });

    it("should return 404 when user not found", async () => {
      process.env.NODE_ENV = "test";
      const fakeUserId = "507f1f77bcf86cd799439011";

      const res = await request(app)
        .post("/api/auth/test-login")
        .send({ userId: fakeUserId });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain("User not found");
    });

    it("should handle errors gracefully", async () => {
      process.env.NODE_ENV = "test";

      const res = await request(app)
        .post("/api/auth/test-login")
        .send({ userId: "invalid-id-format" });

      assertBadRequest(res);
      expect(res.body.message).toContain("Test login failed");
    });
  });

  describe("GET /api/auth/test-users", () => {
    let adminUser, org2, org2User;

    beforeEach(async () => {
      // Create multiple users across different orgs and roles
      adminUser = await User.create({
        name: "Admin User",
        email: "admin@testcompany.com",
        googleId: "google-admin-123",
        organization: org._id,
        role: "admin",
        expertise: "JavaScript, React",
      });

      org2 = await createTestOrg("Second Company", "secondcompany.com");
      org2User = await User.create({
        name: "User from Org2",
        email: "user@secondcompany.com",
        googleId: "google-user-org2",
        organization: org2._id,
        role: "user",
        expertise: "Python",
      });
    });

    it("should return grouped users in non-production environment", async () => {
      process.env.NODE_ENV = "test";

      const res = await request(app).get("/api/auth/test-users");

      assertSuccess(res);
      expect(res.body.users).toBeTruthy();
      expect(res.body.totalCount).toBe(3); // testUser, adminUser, org2User
      
      // Check that users are grouped by organization
      expect(res.body.users["Test Company"]).toBeTruthy();
      expect(res.body.users["Second Company"]).toBeTruthy();
      
      // Verify structure
      const testCompanyUsers = res.body.users["Test Company"];
      expect(testCompanyUsers.length).toBe(2);
      expect(testCompanyUsers.some(u => u.name === "Admin User")).toBe(true);
      expect(testCompanyUsers.some(u => u.name === "Test User")).toBe(true);
    });

    it("should return 403 in production environment", async () => {
      process.env.NODE_ENV = "production";

      const res = await request(app).get("/api/auth/test-users");

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain("not available in production");
    });

    it("should handle errors gracefully", async () => {
      process.env.NODE_ENV = "test";
      
      // Force an error by deleting all orgs first to break population
      await Organization.deleteMany({});

      const res = await request(app).get("/api/auth/test-users");

      // The route should fail when users can't be populated with their organization
      assertBadRequest(res);
      expect(res.body.message).toContain("Failed to fetch test users");
      
      // Recreate orgs for next tests
      org = await createTestOrg("Test Company", "testcompany.com");
      org2 = await createTestOrg("Second Company", "secondcompany.com");
    });
  });
});

describe("AuthController - Google Login", () => {
  let org;
  const adminEmail = "srbmaury@company.com"; // Must match prefix in authController.js

  beforeAll(async () => {
    await connectTestDb();

    // Mock verifyIdToken
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockImplementation(async ({ idToken }) => {
      if (idToken === "valid-admin-token") {
        return {
          getPayload: () => ({
            sub: "google-admin-id",
            email: adminEmail,
            name: "Admin User",
          }),
        };
      } else if (idToken === "valid-user-token") {
        return {
          getPayload: () => ({
            sub: "google-user-id",
            email: "user@company.com",
            name: "Normal User",
          }),
        };
      } else {
        throw new Error("Invalid token");
      }
    });
  });

  beforeEach(async () => {
    await clearDb([User, Organization]);
    org = await createTestOrg("Company", "company.com");
  });

  afterAll(async () => {
    await closeTestDb();
    vi.restoreAllMocks();
  });

  it("should onboard a normal user to existing org", async () => {
    const res = await request(app)
      .post("/api/auth/google-login")
      .send({ token: "valid-user-token" });

    assertSuccess(res);
    expect(res.body.user.role).toBe("user");

    const dbUser = await User.findOne({ email: "user@company.com" });
    expect(dbUser).toBeTruthy();
    expect(dbUser.organization.toString()).toBe(org._id.toString());
  });

  it("should onboard an admin user and create org if not exist", async () => {
    await Organization.deleteMany({});

    const res = await request(app)
      .post("/api/auth/google-login")
      .send({ token: "valid-admin-token" });

    assertSuccess(res);
    expect(res.body.user.role).toBe("admin");

    const dbUser = await User.findOne({ email: adminEmail });
    expect(dbUser).toBeTruthy();

    const newOrg = await Organization.findById(dbUser.organization);
    expect(newOrg).toBeTruthy();
    expect(newOrg.admin.toString()).toBe(dbUser._id.toString());
  });

  it("should reject invalid token (line 166-167)", async () => {
    // This test specifically covers lines 166-167 in authController.js
    const res = await request(app)
      .post("/api/auth/google-login")
      .send({ token: "invalid-token" });

    // Verify the exact response from lines 166-167
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBeTruthy();
  });

  it("should handle Google login errors without token", async () => {
    // Additional test to ensure error handling is robust
    const res = await request(app)
      .post("/api/auth/google-login")
      .send({});

    expect([400, 500]).toContain(res.statusCode);
  });
});
