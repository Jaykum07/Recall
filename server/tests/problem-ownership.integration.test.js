import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import mongoose from "mongoose";
import User from "../src/models/user.model.js";

// Never read .env or MONGO_URI; all writes go to a disposable local database.
test("Problem ownership schema in isolated MongoDB", {
  skip: !process.env.MONGOD_BINARY && "Set MONGOD_BINARY to enable isolated ownership verification",
  timeout: 60000,
}, async (t) => {
  const temporaryRoot = path.resolve(os.tmpdir());
  const dataDirectory = await mkdtemp(path.join(temporaryRoot, "recall-ownership-"));
  let mongod;
  t.after(async () => {
    await mongoose.disconnect();
    if (mongod && mongod.exitCode === null && mongod.signalCode === null) {
      const stopped = once(mongod, "exit");
      mongod.kill();
      await stopped;
    }
    const resolved = path.resolve(dataDirectory);
    if (path.dirname(resolved) !== temporaryRoot || !path.basename(resolved).startsWith("recall-ownership-")) {
      throw new Error("Refusing cleanup outside the test temporary directory");
    }
    await rm(resolved, { recursive: true, force: true });
  });

  const portProbe = net.createServer();
  portProbe.listen(0, "127.0.0.1");
  await once(portProbe, "listening");
  const port = portProbe.address().port;
  await new Promise((resolve, reject) => portProbe.close((error) => error ? reject(error) : resolve()));
  mongod = spawn(process.env.MONGOD_BINARY, [
    "--dbpath", dataDirectory, "--port", String(port), "--bind_ip", "127.0.0.1",
    "--setParameter", "diagnosticDataCollectionEnabled=false", "--quiet",
  ], { windowsHide: true, stdio: "ignore" });
  let startupError;
  mongod.on("error", (error) => { startupError = error; });
  let connected = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (startupError || mongod.exitCode !== null) throw new Error("Isolated MongoDB process could not start");
    try {
      await mongoose.connect(`mongodb://127.0.0.1:${port}/recall_ownership_test`, { serverSelectionTimeoutMS: 500 });
      connected = true;
      break;
    } catch {
      await delay(100);
    }
  }
  assert.ok(connected, "Isolated MongoDB must start before testing");

  const problemData = {
    problemInfo: {
      problemName: "Two Sum", problemUrl: "https://leetcode.com/problems/two-sum/",
      platform: "leetcode", difficulty: "easy",
    },
    userLearningInfo: {
      confidence: 3, firstSolvedAt: new Date("2026-11-17T00:00:00Z"),
      lastSolvedAt: new Date("2026-11-17T00:00:00Z"),
    },
  };
  const collection = mongoose.connection.db.collection("problems");
  const legacyId = new mongoose.Types.ObjectId();
  // Seed a pre-existing record before loading the updated Problem model.
  await collection.insertOne({ _id: legacyId, ...problemData, legacyMarker: "preserve" });
  const legacyBefore = await collection.findOne({ _id: legacyId });
  const { default: Problem } = await import("../src/models/problem.model.js");
  await Problem.init();
  await User.init();
  const user = await User.create({ name: "Schema Tester", email: "schema@example.com", passwordHash: "test-only-placeholder" });

  await t.test("a valid user reference persists and supports multiple problems per user", async () => {
    const problem = await Problem.create({ ...problemData, userId: user._id.toString() });
    const stored = await collection.findOne({ _id: problem._id });
    assert.ok(stored.userId instanceof mongoose.Types.ObjectId);
    assert.equal(stored.userId.toString(), user._id.toString());
    const populated = await Problem.findById(problem._id).populate("userId");
    assert.equal(populated.userId.email, user.email);
    assert.equal(populated.userId.passwordHash, undefined);
    await Problem.create({ ...problemData, userId: user._id });
    assert.equal(await Problem.countDocuments({ userId: user._id }), 2);
    const index = (await collection.indexes()).find((entry) => entry.key.userId === 1);
    assert.ok(index, "MongoDB must have an ascending userId index");
    assert.deepEqual(index.key, { userId: 1 });
    assert.ok(!index.unique, "One user can own many problems");
  });

  await t.test("missing, null, and malformed userId fail validation without inserting documents", async () => {
    const before = await collection.countDocuments();
    for (const userId of [undefined, null, "not-an-object-id"]) {
      await assert.rejects(Problem.create({ ...problemData, userId }), (error) => {
        assert.equal(error.name, "ValidationError");
        assert.equal(error.errors.userId.kind, userId === "not-an-object-id" ? "ObjectId" : "required");
        return true;
      });
    }
    assert.equal(await collection.countDocuments(), before);
  });

  await t.test("existing ownerless records stay readable and unchanged without automatic assignment", async () => {
    const legacy = await Problem.findById(legacyId);
    assert.ok(legacy);
    assert.equal(legacy.userId, undefined);
    await assert.rejects(legacy.save(), (error) => {
      assert.equal(error.errors.userId.kind, "required");
      return true;
    });
    assert.deepEqual(await collection.findOne({ _id: legacyId }), legacyBefore);
    assert.equal(await collection.countDocuments({ userId: { $exists: false } }), 1);
  });
});
