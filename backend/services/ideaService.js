const Idea = require("../models/Idea");

class IdeaService {
  async getPublicIdeas(organizationId) {
    const query = { isPublic: true };
    if (organizationId) {
      query.organization = organizationId;
    }
    return Idea.find(query).populate("submitter", "_id name").sort({ createdAt: -1 }) || [];
  }

  async createIdea({ title, description, submitterId, isPublic, organization }) {
    if (!title || !description || typeof isPublic !== "boolean") {
      throw new Error("Title, description, and isPublic are required");
    }
    if (!organization) {
      throw new Error("Organization is required");
    }
    const idea = new Idea({ title, description, submitter: submitterId, isPublic, organization });
    return idea.save();
  }

  async getIdeasByUser(userId, organizationId) {
    const query = { submitter: userId };
    if (organizationId) {
      query.organization = organizationId;
    }
    return Idea.find(query).populate("submitter", "_id name").sort({ createdAt: -1 }) || [];
  }

  async updateIdea(userId, ideaId, updateData) {
    const idea = await Idea.findById(ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.submitter.toString() !== userId) throw new Error("Unauthorized");

    const { title, description, isPublic } = updateData;
    if (!title || !description || typeof isPublic !== "boolean") {
      throw new Error("Title, description, and isPublic are required");
    }

    idea.title = title;
    idea.description = description;
    idea.isPublic = isPublic;

    return idea.save();
  }

  async deleteIdea(userId, ideaId) {
    const idea = await Idea.findById(ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.submitter.toString() !== userId) throw new Error("Unauthorized");

    return Idea.deleteOne({ _id: ideaId });
  }

  async getIdeaById(ideaId) {
    return Idea.findById(ideaId).populate("submitter", "_id name email");
  }
}

module.exports = new IdeaService();
