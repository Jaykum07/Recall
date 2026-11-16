import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import bcrypt from "bcrypt";
import { ipKeyGenerator } from "express-rate-limit";
import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/user.model.js";
import { registrationRateLimiter } from "../src/middleware/auth-rate-limit.middleware.js";

const validInput = {
  name: "  Jay  ",
  email: "  JAY@example.com  ",
  password: "example-only-long-password",
};

beforeEach(() => {
  for (const ip of ["127.0.0.1", "::ffff:127.0.0.1", "::1"]) {
    registrationRateLimiter.resetKey(ipKeyGenerator(ip));
  }
});

test("registration normalizes identity, hashes the unchanged password, and returns only safe fields", async (t) => {
  let stored;
  t.mock.method(User, "init", async () => User);
  t.mock.method(User, "create", async (data) => {
    stored = data;
    return new User(data);
  });
  const input = { ...validInput, password: "  example-only-long-password  " };
  const res = await request(app).post("/api/auth/register").send(input);
  assert.equal(res.status, 201);
  assert.equal(stored.name, "Jay");
  assert.equal(stored.email, "jay@example.com");
  assert.ok(!Object.hasOwn(stored, "password"));
  assert.ok(stored.passwordHash !== input.password);
  assert.ok(await bcrypt.compare(input.password, stored.passwordHash));
  assert.equal(bcrypt.getRounds(stored.passwordHash), 12);
  assert.deepEqual(Object.keys(res.body.data.user).sort(), ["email", "id", "name"]);
  assert.ok(!JSON.stringify(res.body).includes(stored.passwordHash));
  assert.ok(!JSON.stringify(res.body).includes(input.password));
  assert.ok(!Object.hasOwn(res.body.data, "accessToken"));
});

test("invalid registration input never reaches database creation", async (t) => {
  const create = t.mock.method(User, "create", async () => { throw new Error("Must not run"); });
  const invalidInputs = [
    {},
    { ...validInput, name: " " },
    { ...validInput, name: "a".repeat(81) },
    { ...validInput, email: "invalid" },
    { ...validInput, password: "short" },
    { ...validInput, password: "a".repeat(73) },
    { ...validInput, password: "😀".repeat(19) },
    { ...validInput, password: 123456789012 },
    { ...validInput, userId: "spoofed-owner" },
    { ...validInput, passwordHash: "client-supplied" },
  ];
  for (const input of invalidInputs) {
    const res = await request(app).post("/api/auth/register").send(input);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(Array.isArray(res.body.errors));
    if (typeof input.password === "string") {
      assert.ok(!JSON.stringify(res.body).includes(input.password));
    }
  }
  assert.equal(create.mock.callCount(), 0);
});

test("duplicate email database errors become safe 409 responses", async (t) => {
  t.mock.method(User, "init", async () => User);
  t.mock.method(User, "create", async () => {
    throw Object.assign(new Error("private database document details"), {
      code: 11000, keyPattern: { email: 1 },
    });
  });
  const res = await request(app).post("/api/auth/register").send(validInput);
  assert.equal(res.status, 409);
  assert.equal(res.body.message, "Email is already registered");
  assert.equal(res.body.errors, null);
});

test("unexpected database errors do not expose internal details", async (t) => {
  t.mock.method(User, "init", async () => { throw new Error("private connection details"); });
  const res = await request(app).post("/api/auth/register").send(validInput);
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { success: false, message: "Internal Server Error", errors: null });
});

test("user serialization excludes the hash and schema declares a unique email index", async () => {
  const user = new User({ name: "Jay", email: " JAY@example.com ", passwordHash: "test-only-placeholder" });
  await user.validate();
  assert.equal(user.email, "jay@example.com");
  assert.ok(!Object.hasOwn(user.toJSON(), "passwordHash"));
  assert.ok(!Object.hasOwn(user.toObject(), "passwordHash"));
  assert.equal(User.schema.path("passwordHash").options.select, false);
  assert.ok(User.schema.indexes().some(([keys, options]) => keys.email === 1 && options.unique));
});

test("malformed JSON does not echo credential fragments in parser errors", async () => {
  const res = await request(app).post("/api/auth/register")
    .set("Content-Type", "application/json")
    .send('{"password":"example-only-private-input",');
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { success: false, message: "Invalid JSON body", errors: null });
});

test("request logging excludes credentials supplied in query strings", async (t) => {
  const log = t.mock.method(console, "log", () => {});
  const res = await request(app).post("/api/auth/register")
    .query({ password: "example-only-private-query", token: "example-only-token" })
    .send({});
  assert.equal(res.status, 400);
  assert.deepEqual(log.mock.calls.map((call) => call.arguments), [["POST /api/auth/register"]]);
});

test("registration is rate limited after 20 attempts from the same IP", async () => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await request(app).post("/api/auth/register").send({});
    assert.equal(res.status, 400);
  }
  const res = await request(app).post("/api/auth/register").send({});
  assert.equal(res.status, 429);
  assert.equal(res.body.success, false);
  assert.ok(res.headers["retry-after"]);
});

test("health remains available and the request-body debug endpoint is removed", async () => {
  assert.equal((await request(app).get("/api/health")).status, 200);
  assert.equal((await request(app).post("/api/test").send({})).status, 404);
});
