import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/app.js";
import { errorMiddleware } from "../src/middleware/error.middleware.js";

const respond = (error) => {
  const result = {};
  const res = {
    headersSent: false,
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; return this; },
  };
  errorMiddleware(error, {}, res, () => assert.fail("Unexpected delegation"));
  return result;
};
const failure = (message, errors = null) => ({ success: false, message, errors });

test("Zod field details keep their array contract and discard extra metadata", () => {
  const result = respond(Object.assign(new Error("Validation failed"), {
    statusCode: 400,
    errors: [{ field: "email", message: "Invalid email address", value: "private-value" },
      { field: "", message: "Invalid request object" }],
  }));
  assert.deepEqual(result, { status: 400, body: failure("Validation failed", [
    { field: "email", message: "Invalid email address" },
    { field: "", message: "Invalid request object" },
  ]) });
});

test("Mongoose parent and field messages, values, and internal metadata are never exposed", () => {
  const secret = "private-rejected-content-and-internal-details";
  const error = new mongoose.Error.ValidationError();
  const messages = {
    required: "This field is required", enum: "Invalid option",
    minlength: "Value is too short", maxlength: "Value is too long",
    min: "Value is below the minimum", max: "Value exceeds the maximum",
    custom: "Invalid value",
  };
  const expected = [];
  for (const [kind, message] of Object.entries(messages)) {
    const path = `problemInfo.${kind}`;
    error.addError(path, new mongoose.Error.ValidatorError({ path, type: kind, message: secret, value: secret, reason: new Error(secret) }));
    expected.push({ field: path, message });
  }
  error.addError("userLearningInfo.firstSolvedAt", new mongoose.Error.CastError("Date", secret, "userLearningInfo.firstSolvedAt", new Error(secret)));
  expected.push({ field: "userLearningInfo.firstSolvedAt", message: "Invalid value type" });
  error.message = secret;
  assert.deepEqual(respond(error), { status: 400, body: failure("Validation failed", expected) });
  assert.ok(!JSON.stringify(respond(error)).includes(secret));
});

test("empty Mongoose validation details use null without exposing the parent message", () => {
  const error = new mongoose.Error.ValidationError();
  error.message = "private model details";
  assert.deepEqual(respond(error), { status: 400, body: failure("Validation failed") });
});

test("status selection accepts valid statusCode/status and safely rejects invalid values", () => {
  for (const statusCode of [undefined, 200, 600, -1, "400", 400.5]) {
    const error = Object.assign(new Error("private details"), { statusCode, errors: [{ value: "private" }] });
    assert.deepEqual(respond(error), { status: 500, body: failure("Internal Server Error") });
  }
  assert.deepEqual(respond({ status: 400, message: "Bad Request" }), { status: 400, body: failure("Bad Request") });
  assert.deepEqual(respond({ statusCode: 200, status: 401, message: "Authentication required" }), { status: 401, body: failure("Authentication required") });
  assert.deepEqual(respond({ statusCode: 409, status: 400, message: "Email is already registered" }), { status: 409, body: failure("Email is already registered") });
});

test("general application errors preserve public messages and use null details", () => {
  for (const [status, message] of [[401, "Invalid email or password"], [404, "Problem not found"], [409, "Email is already registered"]]) {
    assert.deepEqual(respond({ statusCode: status, message, errors: { value: "private" } }), { status, body: failure(message) });
  }
  assert.deepEqual(respond({ statusCode: 403, message: "private policy details" }), { status: 403, body: failure("Forbidden") });
  assert.deepEqual(respond({ statusCode: 400, message: "private driver details" }), { status: 400, body: failure("Bad Request") });
  assert.deepEqual(respond(Object.assign(new mongoose.Error.CastError("ObjectId", "private", "internal"), { statusCode: 500 })), {
    status: 500, body: failure("Internal Server Error"),
  });
  assert.deepEqual(respond({ name: "ValidationError", message: "private details", errors: { value: "private" } }), {
    status: 500, body: failure("Internal Server Error"),
  });
});

test("known parser errors use sanitized messages and preserve 400, 413, and 415", () => {
  for (const [type, status, message] of [
    ["entity.parse.failed", 400, "Invalid JSON body"],
    ["entity.too.large", 413, "Request body too large"],
    ["charset.unsupported", 415, "Unsupported request charset"],
    ["encoding.unsupported", 415, "Unsupported request encoding"],
    ["request.size.invalid", 400, "Invalid request body"],
    ["request.aborted", 400, "Invalid request body"],
  ]) {
    assert.deepEqual(respond({ type, statusCode: status, message: "private parser details", body: "private body", errors: { value: "private" } }), {
      status, body: failure(message),
    });
  }
});

test("errors after headers are sent are delegated unchanged", () => {
  const error = new Error("late failure");
  let delegated;
  errorMiddleware(error, {}, {
    headersSent: true,
    status() { assert.fail("Must not send another response"); },
  }, (received) => { delegated = received; });
  assert.equal(delegated, error);
});

test("unknown API routes and methods return JSON without changing non-API fallback behavior", async () => {
  for (const [method, path] of [["get", "/api/unknown"], ["post", "/api/test"], ["delete", "/api/health"]]) {
    const response = await request(app)[method](path);
    assert.equal(response.status, 404);
    assert.match(response.headers["content-type"], /application\/json/);
    assert.deepEqual(response.body, failure("Route not found"));
  }
  for (const path of ["/outside-api", "/api-other"]) {
    const response = await request(app).get(path);
    assert.equal(response.status, 404);
    assert.match(response.headers["content-type"], /text\/html/);
  }
  const protectedUnknown = await request(app).get("/api/problems/unknown/extra");
  assert.equal(protectedUnknown.status, 401);
  assert.deepEqual(protectedUnknown.body, failure("Authentication required"));
});

test("real JSON parsing errors are sanitized before authentication or route lookup", async () => {
  for (const payload of ['{"password":"private-input",', '"private-input"', "null"]) {
    const response = await request(app).post("/api/problems").set("Content-Type", "application/json").send(payload);
    assert.equal(response.status, 400);
    assert.deepEqual(response.body, failure("Invalid JSON body"));
  }
  const oversized = await request(app).post("/api/unknown").send({ value: "private".repeat(18000) });
  assert.equal(oversized.status, 413);
  assert.deepEqual(oversized.body, failure("Request body too large"));
  const charset = await request(app).post("/api/unknown").set("Content-Type", "application/json; charset=iso-8859-1").send('{}');
  assert.equal(charset.status, 415);
  assert.deepEqual(charset.body, failure("Unsupported request charset"));
  const encoding = await request(app).post("/api/unknown").set("Content-Type", "application/json")
    .set("Content-Encoding", "unsupported-private-encoding").send('{}');
  assert.equal(encoding.status, 415);
  assert.deepEqual(encoding.body, failure("Unsupported request encoding"));
});
