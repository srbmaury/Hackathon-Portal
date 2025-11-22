import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, clearDb, closeTestDb } from "../../setup/testDb.js";
import Idea from "../../models/Idea.js";
import User from "../../models/User.js";
import Organization from "../../models/Organization.js";
import mongoose from "mongoose";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const IdeaService = require("../ideaService.js");

describe("IdeaService", () => {
  let org, user1, user2, idea1, idea2, idea3;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearDb();

    // Create test organization
    org = await Organization.create({
      name: "Test Org",
      domain: "test.com",
    });

    // Create test users
    user1 = await User.create({
      name: "User One",
      email: "user1@test.com",
      googleId: "google-user1-id",
      organization: org._id,
      role: "user",
    });

    user2 = await User.create({
      name: "User Two",
      email: "user2@test.com",
      googleId: "google-user2-id",
      organization: org._id,
      role: "user",
    });

    // Create test ideas
    idea1 = await Idea.create({
      title: "Public Idea 1",
      description: "This is a public idea",
      submitter: user1._id,
      isPublic: true,
      organization: org._id,
    });

    idea2 = await Idea.create({
      title: "Private Idea 1",
      description: "This is a private idea",
      submitter: user1._id,
      isPublic: false,
      organization: org._id,
    });

    idea3 = await Idea.create({
      title: "Public Idea 2",
      description: "This is another public idea",
      submitter: user2._id,
      isPublic: true,
      organization: org._id,
    });
  });

  describe("getPublicIdeas", () => {
    it("should get all public ideas for organization", async () => {
      const ideas = await IdeaService.getPublicIdeas(org._id);

      expect(ideas).toHaveLength(2);
      expect(ideas[0].title).toBe("Public Idea 2"); // Most recent first
      expect(ideas[1].title).toBe("Public Idea 1");
      expect(ideas.every(idea => idea.isPublic === true)).toBe(true);
    });

    it("should get all public ideas without organization filter", async () => {
      const ideas = await IdeaService.getPublicIdeas(null);

      expect(ideas.length).toBeGreaterThanOrEqual(2);
      expect(ideas.every(idea => idea.isPublic === true)).toBe(true);
    });

    it("should return empty array when no public ideas exist", async () => {
      await Idea.deleteMany({ isPublic: true });

      const ideas = await IdeaService.getPublicIdeas(org._id);

      expect(ideas).toHaveLength(0);
    });

    it("should populate submitter information", async () => {
      const ideas = await IdeaService.getPublicIdeas(org._id);

      expect(ideas[0].submitter).toBeDefined();
      expect(ideas[0].submitter.name).toBeDefined();
      expect(ideas[0].submitter._id).toBeDefined();
    });

    it("should sort ideas by creation date (newest first)", async () => {
      const ideas = await IdeaService.getPublicIdeas(org._id);

      const dates = ideas.map(idea => new Date(idea.createdAt).getTime());
      const sortedDates = [...dates].sort((a, b) => b - a);
      expect(dates).toEqual(sortedDates);
    });
  });

  describe("createIdea", () => {
    it("should create a public idea successfully", async () => {
      const ideaData = {
        title: "New Public Idea",
        description: "This is a new public idea",
        submitterId: user1._id,
        isPublic: true,
        organization: org._id,
      };

      const newIdea = await IdeaService.createIdea(ideaData);

      expect(newIdea._id).toBeDefined();
      expect(newIdea.title).toBe("New Public Idea");
      expect(newIdea.description).toBe("This is a new public idea");
      expect(newIdea.submitter.toString()).toBe(user1._id.toString());
      expect(newIdea.isPublic).toBe(true);
      expect(newIdea.organization.toString()).toBe(org._id.toString());
    });

    it("should create a private idea successfully", async () => {
      const ideaData = {
        title: "New Private Idea",
        description: "This is a new private idea",
        submitterId: user2._id,
        isPublic: false,
        organization: org._id,
      };

      const newIdea = await IdeaService.createIdea(ideaData);

      expect(newIdea.isPublic).toBe(false);
      expect(newIdea.submitter.toString()).toBe(user2._id.toString());
    });

    it("should throw error when title is missing", async () => {
      const ideaData = {
        description: "Description only",
        submitterId: user1._id,
        isPublic: true,
        organization: org._id,
      };

      await expect(IdeaService.createIdea(ideaData)).rejects.toThrow(
        "Title, description, and isPublic are required"
      );
    });

    it("should throw error when description is missing", async () => {
      const ideaData = {
        title: "Title only",
        submitterId: user1._id,
        isPublic: true,
        organization: org._id,
      };

      await expect(IdeaService.createIdea(ideaData)).rejects.toThrow(
        "Title, description, and isPublic are required"
      );
    });

    it("should throw error when isPublic is not a boolean", async () => {
      const ideaData = {
        title: "Title",
        description: "Description",
        submitterId: user1._id,
        isPublic: "not a boolean",
        organization: org._id,
      };

      await expect(IdeaService.createIdea(ideaData)).rejects.toThrow(
        "Title, description, and isPublic are required"
      );
    });

    it("should throw error when organization is missing", async () => {
      const ideaData = {
        title: "Title",
        description: "Description",
        submitterId: user1._id,
        isPublic: true,
      };

      await expect(IdeaService.createIdea(ideaData)).rejects.toThrow(
        "Organization is required"
      );
    });

    it("should handle isPublic as false explicitly", async () => {
      const ideaData = {
        title: "Explicit False",
        description: "Description",
        submitterId: user1._id,
        isPublic: false,
        organization: org._id,
      };

      const newIdea = await IdeaService.createIdea(ideaData);
      expect(newIdea.isPublic).toBe(false);
    });
  });

  describe("getIdeasByUser", () => {
    it("should get all ideas for a specific user", async () => {
      const ideas = await IdeaService.getIdeasByUser(user1._id, org._id);

      expect(ideas).toHaveLength(2); // idea1 and idea2
      expect(ideas.every(idea => idea.submitter._id.toString() === user1._id.toString())).toBe(true);
    });

    it("should get ideas for user without organization filter", async () => {
      const ideas = await IdeaService.getIdeasByUser(user1._id, null);

      expect(ideas.length).toBeGreaterThanOrEqual(2);
      expect(ideas.every(idea => idea.submitter._id.toString() === user1._id.toString())).toBe(true);
    });

    it("should return empty array when user has no ideas", async () => {
      const newUser = await User.create({
        name: "New User",
        email: "newuser@test.com",
        googleId: "google-newuser-id",
        organization: org._id,
        role: "user",
      });

      const ideas = await IdeaService.getIdeasByUser(newUser._id, org._id);

      expect(ideas).toHaveLength(0);
    });

    it("should populate submitter information", async () => {
      const ideas = await IdeaService.getIdeasByUser(user1._id, org._id);

      expect(ideas[0].submitter).toBeDefined();
      expect(ideas[0].submitter.name).toBe("User One");
    });

    it("should include both public and private ideas for the user", async () => {
      const ideas = await IdeaService.getIdeasByUser(user1._id, org._id);

      const hasPublic = ideas.some(idea => idea.isPublic === true);
      const hasPrivate = ideas.some(idea => idea.isPublic === false);

      expect(hasPublic).toBe(true);
      expect(hasPrivate).toBe(true);
    });

    it("should sort ideas by creation date (newest first)", async () => {
      const ideas = await IdeaService.getIdeasByUser(user1._id, org._id);

      const dates = ideas.map(idea => new Date(idea.createdAt).getTime());
      const sortedDates = [...dates].sort((a, b) => b - a);
      expect(dates).toEqual(sortedDates);
    });
  });

  describe("updateIdea", () => {
    it("should update idea successfully when user is owner", async () => {
      const updateData = {
        title: "Updated Title",
        description: "Updated Description",
        isPublic: false,
      };

      const updatedIdea = await IdeaService.updateIdea(
        user1._id.toString(),
        idea1._id,
        updateData
      );

      expect(updatedIdea.title).toBe("Updated Title");
      expect(updatedIdea.description).toBe("Updated Description");
      expect(updatedIdea.isPublic).toBe(false);
    });

    it("should change idea from private to public", async () => {
      const updateData = {
        title: idea2.title,
        description: idea2.description,
        isPublic: true,
      };

      const updatedIdea = await IdeaService.updateIdea(
        user1._id.toString(),
        idea2._id,
        updateData
      );

      expect(updatedIdea.isPublic).toBe(true);
    });

    it("should throw error when idea not found", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const updateData = {
        title: "Title",
        description: "Description",
        isPublic: true,
      };

      await expect(
        IdeaService.updateIdea(user1._id.toString(), fakeId, updateData)
      ).rejects.toThrow("Idea not found");
    });

    it("should throw error when user is not the owner", async () => {
      const updateData = {
        title: "Unauthorized Update",
        description: "Description",
        isPublic: true,
      };

      await expect(
        IdeaService.updateIdea(user2._id.toString(), idea1._id, updateData)
      ).rejects.toThrow("Unauthorized");
    });

    it("should throw error when title is missing in update", async () => {
      const updateData = {
        description: "Description only",
        isPublic: true,
      };

      await expect(
        IdeaService.updateIdea(user1._id.toString(), idea1._id, updateData)
      ).rejects.toThrow("Title, description, and isPublic are required");
    });

    it("should throw error when description is missing in update", async () => {
      const updateData = {
        title: "Title only",
        isPublic: true,
      };

      await expect(
        IdeaService.updateIdea(user1._id.toString(), idea1._id, updateData)
      ).rejects.toThrow("Title, description, and isPublic are required");
    });

    it("should throw error when isPublic is not boolean in update", async () => {
      const updateData = {
        title: "Title",
        description: "Description",
        isPublic: "not a boolean",
      };

      await expect(
        IdeaService.updateIdea(user1._id.toString(), idea1._id, updateData)
      ).rejects.toThrow("Title, description, and isPublic are required");
    });

    it("should persist changes to database", async () => {
      const updateData = {
        title: "Persisted Update",
        description: "This should be saved",
        isPublic: false,
      };

      await IdeaService.updateIdea(user1._id.toString(), idea1._id, updateData);

      const ideaFromDb = await Idea.findById(idea1._id);
      expect(ideaFromDb.title).toBe("Persisted Update");
      expect(ideaFromDb.description).toBe("This should be saved");
      expect(ideaFromDb.isPublic).toBe(false);
    });
  });

  describe("deleteIdea", () => {
    it("should delete idea successfully when user is owner", async () => {
      const result = await IdeaService.deleteIdea(user1._id.toString(), idea1._id);

      expect(result.acknowledged).toBe(true);
      expect(result.deletedCount).toBe(1);

      const deletedIdea = await Idea.findById(idea1._id);
      expect(deletedIdea).toBeNull();
    });

    it("should throw error when idea not found", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await expect(
        IdeaService.deleteIdea(user1._id.toString(), fakeId)
      ).rejects.toThrow("Idea not found");
    });

    it("should throw error when user is not the owner", async () => {
      await expect(
        IdeaService.deleteIdea(user2._id.toString(), idea1._id)
      ).rejects.toThrow("Unauthorized");
    });

    it("should actually remove idea from database", async () => {
      await IdeaService.deleteIdea(user1._id.toString(), idea1._id);

      const allIdeas = await Idea.find({});
      const ideaExists = allIdeas.some(
        idea => idea._id.toString() === idea1._id.toString()
      );

      expect(ideaExists).toBe(false);
    });

    it("should allow user to delete their own private idea", async () => {
      const result = await IdeaService.deleteIdea(user1._id.toString(), idea2._id);

      expect(result.acknowledged).toBe(true);
      expect(result.deletedCount).toBe(1);

      const deletedIdea = await Idea.findById(idea2._id);
      expect(deletedIdea).toBeNull();
    });

    it("should not affect other ideas when deleting one", async () => {
      const initialCount = await Idea.countDocuments();

      await IdeaService.deleteIdea(user1._id.toString(), idea1._id);

      const finalCount = await Idea.countDocuments();
      expect(finalCount).toBe(initialCount - 1);
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully in getPublicIdeas", async () => {
      await closeTestDb();

      await expect(IdeaService.getPublicIdeas(org._id)).rejects.toThrow();

      await connectTestDb();
    });

    it("should handle invalid ObjectId in updateIdea", async () => {
      const updateData = {
        title: "Title",
        description: "Description",
        isPublic: true,
      };

      await expect(
        IdeaService.updateIdea(user1._id.toString(), "invalid-id", updateData)
      ).rejects.toThrow();
    });

    it("should handle invalid ObjectId in deleteIdea", async () => {
      await expect(
        IdeaService.deleteIdea(user1._id.toString(), "invalid-id")
      ).rejects.toThrow();
    });
  });
});

