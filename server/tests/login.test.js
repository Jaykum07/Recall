import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { beforeEach, test } from "node:test";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ipKeyGenerator } from "express-rate-limit";
import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/user.model.js";
import { loginRateLimiter } from "../src/middleware/auth-rate-limit.middleware.js";

const password = "  example-only-login-password  ";
const passwordHash = await bcrypt.hash(password, 12);
const user = new User({ name: "Jay", email: "jay@example.com", passwordHash });
const validInput = { email: "  JAY@example.com  ", password };

beforeEach(() => {
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  process.env.JWT_ISSUER = "recall-test-api";
  process.env.JWT_AUDIENCE = "recall-test-client";
  for (const ip of ["127.0.0.1", "::ffff:127.0.0.1", "::1"]) {
    loginRateLimiter.resetKey(ipKeyGenerator(ip));
  }
});

const mockLookup = (t, result) => t.mock.method(User, "findOne", (filter) => {
  assert.deepEqual(filter, { email: "jay@example.com" });
  return { select: async (selection) => {
    assert.equal(selection, "+passwordHash");
    return result;
  } };
});

test("login normalizes email, explicitly retrieves the hash, and returns only safe user fields", async (t) => {
  mockLookup(t, user);
  const compare = t.mock.method(bcrypt, "compare");
  const res = await request(app).post("/api/auth/login").send(validInput);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    success: true, message: "Login successful",
    data: {
      user: { id: user._id.toString(), name: "Jay", email: "jay@example.com" },
      accessToken: res.body.data.accessToken,
    },
  });
  const verified = jwt.verify(res.body.data.accessToken, Buffer.from(process.env.JWT_SECRET, "hex"), {
    algorithms: ["HS256"], issuer: process.env.JWT_ISSUER, audience: process.env.JWT_AUDIENCE,
    complete: true,
  });
  assert.equal(verified.header.alg, "HS256");
  assert.equal(verified.payload.sub, user._id.toString());
  assert.equal(verified.payload.exp - verified.payload.iat, 900);
  assert.deepEqual(Object.keys(verified.payload).sort(), ["aud", "exp", "iat", "iss", "sub"]);
  assert.deepEqual(compare.mock.calls[0].arguments, [password, passwordHash]);
  assert.ok(!res.headers["set-cookie"]);
  assert.ok(!JSON.stringify(res.body).includes(passwordHash));
  assert.ok(!JSON.stringify(res.body).includes(password));
});

const invalidCredentials = { success: false, message: "Invalid email or password", errors: null };

test("incorrect password returns a generic 401", async (t) => {
  mockLookup(t, user);
  const sign = t.mock.method(jwt, "sign");
  const res = await request(app).post("/api/auth/login").send({ ...validInput, password: "incorrect-password" });
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, invalidCredentials);
  assert.equal(sign.mock.callCount(), 0);
});

test("unknown email returns the same generic 401 and still performs a bcrypt comparison", async (t) => {
  mockLookup(t, null);
  const sign = t.mock.method(jwt, "sign");
  const compare = t.mock.method(bcrypt, "compare");
  const res = await request(app).post("/api/auth/login").send(validInput);
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, invalidCredentials);
  assert.equal(compare.mock.callCount(), 1);
  assert.equal(sign.mock.callCount(), 0);
});

test("invalid login input is rejected before any database query", async (t) => {
  const find = t.mock.method(User, "findOne", () => { throw new Error("Must not query"); });
  const invalidInputs = [
    {}, { email: validInput.email }, { password }, null, [],
    { ...validInput, email: "invalid" },
    { ...validInput, email: { $ne: null } },
    { ...validInput, password: 123456789012 },
    { ...validInput, password: "short" },
    { ...validInput, password: "a".repeat(73) },
    { ...validInput, password: "\u{1F600}".repeat(19) },
    { ...validInput, passwordHash: "client-supplied" },
    { ...validInput, userId: "spoofed-owner" },
  ];
  for (const input of invalidInputs) {
    const res = await request(app).post("/api/auth/login").send(input);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Validation failed");
    assert.ok(Array.isArray(res.body.errors));
    assert.ok(!JSON.stringify(res.body).includes(password));
  }
  assert.equal(find.mock.callCount(), 0);
});

test("login database failures do not disclose internal details", async (t) => {
  t.mock.method(User, "findOne", () => { throw new Error("private database details"); });
  const res = await request(app).post("/api/auth/login").send(validInput);
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { success: false, message: "Internal Server Error", errors: null });
});

test("valid credentials with missing JWT configuration fail safely without a token", async (t) => {
  mockLookup(t, user);
  const sign = t.mock.method(jwt, "sign");
  delete process.env.JWT_SECRET;
  const res = await request(app).post("/api/auth/login").send(validInput);
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { success: false, message: "Internal Server Error", errors: null });
  assert.equal(sign.mock.callCount(), 0);
});

test("valid credentials with an invalid secret fail safely without a token", async (t) => {
  mockLookup(t, user);
  const sign = t.mock.method(jwt, "sign");
  process.env.JWT_SECRET = "invalid-private-config";
  const res = await request(app).post("/api/auth/login").send(validInput);
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { success: false, message: "Internal Server Error", errors: null });
  assert.equal(sign.mock.callCount(), 0);
});

test("signing failures return a generic error without leaking secrets or user data", async (t) => {
  mockLookup(t, user);
  t.mock.method(jwt, "sign", () => { throw new Error(process.env.JWT_SECRET); });
  const res = await request(app).post("/api/auth/login").send(validInput);
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { success: false, message: "Internal Server Error", errors: null });
});

test("malformed login JSON does not disclose credential fragments", async () => {
  const res = await request(app).post("/api/auth/login")
    .set("Content-Type", "application/json").send('{"password":"example-only-private-input",');
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { success: false, message: "Invalid JSON body", errors: null });
});

test("login attempts have a separate rate limit", async () => {
  for (let attempt = 0; attempt < 20; attempt++) {
    assert.equal((await request(app).post("/api/auth/login").send({})).status, 400);
  }
  const res = await request(app).post("/api/auth/login").send({});
  assert.equal(res.status, 429);
  assert.deepEqual(res.body, { success: false, message: "Too many login attempts. Please try again later.", errors: null });
  assert.ok(res.headers["retry-after"]);
  assert.ok(res.headers["ratelimit"]);
  assert.equal((await request(app).post("/api/auth/register").send({})).status, 400);
});
