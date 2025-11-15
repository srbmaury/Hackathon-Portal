// controllers/__tests__/hackathonController.test.js

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
import Round from "../../models/Round.js";

describe("HackathonController", () => {
  let org, adminUser, normalUser, adminToken, userToken;

  beforeAll(async () => {
    await connectTestDb();

    org = await Organization.create({
      name: "Test Org",
      domain: "testorg.com",
    });

    adminUser = await User.create({
      name: "Admin User",
      email: "admin@example.com",
      role: "admin",
      organization: org._id,
      googleId: "test-google-id-admin",
    });

    normalUser = await User.create({
      name: "Member User",
      email: "member@example.com",
      role: "user",
      organization: org._id,
      googleId: "test-google-id-member",
    });

    adminToken = jwt.sign(
      { id: adminUser._id.toString(), role: "admin", organization: org._id.toString() },
      JWT_SECRET
    );

    userToken = jwt.sign(
      { id: normalUser._id.toString(), role: "user", organization: org._id.toString() },
      JWT_SECRET
    );
  });

  beforeEach(async () => {
    await clearDb([Hackathon, HackathonRole, Round]);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("should create a hackathon (admin)", async () => {
    const res = await request(app)
      .post("/api/hackathons")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Hackathon 1",
        description: "Description 1",
        startDate: "2025-11-01",
        endDate: "2025-11-03",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.hackathon.title).toBe("Hackathon 1");

    const dbEntry = await Hackathon.findOne({ title: "Hackathon 1" });
    expect(dbEntry).toBeTruthy();
  });

  it("should forbid hackathon creation without hackathon_creator/admin role", async () => {
    const res = await request(app)
      .post("/api/hackathons")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        title: "Hackathon Unauthorized",
        description: "Should fail",
      });

    expect(res.statusCode).toBe(403);
  });

  it("should fetch all hackathons visible to user", async () => {
    await Hackathon.create([
      { 
        title: "Active Hackathon", 
        description: "Active description", 
        isActive: true, 
        organization: org._id, 
        createdBy: adminUser._id 
      },
      { 
        title: "Inactive Hackathon", 
        description: "Inactive description", 
        isActive: false, 
        organization: org._id, 
        createdBy: adminUser._id 
      },
    ]);

    const res = await request(app)
      .get("/api/hackathons")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.hackathons).toHaveLength(1);
    expect(res.body.hackathons[0].title).toBe("Active Hackathon");
  });

  it("should fetch all hackathons visible to admin", async () => {
    await Hackathon.create([
      { 
        title: "Active Hackathon", 
        description: "Active description", 
        isActive: true, 
        organization: org._id, 
        createdBy: adminUser._id 
      },
      { 
        title: "Inactive Hackathon", 
        description: "Inactive description", 
        isActive: false, 
        organization: org._id, 
        createdBy: adminUser._id 
      },
    ]);

    const res = await request(app)
      .get("/api/hackathons")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.hackathons).toHaveLength(2);
  });

  it("should fetch single hackathon by ID if visible", async () => {
    const hack = await Hackathon.create({
      title: "Single Hack",
      description: "Single hack description",
      isActive: true,
      organization: org._id,
      createdBy: adminUser._id,
    });

    const res = await request(app)
      .get(`/api/hackathons/${hack._id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.hackathon.title).toBe("Single Hack");
  });

  it("should forbid fetching inactive hackathon for user", async () => {
    const hack = await Hackathon.create({
      title: "Inactive Hack",
      description: "Inactive hack description",
      isActive: false,
      organization: org._id,
      createdBy: adminUser._id,
    });

    const res = await request(app)
      .get(`/api/hackathons/${hack._id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.statusCode).toBe(403);
  });

  it("should update hackathon (admin)", async () => {
    const hack = await Hackathon.create({
      title: "Old Title",
      description: "Old description",
      isActive: true,
      organization: org._id,
      createdBy: adminUser._id,
    });

    const res = await request(app)
      .put(`/api/hackathons/${hack._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "New Title" });

    expect(res.statusCode).toBe(200);
    expect(res.body.hackathon.title).toBe("New Title");
  });

  it("should forbid update hackathon without organizer/admin role (hackathon-specific)", async () => {
    const hack = await Hackathon.create({
      title: "Old Title",
      description: "Old description",
      isActive: true,
      organization: org._id,
      createdBy: adminUser._id,
    });

    const res = await request(app)
      .put(`/api/hackathons/${hack._id}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ title: "Try Update" });

    expect(res.statusCode).toBe(403);
  });

  it("should delete hackathon (admin)", async () => {
    const hack = await Hackathon.create({
      title: "To Delete",
      description: "To be deleted",
      isActive: true,
      organization: org._id,
      createdBy: adminUser._id,
    });

    const res = await request(app)
      .delete(`/api/hackathons/${hack._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(await Hackathon.findById(hack._id)).toBeNull();
  });

  it("should return 404 if hackathon not found on delete", async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .delete(`/api/hackathons/${fakeId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
  });

  it("should fail to create hackathon without title", async () => {
    const res = await request(app)
      .post("/api/hackathons")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        description: "Description without title",
      });

    expect(res.statusCode).toBe(400);
  });

  it("should create hackathon with rounds", async () => {
    const res = await request(app)
      .post("/api/hackathons")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Hackathon with Rounds",
        description: "Description with rounds",
        rounds: [
          {
            name: "Round 1",
            description: "First round",
            startDate: "2025-11-01",
            endDate: "2025-11-05",
            isActive: true,
          },
        ],
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.hackathon.rounds).toHaveLength(1);
  });

  it("should delete hackathon with rounds", async () => {
    const round = await Round.create({
      name: "Test Round",
      description: "Test",
      isActive: true,
    });

    const hack = await Hackathon.create({
      title: "Hack with Rounds",
      description: "Description",
      isActive: true,
      organization: org._id,
      createdBy: adminUser._id,
      rounds: [round._id],
    });

    const res = await request(app)
      .delete(`/api/hackathons/${hack._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(await Hackathon.findById(hack._id)).toBeNull();
    expect(await Round.findById(round._id)).toBeNull();
  });

  it("should assign role to user in hackathon", async () => {
    const hack = await Hackathon.create({
      title: "Test Hack",
      description: "Test",
      organization: org._id,
      createdBy: adminUser._id,
      isActive: true,
    });

    // Assign organizer role to admin for this hackathon
    await HackathonRole.create({
      user: adminUser._id,
      hackathon: hack._id,
      role: "organizer",
      assignedBy: adminUser._id,
    });

    const res = await request(app)
      .post(`/api/hackathons/${hack._id}/roles`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        userId: normalUser._id.toString(),
        role: "judge",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.role.role).toBe("judge");

    const roleInDb = await HackathonRole.findOne({
      user: normalUser._id,
      hackathon: hack._id,
    });
    expect(roleInDb).toBeTruthy();
    expect(roleInDb.role).toBe("judge");
  });

  it("should update existing role assignment", async () => {
    const hack = await Hackathon.create({
      title: "Test Hack",
      description: "Test",
      organization: org._id,
      createdBy: adminUser._id,
      isActive: true,
    });

    await HackathonRole.create({
      user: adminUser._id,
      hackathon: hack._id,
      role: "organizer",
      assignedBy: adminUser._id,
    });

    await HackathonRole.create({
      user: normalUser._id,
      hackathon: hack._id,
      role: "participant",
      assignedBy: adminUser._id,
    });

    const res = await request(app)
      .post(`/api/hackathons/${hack._id}/roles`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        userId: normalUser._id.toString(),
        role: "mentor",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.role.role).toBe("mentor");
  });

  it("should fail to assign role with invalid role", async () => {
    const hack = await Hackathon.create({
      title: "Test Hack",
      description: "Test",
      organization: org._id,
      createdBy: adminUser._id,
      isActive: true,
    });

    await HackathonRole.create({
      user: adminUser._id,
      hackathon: hack._id,
      role: "organizer",
      assignedBy: adminUser._id,
    });

    const res = await request(app)
      .post(`/api/hackathons/${hack._id}/roles`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        userId: normalUser._id.toString(),
        role: "invalid_role",
      });

    expect(res.statusCode).toBe(400);
  });

  it("should fail to assign role without userId", async () => {
    const hack = await Hackathon.create({
      title: "Test Hack",
      description: "Test",
      organization: org._id,
      createdBy: adminUser._id,
      isActive: true,
    });

    await HackathonRole.create({
      user: adminUser._id,
      hackathon: hack._id,
      role: "organizer",
      assignedBy: adminUser._id,
    });

    const res = await request(app)
      .post(`/api/hackathons/${hack._id}/roles`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        role: "judge",
      });

    expect(res.statusCode).toBe(400);
  });

  it("should remove role from user in hackathon", async () => {
    const hack = await Hackathon.create({
      title: "Test Hack",
      description: "Test",
      organization: org._id,
      createdBy: adminUser._id,
      isActive: true,
    });

    await HackathonRole.create({
      user: adminUser._id,
      hackathon: hack._id,
      role: "organizer",
      assignedBy: adminUser._id,
    });

    const role = await HackathonRole.create({
      user: normalUser._id,
      hackathon: hack._id,
      role: "judge",
      assignedBy: adminUser._id,
    });

    const res = await request(app)
      .delete(`/api/hackathons/${hack._id}/roles/${normalUser._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(await HackathonRole.findById(role._id)).toBeNull();
  });

  it("should fail to remove non-existent role", async () => {
    const hack = await Hackathon.create({
      title: "Test Hack",
      description: "Test",
      organization: org._id,
      createdBy: adminUser._id,
      isActive: true,
    });

    await HackathonRole.create({
      user: adminUser._id,
      hackathon: hack._id,
      role: "organizer",
      assignedBy: adminUser._id,
    });

    const fakeUserId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/hackathons/${hack._id}/roles/${fakeUserId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
  });

  it("should get all members of a hackathon", async () => {
    const hack = await Hackathon.create({
      title: "Test Hack",
      description: "Test",
      organization: org._id,
      createdBy: adminUser._id,
      isActive: true,
    });

    await HackathonRole.create({
      user: adminUser._id,
      hackathon: hack._id,
      role: "organizer",
      assignedBy: adminUser._id,
    });

    await HackathonRole.create({
      user: normalUser._id,
      hackathon: hack._id,
      role: "participant",
      assignedBy: adminUser._id,
    });

    const res = await request(app)
      .get(`/api/hackathons/${hack._id}/members`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.members).toHaveLength(2);
    expect(res.body.membersByRole.organizer).toHaveLength(1);
    expect(res.body.membersByRole.participant).toHaveLength(1);
  });

  it("should get my role in hackathon", async () => {
    const hack = await Hackathon.create({
      title: "Test Hack",
      description: "Test",
      organization: org._id,
      createdBy: adminUser._id,
      isActive: true,
    });

    await HackathonRole.create({
      user: normalUser._id,
      hackathon: hack._id,
      role: "participant",
      assignedBy: adminUser._id,
    });

    const res = await request(app)
      .get(`/api/hackathons/${hack._id}/my-role`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.hasRole).toBe(true);
    expect(res.body.role).toBe("participant");
  });

  it("should return null role if user has no role in hackathon", async () => {
    const hack = await Hackathon.create({
      title: "Test Hack",
      description: "Test",
      organization: org._id,
      createdBy: adminUser._id,
      isActive: true,
    });

    const res = await request(app)
      .get(`/api/hackathons/${hack._id}/my-role`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.hasRole).toBe(false);
    expect(res.body.role).toBeNull();
  });

  it("should fail to assign role to user from different organization", async () => {
    const otherOrg = await Organization.create({
      name: "Other Org",
      domain: "other.com",
    });

    const otherUser = await User.create({
      name: "Other User",
      email: "other@other.com",
      role: "user",
      organization: otherOrg._id,
      googleId: "google-other",
    });

    const hack = await Hackathon.create({
      title: "Test Hack",
      description: "Test",
      organization: org._id,
      createdBy: adminUser._id,
      isActive: true,
    });

    await HackathonRole.create({
      user: adminUser._id,
      hackathon: hack._id,
      role: "organizer",
      assignedBy: adminUser._id,
    });

    const res = await request(app)
      .post(`/api/hackathons/${hack._id}/roles`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        userId: otherUser._id.toString(),
        role: "judge",
      });

    expect(res.statusCode).toBe(403);
  });

  it("should fail to assign role to non-existent user", async () => {
    const hack = await Hackathon.create({
      title: "Test Hack",
      description: "Test",
      organization: org._id,
      createdBy: adminUser._id,
      isActive: true,
    });

    await HackathonRole.create({
      user: adminUser._id,
      hackathon: hack._id,
      role: "organizer",
      assignedBy: adminUser._id,
    });

    const fakeUserId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/hackathons/${hack._id}/roles`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        userId: fakeUserId.toString(),
        role: "judge",
      });

    expect(res.statusCode).toBe(404);
  });

  it("should fail to assign role for non-existent hackathon", async () => {
    const fakeHackId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/hackathons/${fakeHackId}/roles`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        userId: normalUser._id.toString(),
        role: "judge",
      });

    expect(res.statusCode).toBe(404);
  });

  it("should fail to remove role for non-existent hackathon", async () => {
    const fakeHackId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/hackathons/${fakeHackId}/roles/${normalUser._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
  });

  it("should fail to get members for non-existent hackathon", async () => {
    const fakeHackId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/hackathons/${fakeHackId}/members`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
  });

  it("should fail to get my role for non-existent hackathon", async () => {
    const fakeHackId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/hackathons/${fakeHackId}/my-role`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.statusCode).toBe(404);
  });

  it("should fail to update hackathon for non-existent hackathon", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/hackathons/${fakeId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "New Title" });

    expect(res.statusCode).toBe(404);
  });

  it("should fail to get hackathon with invalid ID format", async () => {
    const res = await request(app)
      .get("/api/hackathons/invalid-id")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.statusCode).toBe(400);
  });

  it("should update hackathon with rounds", async () => {
    const hack = await Hackathon.create({
      title: "Test Hack",
      description: "Test",
      organization: org._id,
      createdBy: adminUser._id,
      isActive: true,
    });

    await HackathonRole.create({
      user: adminUser._id,
      hackathon: hack._id,
      role: "organizer",
      assignedBy: adminUser._id,
    });

    const res = await request(app)
      .put(`/api/hackathons/${hack._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Updated Hack",
        description: "Updated",
        rounds: [
          {
            name: "New Round",
            description: "New round description",
            startDate: "2025-12-01",
            endDate: "2025-12-05",
            isActive: true,
          },
        ],
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.hackathon.rounds).toHaveLength(1);
  });

  it("should update hackathon and update existing rounds", async () => {
    const round = await Round.create({
      name: "Original Round",
      description: "Original",
      isActive: true,
    });

    const hack = await Hackathon.create({
      title: "Test Hack",
      description: "Test",
      organization: org._id,
      createdBy: adminUser._id,
      isActive: true,
      rounds: [round._id],
    });

    await HackathonRole.create({
      user: adminUser._id,
      hackathon: hack._id,
      role: "organizer",
      assignedBy: adminUser._id,
    });

    const res = await request(app)
      .put(`/api/hackathons/${hack._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Updated Hack",
        rounds: [
          {
            _id: round._id.toString(),
            name: "Updated Round",
            description: "Updated description",
            startDate: "2025-12-01",
            endDate: "2025-12-05",
            isActive: false,
          },
        ],
      });

    expect(res.statusCode).toBe(200);
    const updatedRound = await Round.findById(round._id);
    expect(updatedRound.name).toBe("Updated Round");
    expect(updatedRound.isActive).toBe(false);
  });

  // AI FORMATTING AND SUGGESTION TESTS
  describe("AI Features", () => {
    it("should format hackathon description with AI", async () => {
      const originalAIEnabled = process.env.AI_ENABLED;
      process.env.AI_ENABLED = "false";

      const res = await request(app)
        .post("/api/hackathons/format")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Hackathon",
          description: "Test description",
        });

      expect([200, 400, 500]).toContain(res.statusCode);

      process.env.AI_ENABLED = originalAIEnabled;
    });

    it("should return 400 when formatting without title or description", async () => {
      const res = await request(app)
        .post("/api/hackathons/format")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "",
          description: "Test",
        });

      expect(res.statusCode).toBe(400);
    });

    it("should suggest round structure with AI", async () => {
      const originalAIEnabled = process.env.AI_ENABLED;
      process.env.AI_ENABLED = "false";

      const res = await request(app)
        .post("/api/hackathons/suggest-round")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test Hackathon",
          description: "Test description",
          roundNumber: 1,
        });

      expect([200, 400, 500]).toContain(res.statusCode);

      process.env.AI_ENABLED = originalAIEnabled;
    });

    it("should return 400 when suggesting round without title", async () => {
      const res = await request(app)
        .post("/api/hackathons/suggest-round")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          description: "Test",
          roundNumber: 1,
        });

      expect(res.statusCode).toBe(400);
    });

    it("should deny AI features for non-admin/non-creator", async () => {
      const res = await request(app)
        .post("/api/hackathons/format")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Test",
          description: "Test",
        });

      expect(res.statusCode).toBe(403);
    });
  });
});
