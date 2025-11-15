// middleware/__tests__/hackathonRoleCheck.test.js

import dotenv from "dotenv";
dotenv.config();
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "testsecret";
const JWT_SECRET = process.env.JWT_SECRET;

import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
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
import HackathonRole from "../../models/HackathonRole.js";

describe("HackathonRoleCheck Middleware", () => {
  let org, adminUser, user, organizer, hackathon;
  let adminToken, userToken, organizerToken;

  beforeAll(async () => {
    await connectTestDb();

    org = await Organization.create({
      name: "Test Org",
      domain: "testorg.com",
    });

    adminUser = await User.create({
      name: "Admin User",
      email: "admin@testorg.com",
      role: "admin",
      organization: org._id,
      googleId: "google-admin",
    });

    user = await User.create({
      name: "User",
      email: "user@testorg.com",
      role: "user",
      organization: org._id,
      googleId: "google-user",
    });

    organizer = await User.create({
      name: "Organizer",
      email: "organizer@testorg.com",
      role: "hackathon_creator",
      organization: org._id,
      googleId: "google-organizer",
    });

    hackathon = await Hackathon.create({
      title: "Test Hackathon",
      description: "Test",
      organization: org._id,
      createdBy: organizer._id,
      isActive: true,
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
  });

  beforeEach(async () => {
    await clearDb([HackathonRole]);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("should allow admin to access without hackathon role", async () => {
    const res = await request(app)
      .get(`/api/hackathons/${hackathon._id}/members`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
  });

  it("should reject user without hackathon role", async () => {
    const res = await request(app)
      .get(`/api/hackathons/${hackathon._id}/members`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.statusCode).toBe(403);
  });

  it("should allow user with correct hackathon role", async () => {
    await HackathonRole.create({
      user: user._id,
      hackathon: hackathon._id,
      role: "participant",
      assignedBy: adminUser._id,
    });

    const res = await request(app)
      .get(`/api/hackathons/${hackathon._id}/members`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
  });

  it("should reject user with wrong hackathon role", async () => {
    await HackathonRole.create({
      user: user._id,
      hackathon: hackathon._id,
      role: "participant",
      assignedBy: adminUser._id,
    });

    // Try to access organizer-only endpoint
    const res = await request(app)
      .post(`/api/hackathons/${hackathon._id}/announcements`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        title: "Test",
        message: "Test message",
      });

    expect(res.statusCode).toBe(403);
  });

  it("should return 404 for non-existent hackathon", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/hackathons/${fakeId}/members`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
  });

  it("should return 403 for hackathon from different organization", async () => {
    const otherOrg = await Organization.create({
      name: "Other Org",
      domain: "other.com",
    });

    const otherHackathon = await Hackathon.create({
      title: "Other Hackathon",
      description: "Other",
      organization: otherOrg._id,
      createdBy: adminUser._id,
      isActive: true,
    });

    const res = await request(app)
      .get(`/api/hackathons/${otherHackathon._id}/members`)
      .set("Authorization", `Bearer ${adminToken}`);

    // Admin should still have access, but let's test with regular user
    await HackathonRole.create({
      user: user._id,
      hackathon: otherHackathon._id,
      role: "participant",
      assignedBy: adminUser._id,
    });

    const res2 = await request(app)
      .get(`/api/hackathons/${otherHackathon._id}/members`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res2.statusCode).toBe(403);
  });
});

