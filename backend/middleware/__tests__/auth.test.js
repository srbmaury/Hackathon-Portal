// middleware/__tests__/auth.test.js

import { setupTestEnv, getApp, describe, it, beforeAll, afterAll, expect, request, jwt, mongoose, connectTestDb, closeTestDb } from "../../controllers/__tests__/helpers/testSetup.js";
import { setupBasicTestEnv } from "../../controllers/__tests__/helpers/testHelpers.js";
import { assertSuccess, assertUnauthorized, assertNotFound } from "../../controllers/__tests__/helpers/assertions.js";

const JWT_SECRET = setupTestEnv();
const app = getApp();

describe("Auth Middleware", () => {
  let org, normalUser, validToken;

  beforeAll(async () => {
    await connectTestDb();
    const env = await setupBasicTestEnv(JWT_SECRET);
    org = env.org;
    normalUser = env.normalUser;
    validToken = env.userToken;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("should reject request without token", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", "");

    assertUnauthorized(res);
  });

  it("should reject request with invalid token", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", "Bearer invalid-token");

    // Could be 401 (unauthorized) or 404 (user not found after token decode)
    expect([401, 404]).toContain(res.statusCode);
  });

  it("should reject request with expired token", async () => {
    const expiredToken = jwt.sign(
      {
        id: normalUser._id.toString(),
        role: "user",
        organization: org._id.toString(),
      },
      JWT_SECRET,
      { expiresIn: "-1h" }
    );

    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${expiredToken}`);

    assertUnauthorized(res);
  });

  it("should reject request with token for non-existent user", async () => {
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

    // Returns 404 when user is not found (resource not found)
    // which is semantically more accurate than 401 (unauthorized)
    assertNotFound(res);
  });

  it("should accept request with valid token", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${validToken}`);

    assertSuccess(res);
  });
});
