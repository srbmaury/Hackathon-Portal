// controllers/__tests__/helpers/testHelpers.js
// Shared test helper functions

import jwt from "jsonwebtoken";
import User from "../../../models/User.js";
import Organization from "../../../models/Organization.js";
import Hackathon from "../../../models/Hackathon.js";
import HackathonRole from "../../../models/HackathonRole.js";
import Round from "../../../models/Round.js";
import Idea from "../../../models/Idea.js";
import Team from "../../../models/Team.js";

/**
 * Generate JWT token for a user
 */
export function generateToken(userId, role, organizationId, jwtSecret) {
    return jwt.sign(
        { 
            id: userId.toString(), 
            role: role, 
            organization: organizationId?.toString() 
        },
        jwtSecret
    );
}

/**
 * Create a test organization
 */
export async function createTestOrg(name = "Test Org", domain = "testorg.com") {
    return await Organization.create({ name, domain });
}

/**
 * Create a test user
 */
export async function createTestUser(data) {
    const defaults = {
        name: "Test User",
        email: "test@example.com",
        role: "user",
        googleId: `google-${Date.now()}-${Math.random()}`,
    };
    
    return await User.create({ ...defaults, ...data });
}

/**
 * Create a test hackathon
 */
export async function createTestHackathon(data) {
    const defaults = {
        title: "Test Hackathon",
        description: "Test description",
        isActive: true,
    };
    
    return await Hackathon.create({ ...defaults, ...data });
}

/**
 * Create a test round
 */
export async function createTestRound(data) {
    const defaults = {
        name: "Test Round",
        description: "Test round description",
        isActive: true,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    };
    
    return await Round.create({ ...defaults, ...data });
}

/**
 * Create a test idea
 */
export async function createTestIdea(data) {
    const defaults = {
        title: "Test Idea",
        description: "Test idea description",
        isPublic: true,
    };
    
    return await Idea.create({ ...defaults, ...data });
}

/**
 * Create a test team
 */
export async function createTestTeam(data) {
    const defaults = {
        name: "Test Team",
    };
    
    return await Team.create({ ...defaults, ...data });
}

/**
 * Assign a hackathon role to a user
 */
export async function assignHackathonRole(userId, hackathonId, role, assignedById) {
    return await HackathonRole.create({
        user: userId,
        hackathon: hackathonId,
        role: role,
        assignedBy: assignedById,
    });
}

/**
 * Create a complete test environment with org, users, and tokens
 */
export async function setupBasicTestEnv(jwtSecret) {
    const org = await createTestOrg();
    
    const adminUser = await createTestUser({
        name: "Admin User",
        email: "admin@testorg.com",
        role: "admin",
        organization: org._id,
        googleId: "google-admin",
    });
    
    const normalUser = await createTestUser({
        name: "Normal User",
        email: "user@testorg.com",
        role: "user",
        organization: org._id,
        googleId: "google-user",
    });
    
    const adminToken = generateToken(adminUser._id, "admin", org._id, jwtSecret);
    const userToken = generateToken(normalUser._id, "user", org._id, jwtSecret);
    
    return {
        org,
        adminUser,
        normalUser,
        adminToken,
        userToken,
    };
}

/**
 * Create a complete hackathon test environment
 */
export async function setupHackathonTestEnv(jwtSecret) {
    const basic = await setupBasicTestEnv(jwtSecret);
    
    const organizer = await createTestUser({
        name: "Organizer User",
        email: "organizer@testorg.com",
        role: "hackathon_creator",
        organization: basic.org._id,
        googleId: "google-organizer",
    });
    
    const hackathon = await createTestHackathon({
        organization: basic.org._id,
        createdBy: organizer._id,
    });
    
    await assignHackathonRole(organizer._id, hackathon._id, "organizer", basic.adminUser._id);
    
    const organizerToken = generateToken(organizer._id, "hackathon_creator", basic.org._id, jwtSecret);
    
    return {
        ...basic,
        organizer,
        organizerToken,
        hackathon,
    };
}

