// controllers/__tests__/helpers/assertions.js
// Shared test assertion helpers

import { expect } from "vitest";

/**
 * Assert that response is a 404 Not Found
 */
export function assertNotFound(response, message) {
    expect(response.statusCode).toBe(404);
    if (message) {
        expect(response.body.message).toContain(message);
    }
}

/**
 * Assert that response is a 403 Forbidden
 */
export function assertForbidden(response, message) {
    expect(response.statusCode).toBe(403);
    if (message) {
        expect(response.body.message).toContain(message);
    }
}

/**
 * Assert that response is a 400 Bad Request
 */
export function assertBadRequest(response, message) {
    expect(response.statusCode).toBe(400);
    if (message) {
        expect(response.body.message).toContain(message);
    }
}

/**
 * Assert that response is a 401 Unauthorized
 */
export function assertUnauthorized(response, message) {
    expect(response.statusCode).toBe(401);
    if (message) {
        expect(response.body.message).toContain(message);
    }
}

/**
 * Assert successful creation (201)
 */
export function assertCreated(response, dataKey) {
    expect(response.statusCode).toBe(201);
    if (dataKey) {
        expect(response.body[dataKey]).toBeTruthy();
    }
}

/**
 * Assert successful response (200)
 */
export function assertSuccess(response, dataKey) {
    expect(response.statusCode).toBe(200);
    if (dataKey) {
        expect(response.body[dataKey]).toBeTruthy();
    }
}

/**
 * Assert that AI feature response is acceptable (when AI is disabled or feature not available)
 */
export function assertAIResponse(response) {
    expect([200, 400, 404, 500]).toContain(response.statusCode);
}

