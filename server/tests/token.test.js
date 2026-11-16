import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { beforeEach, test } from "node:test";
import jwt from "jsonwebtoken";
import { generateAccessToken } from "../src/services/token.service.js";

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

test("access token signature, minimal claims, and exact expiry are valid", () => {
  const subject = "507f1f77bcf86cd799439011";
  const before = Math.floor(Date.now() / 1000);
  const token = generateAccessToken(subject);
  const after = Math.floor(Date.now() / 1000);
  const key = Buffer.from(process.env.JWT_SECRET, "hex");
  const options = { algorithms: ["HS256"], issuer: process.env.JWT_ISSUER, audience: process.env.JWT_AUDIENCE };
  const { header, payload } = jwt.verify(token, key, { ...options, complete: true });
  assert.equal(header.alg, "HS256");
  assert.deepEqual(Object.keys(payload).sort(), ["aud", "exp", "iat", "iss", "sub"]);
  assert.equal(payload.sub, subject);
  assert.equal(payload.iss, process.env.JWT_ISSUER);
  assert.equal(payload.aud, process.env.JWT_AUDIENCE);
  assert.ok(payload.iat >= before && payload.iat <= after);
  assert.equal(payload.exp - payload.iat, 900);
  assert.doesNotThrow(() => jwt.verify(token, key, { ...options, clockTimestamp: payload.exp - 1 }));
  assert.throws(() => jwt.verify(token, key, { ...options, clockTimestamp: payload.exp }), { name: "TokenExpiredError" });
  assert.throws(() => jwt.verify(token, randomBytes(32), options), { name: "JsonWebTokenError" });
  assert.throws(() => jwt.verify(token, key, { ...options, issuer: "other-api" }), { name: "JsonWebTokenError" });
  assert.throws(() => jwt.verify(token, key, { ...options, audience: "other-client" }), { name: "JsonWebTokenError" });
});

test("missing and invalid JWT configuration is rejected before signing", (t) => {
  const sign = t.mock.method(jwt, "sign", () => { throw new Error("Must not sign"); });
  const valid = { JWT_SECRET: process.env.JWT_SECRET, JWT_ISSUER: process.env.JWT_ISSUER, JWT_AUDIENCE: process.env.JWT_AUDIENCE };
  const invalid = [
    ["JWT_SECRET", undefined], ["JWT_SECRET", ""],
    ["JWT_SECRET", randomBytes(31).toString("hex")],
    ["JWT_SECRET", "not-a-valid-hex-secret".repeat(4)],
    ["JWT_SECRET", `${randomBytes(32).toString("hex")}a`],
    ["JWT_SECRET", `${randomBytes(32).toString("hex")}\n\n`],
    ["JWT_SECRET", "00".repeat(32)],
    ["JWT_ISSUER", undefined], ["JWT_ISSUER", ""], ["JWT_ISSUER", "  "],
    ["JWT_AUDIENCE", undefined], ["JWT_AUDIENCE", ""], ["JWT_AUDIENCE", " "],
  ];
  for (const [key, value] of invalid) {
    Object.assign(process.env, valid);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
    assert.throws(() => generateAccessToken("507f1f77bcf86cd799439011"), { message: "Invalid JWT configuration" });
  }
  assert.equal(sign.mock.callCount(), 0);
});
