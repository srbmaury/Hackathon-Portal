// controllers/__tests__/helpers/testSetup.js
// Shared test setup configuration

import dotenv from "dotenv";

// Setup environment variables
export function setupTestEnv() {
    dotenv.config();
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "testsecret";
    return process.env.JWT_SECRET;
}

// Import app using CommonJS require
import { createRequire } from "module";
export function getApp() {
    const require = createRequire(import.meta.url);
    return require("../../../app");
}

// Re-export commonly used test utilities
export { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from "vitest";
export { default as request } from "supertest";
export { default as mongoose } from "mongoose";
export { default as jwt } from "jsonwebtoken";

// Note: vi must be imported directly in files that need mocking
// export { vi } from "vitest";

// Re-export database utilities
export { connectTestDb, clearDb, closeTestDb } from "../../../setup/testDb.js";

