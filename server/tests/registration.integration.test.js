import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import bcrypt from "bcrypt";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/user.model.js";
import Problem from "../src/models/problem.model.js";
import { authenticate } from "../src/middleware/auth.middleware.js";
import { errorMiddleware } from "../src/middleware/error.middleware.js";

// This test never reads MONGO_URI or .env. It starts its own local database.
test("registration persists safely and enforces unique email in isolated MongoDB", {
  skip: !process.env.MONGOD_BINARY && "Set MONGOD_BINARY to enable isolated persistence verification",
  timeout: 60000,
}, async (t) => {
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  process.env.JWT_ISSUER = "recall-test-api";
  process.env.JWT_AUDIENCE = "recall-test-client";
  const temporaryRoot = path.resolve(os.tmpdir());
  const dataDirectory = await mkdtemp(path.join(temporaryRoot, "recall-registration-"));
  let mongod;
  t.after(async () => {
    await mongoose.disconnect();
    if (mongod && mongod.exitCode === null && mongod.signalCode === null) {
      const stopped = once(mongod, "exit");
      mongod.kill();
      await stopped;
    }
    // Only remove the exact temporary directory allocated by this test.
    const resolved = path.resolve(dataDirectory);
    if (path.dirname(resolved) !== temporaryRoot || !path.basename(resolved).startsWith("recall-registration-")) {
      throw new Error("Refusing cleanup outside the test temporary directory");
    }
    await rm(resolved, { recursive: true, force: true });
  });

  const probe = net.createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close((err) => err ? reject(err) : resolve()));
  mongod = spawn(process.env.MONGOD_BINARY, [
    "--dbpath", dataDirectory, "--port", String(port), "--bind_ip", "127.0.0.1",
    "--setParameter", "diagnosticDataCollectionEnabled=false", "--quiet",
  ], { windowsHide: true, stdio: "ignore" });
  let startupError;
  mongod.on("error", (err) => { startupError = err; });
  const uri = `mongodb://127.0.0.1:${port}/recall_registration_test`;
  let connected = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (startupError || mongod.exitCode !== null) {
      throw new Error("Isolated MongoDB process could not start");
    }
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 500 });
      connected = true;
      break;
    } catch {
      await delay(100);
    }
  }
  assert.ok(connected, "Isolated MongoDB must start before testing");
  await User.init();
  const problems = mongoose.connection.db.collection("problems");
  const legacyId = new mongoose.Types.ObjectId();
  await problems.insertOne({ _id: legacyId, problemInfo: { problemName: "Legacy ownerless fixture" } });
  const legacyBefore = await problems.findOne({ _id: legacyId });
  const input = { name: "Jay", email: " JAY@example.com ", password: "example-only-long-password" };
  const res = await request(app).post("/api/auth/register").send(input);
  assert.equal(res.status, 201);
  const accountId = res.body.data.user.id;

  // Reconnect so read-back does not depend on the original document instance.
  await mongoose.disconnect();
  await mongoose.connect(uri);
  const normalRead = await User.findById(accountId);
  assert.ok(normalRead);
  assert.equal(normalRead.email, "jay@example.com");
  assert.ok(normalRead.passwordHash === undefined);
  const stored = await User.findById(accountId).select("+passwordHash");
  assert.ok(await bcrypt.compare(input.password, stored.passwordHash));
  assert.ok(!JSON.stringify(res.body).includes(stored.passwordHash));
  assert.ok(!Object.hasOwn(stored.toObject(), "password"));
  assert.ok(stored.createdAt instanceof Date && stored.updatedAt instanceof Date);

  const login = await request(app).post("/api/auth/login").send({ email: input.email, password: input.password });
  assert.equal(login.status, 200);
  assert.deepEqual(login.body.data.user, { id: accountId, name: "Jay", email: "jay@example.com" });
  const claims = jwt.verify(login.body.data.accessToken, Buffer.from(process.env.JWT_SECRET, "hex"), {
    algorithms: ["HS256"], issuer: process.env.JWT_ISSUER, audience: process.env.JWT_AUDIENCE,
  });
  assert.equal(claims.sub, accountId);
  assert.equal(claims.exp - claims.iat, 900);
  const wrongPassword = await request(app).post("/api/auth/login").send({ email: input.email, password: "incorrect-password" });
  const unknownEmail = await request(app).post("/api/auth/login").send({ email: "missing@example.com", password: input.password });
  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.deepEqual(wrongPassword.body, unknownEmail.body);

  const duplicate = await request(app).post("/api/auth/register").send({ ...input, email: "jay@example.com" });
  assert.equal(duplicate.status, 409);
  const results = await Promise.all([1, 2].map(() => request(app).post("/api/auth/register").send({
    ...input, email: "concurrent@example.com",
  })));
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal(await User.countDocuments({ email: "concurrent@example.com" }), 1);
  assert.equal(await User.countDocuments(), 2);
  assert.deepEqual(await mongoose.connection.db.collection("problems").findOne({ _id: legacyId }), legacyBefore);
  assert.equal(await mongoose.connection.db.collection("problems").countDocuments(), 1);

  const denied = { success: false, message: "Authentication required", errors: null };
  // The earlier persistence check reconnects, so use the current MongoDB client.
  const currentProblems = mongoose.connection.db.collection("problems");
  // Invalid IDs, filters, and bodies also prove authentication precedes validators/controllers.
  const problemRequests = [
    ["post", "/api/problems"],
    ["get", "/api/problems?limit=invalid"],
    ["get", "/api/problems/invalid-id"],
    ["patch", "/api/problems/invalid-id"],
    ["delete", "/api/problems/invalid-id"],
  ];

  for (const [label, token] of [["missing", null], ["invalid", "not-a-jwt"]]) {
    await t.test(`${label} token returns 401 for every Problem route before database access`, async (routeTest) => {
      const operations = ["create", "aggregate", "countDocuments", "findOne", "findOneAndUpdate", "findOneAndDelete"];
      const queries = operations.map((operation) => routeTest.mock.method(Problem, operation, () => {
        throw new Error("Unauthenticated requests must not access Problem data");
      }));
      for (const [method, url] of problemRequests) {
        let pending = request(app)[method](url);
        if (token) pending = pending.set("Authorization", `Bearer ${token}`);
        if (method === "post" || method === "patch") pending = pending.send({});
        const response = await pending;
        assert.equal(response.status, 401, `${method.toUpperCase()} ${url}`);
        assert.deepEqual(response.body, denied);
      }
      for (const query of queries) assert.equal(query.mock.callCount(), 0);
      assert.deepEqual(await currentProblems.findOne({ _id: legacyId }), legacyBefore);
      assert.equal(await currentProblems.countDocuments(), 1);
    });
  }

  await t.test("valid login token reaches every existing Problem controller", async () => {
    const authorization = `Bearer ${login.body.data.accessToken}`;
    const created = await request(app).post("/api/problems").set("Authorization", authorization).send({
      problemInfo: {
        problemName: "Authenticated Two Sum", problemUrl: "https://leetcode.com/problems/two-sum/",
        platform: "leetcode", difficulty: "easy",
      },
      userLearningInfo: { firstSolvedAt: "2026-11-18T00:00:00Z", lastSolvedAt: "2026-11-18T00:00:00Z" },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.message, "problem created");
    assert.equal(created.body.data.userId, accountId);
    const problemId = created.body.data._id;
    assert.ok(await Problem.findById(problemId));

    const listed = await request(app).get("/api/problems").set("Authorization", authorization);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.message, "problems fetched");
    assert.ok(listed.body.data.problems.some((problem) => problem._id === problemId));

    const fetched = await request(app).get(`/api/problems/${problemId}`).set("Authorization", authorization);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.data._id, problemId);

    const updated = await request(app).patch(`/api/problems/${problemId}`).set("Authorization", authorization)
      .send({ userLearningInfo: { confidence: 4 } });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.userLearningInfo.confidence, 4);
    assert.equal((await Problem.findById(problemId)).userLearningInfo.confidence, 4);

    const deleted = await request(app).delete(`/api/problems/${problemId}`).set("Authorization", authorization);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.data._id, problemId);
    assert.equal(await Problem.findById(problemId), null);
    assert.deepEqual(await currentProblems.findOne({ _id: legacyId }), legacyBefore);
  });

  await t.test("health, registration, and login remain public without tokens", async () => {
    assert.equal((await request(app).get("/api/health")).status, 200);
    const registered = await request(app).post("/api/auth/register")
      .send({ ...input, email: "public-auth@example.com" });
    assert.equal(registered.status, 201);
    const publicLogin = await request(app).post("/api/auth/login")
      .send({ email: "public-auth@example.com", password: input.password });
    assert.equal(publicLogin.status, 200);
    assert.equal(typeof publicLogin.body.data.accessToken, "string");
  });

  const authProbe = express();
  authProbe.get("/probe", authenticate, (req, res) => res.json({ user: req.user }));
  authProbe.use(errorMiddleware);
  const authenticated = await request(authProbe).get("/probe")
    .set("Authorization", `Bearer ${login.body.data.accessToken}`);
  assert.equal(authenticated.status, 200);
  assert.deepEqual(authenticated.body, { user: login.body.data.user });
  await User.deleteOne({ _id: accountId });
  const deleted = await request(authProbe).get("/probe")
    .set("Authorization", `Bearer ${login.body.data.accessToken}`);
  assert.equal(deleted.status, 401);
  assert.deepEqual(deleted.body, { success: false, message: "Authentication required", errors: null });
});
