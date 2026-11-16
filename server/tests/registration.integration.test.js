import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/user.model.js";

// This test never reads MONGO_URI or .env. It starts its own local database.
test("registration persists safely and enforces unique email in isolated MongoDB", {
  skip: !process.env.MONGOD_BINARY && "Set MONGOD_BINARY to enable isolated persistence verification",
  timeout: 60000,
}, async (t) => {
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
  assert.deepEqual(login.body.data, { user: { id: accountId, name: "Jay", email: "jay@example.com" } });
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
});
