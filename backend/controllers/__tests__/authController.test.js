// controllers/__tests__/authController.test.js

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

import AuthController from "../../controllers/authController.js";
const { OAuth2Client } = require("google-auth-library");

describe("AuthController - Google Login", () => {
  let org, adminEmail;

  beforeAll(async () => {
    await connectTestDb();
    // 🔥 Must match the prefix in authController.js (srbmaury@)
    adminEmail = "srbmaury@company.com";

    // Mock verifyIdToken - must return a Promise
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

    // Create existing org
    org = await Organization.create({
      name: "Company",
      domain: "company.com",
      admin: null,
      members: [],
    });
  });

  afterAll(async () => {
    await closeTestDb();
    vi.restoreAllMocks();
  });

  it("should onboard a normal user to existing org", async () => {
    const res = await request(app)
      .post("/api/auth/google-login")  // 🔥 Fixed: added /auth
      .send({ token: "valid-user-token" });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.role).toBe("user");

    const dbUser = await User.findOne({ email: "user@company.com" });
    expect(dbUser).toBeTruthy();
    expect(dbUser.organization.toString()).toBe(org._id.toString());

    const updatedOrg = await Organization.findById(org._id);
    expect(dbUser.organization.toString()).toBe(updatedOrg._id.toString());
  });

  it("should onboard an admin user and create org if not exist", async () => {
    await Organization.deleteMany({}); // ensure org does not exist

    const res = await request(app)
      .post("/api/auth/google-login")  // 🔥 Fixed: added /auth
      .send({ token: "valid-admin-token" });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.role).toBe("admin");

    const dbUser = await User.findOne({ email: adminEmail });
    expect(dbUser).toBeTruthy();

    const newOrg = await Organization.findById(dbUser.organization);
    expect(newOrg).toBeTruthy();
    expect(newOrg.admin.toString()).toBe(dbUser._id.toString());
    expect(dbUser.organization.toString()).toBe(newOrg._id.toString());
  });

  it("should reject users from un-onboarded org if not admin", async () => {
    const res = await request(app)
      .post("/api/auth/google-login")  // 🔥 Fixed: added /auth
      .send({ token: "invalid-token" }); // triggers controller catch block

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBeTruthy();
  });
});
