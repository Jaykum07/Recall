import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { beforeEach, test } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { authenticate } from "../src/middleware/auth.middleware.js";
import { errorMiddleware } from "../src/middleware/error.middleware.js";
import User from "../src/models/user.model.js";
import { generateAccessToken } from "../src/services/token.service.js";

const subject = "507f1f77bcf86cd799439011";
const safeUser = { id: subject, name: "Jay", email: "jay@example.com" };
const denied = { success: false, message: "Authentication required", errors: null };
const app = express();
// Only this test fixture has a protected route. Production routes stay public.
app.get("/probe", authenticate, (req, res) => res.json({ user: req.user }));
app.use(errorMiddleware);

beforeEach((t) => {
  const keys = ["JWT_SECRET", "JWT_ISSUER", "JWT_AUDIENCE"];
  const previous = keys.map((key) => process.env[key]);
  t.after(() => keys.forEach((key, index) => {
    if (previous[index] === undefined) delete process.env[key];
    else process.env[key] = previous[index];
  }));
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  process.env.JWT_ISSUER = "recall-test-api";
  process.env.JWT_AUDIENCE = "recall-test-client";
});

const sign = (claims = {}, options = {}) => jwt.sign(Object.fromEntries(Object.entries({
  sub: subject, iss: process.env.JWT_ISSUER, aud: process.env.JWT_AUDIENCE,
  exp: Math.floor(Date.now() / 1000) + 900, ...claims,
}).filter(([, value]) => value !== undefined)), Buffer.from(process.env.JWT_SECRET, "hex"), { algorithm: "HS256", ...options });

const mockLookup = (t, result) => t.mock.method(User, "findById", (id) => {
  assert.equal(id, subject);
  return { select: (selection) => {
    assert.equal(selection, "_id name email");
    return { lean: async () => result };
  } };
});

test("valid issued token attaches only the current database user's safe identity", async (t) => {
  const lookup = mockLookup(t, { _id: subject, name: "Jay", email: "jay@example.com", passwordHash: "private", __v: 1 });
  const res = await request(app).get("/probe").set("Authorization", `Bearer ${generateAccessToken(subject)}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { user: safeUser });
  assert.equal(lookup.mock.callCount(), 1);
});

test("Bearer scheme is case-insensitive and accepts multiple separating spaces", async (t) => {
  mockLookup(t, { _id: subject, ...safeUser });
  const res = await request(app).get("/probe").set("Authorization", `bEaReR   ${sign()}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { user: safeUser });
});

test("missing token returns generic 401 without querying MongoDB", async (t) => {
  const lookup = t.mock.method(User, "findById", () => { throw new Error("Must not query"); });
  const res = await request(app).get("/probe");
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, denied);
  assert.equal(lookup.mock.callCount(), 0);
});

test("malformed Authorization headers and malformed JWTs return generic 401", async (t) => {
  const lookup = t.mock.method(User, "findById", () => { throw new Error("Must not query"); });
  for (const value of ["", "Bearer", "Bearer token", "Basic abc", "Bearer a.b.c", `Bearer ${sign()} extra`, `Bearer ${sign()},${sign()}`, `Bearer\t${sign()}`]) {
    const res = await request(app).get("/probe").set("Authorization", value);
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, denied);
  }
  assert.equal(lookup.mock.callCount(), 0);
});

const invalidTokens = {
  "tampered token": () => {
    const parts = sign().split(".");
    parts[1] = Buffer.from(JSON.stringify({ sub: "507f1f77bcf86cd799439012", exp: Math.floor(Date.now() / 1000) + 900 })).toString("base64url");
    return parts.join(".");
  },
  "expired token": () => sign({ exp: Math.floor(Date.now() / 1000) - 1 }),
  "token at the expiration boundary": () => sign({ exp: Math.floor(Date.now() / 1000) }),
  "wrong issuer": () => sign({ iss: "other-api" }),
  "wrong audience": () => sign({ aud: "other-client" }),
  "missing issuer": () => sign({ iss: undefined }),
  "missing audience": () => sign({ aud: undefined }),
  "missing expiration": () => sign({ exp: undefined }),
  "missing subject": () => sign({ sub: undefined }),
  "non-string subject": () => sign({ sub: { $ne: null } }),
  "invalid ObjectId subject": () => sign({ sub: "not-an-object-id" }),
  "12-character subject": () => sign({ sub: "abcdefghijkl" }),
  "non-hex subject": () => sign({ sub: "z".repeat(24) }),
  "unsupported HS384 algorithm": () => sign({}, { algorithm: "HS384" }),
  "unsigned token": () => jwt.sign({ sub: subject }, null, { algorithm: "none" }),
  "token signed with another key": () => jwt.sign({ sub: subject }, randomBytes(32), { algorithm: "HS256" }),
  "not-yet-valid token": () => sign({ nbf: Math.floor(Date.now() / 1000) + 60 }),
};

for (const [name, token] of Object.entries(invalidTokens)) {
  test(`${name} returns generic 401 before querying MongoDB`, async (t) => {
    const lookup = t.mock.method(User, "findById", () => { throw new Error("Must not query"); });
    const res = await request(app).get("/probe").set("Authorization", `Bearer ${token()}`);
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, denied);
    assert.equal(lookup.mock.callCount(), 0);
  });
}

test("deleted user returns the same generic 401 despite a valid token", async (t) => {
  const lookup = mockLookup(t, null);
  const res = await request(app).get("/probe").set("Authorization", `Bearer ${sign()}`);
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, denied);
  assert.equal(lookup.mock.callCount(), 1);
});

test("database failure returns generic 500 without internal details", async (t) => {
  t.mock.method(User, "findById", () => ({ select: () => ({ lean: async () => { throw new Error("private database details"); } }) }));
  const res = await request(app).get("/probe").set("Authorization", `Bearer ${sign()}`);
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { success: false, message: "Internal Server Error", errors: null });
});

test("invalid verification configuration fails safely before querying MongoDB", async (t) => {
  const token = sign();
  delete process.env.JWT_SECRET;
  const lookup = t.mock.method(User, "findById", () => { throw new Error("Must not query"); });
  const res = await request(app).get("/probe").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { success: false, message: "Internal Server Error", errors: null });
  assert.equal(lookup.mock.callCount(), 0);
});
