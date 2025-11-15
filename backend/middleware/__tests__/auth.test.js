// middleware/__tests__/auth.test.js

import dotenv from "dotenv";
dotenv.config();
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "testsecret";
const JWT_SECRET = process.env.JWT_SECRET;

import { describe, it, beforeAll, afterAll, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const app = require("../../app");

import { connectTestDb, closeTestDb } from "../../setup/testDb.js";
import User from "../../models/User.js";
import Organization from "../../models/Organization.js";

describe("Auth Middleware", () => {
  let org, user, validToken;

  beforeAll(async () => {
    await connectTestDb();

    org = await Organization.create({
      name: "Test Org",
      domain: "testorg.com",
    });

    user = await User.create({
      name: "Test User",
      email: "test@testorg.com",
      role: "user",
      organization: org._id,
      googleId: "test-google-id",
    });

    validToken = jwt.sign(
      {
        id: user._id.toString(),
        role: "user",
        organization: org._id.toString(),
      },
      JWT_SECRET
    );
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("should reject request without token", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", "");

    expect(res.statusCode).toBe(401);
  });

  it("should reject request with invalid token", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", "Bearer invalid-token");

    expect(res.statusCode).toBe(401);
  });

  it("should reject request with expired token", async () => {
    const expiredToken = jwt.sign(
      {
        id: user._id.toString(),
        role: "user",
        organization: org._id.toString(),
      },
      JWT_SECRET,
      { expiresIn: "-1h" }
    );

    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.statusCode).toBe(401);
  });

  it("should reject request with token for non-existent user", async () => {
    const mongoose = require("mongoose");
    const fakeUserId = new mongoose.Types.ObjectId();
    const fakeToken = jwt.sign(
      {
        id: fakeUserId.toString(),
        role: "user",
        organization: org._id.toString(),
      },
      JWT_SECRET
    );

    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${fakeToken}`);

    expect(res.statusCode).toBe(401);
  });

  it("should accept request with valid token", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${validToken}`);

    expect(res.statusCode).toBe(200);
  });
});

