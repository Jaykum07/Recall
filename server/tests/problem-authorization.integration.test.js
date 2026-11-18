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
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/app.js";
import Problem from "../src/models/problem.model.js";

// Never load .env or use MONGO_URI: every write goes to this disposable database.
test("Problem APIs enforce ownership for two authenticated users in isolated MongoDB", {
  skip: !process.env.MONGOD_BINARY && "Set MONGOD_BINARY to enable isolated authorization verification",
  timeout: 60000,
}, async (t) => {
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  process.env.JWT_ISSUER = "recall-authorization-test";
  process.env.JWT_AUDIENCE = "recall-test-client";
  const temporaryRoot = path.resolve(os.tmpdir());
  const dataDirectory = await mkdtemp(path.join(temporaryRoot, "recall-authorization-"));
  let mongod;
  t.after(async () => {
    await mongoose.disconnect();
    if (mongod && mongod.exitCode === null && mongod.signalCode === null) {
      const stopped = once(mongod, "exit");
      mongod.kill();
      await stopped;
    }
    const resolved = path.resolve(dataDirectory);
    if (path.dirname(resolved) !== temporaryRoot || !path.basename(resolved).startsWith("recall-authorization-")) {
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
      await mongoose.connect(`mongodb://127.0.0.1:${port}/recall_authorization_test`, { serverSelectionTimeoutMS: 500 });
      connected = true;
      break;
    } catch {
      await delay(100);
    }
  }
  assert.ok(connected, "Isolated MongoDB must start before testing");
  await Problem.init();

  const users = [];
  for (const name of ["User A", "User B"]) {
    const credentials = { email: `${name.replaceAll(" ", "").toLowerCase()}@example.com`, password: "example-only-ownership-password" };
    const registered = await request(app).post("/api/auth/register").send({ name, ...credentials });
    assert.equal(registered.status, 201);
    const login = await request(app).post("/api/auth/login").send(credentials);
    assert.equal(login.status, 200);
    users.push({ id: login.body.data.user.id, token: login.body.data.accessToken });
  }
  const [a, b] = users;
  const send = (user, method, url) => request(app)[method](url).set("Authorization", `Bearer ${user.token}`);
  const content = (name, overrides = {}) => ({
    problemInfo: {
      problemName: name, problemUrl: "https://example.com/problem",
      platform: "leetcode", difficulty: "easy", tags: ["shared"], ...overrides,
    },
    userLearningInfo: { firstSolvedAt: "2026-11-18T00:00:00Z", lastSolvedAt: "2026-11-18T00:00:00Z" },
  });
  const create = async (user, body) => {
    const response = await send(user, "post", "/api/problems").send(body);
    assert.equal(response.status, 201);
    assert.equal(response.body.data.userId, user.id);
    return response.body.data;
  };
  const collection = mongoose.connection.db.collection("problems");
  const legacyId = new mongoose.Types.ObjectId();
  await collection.insertOne({ _id: legacyId, ...content("Shared Legacy"), legacyMarker: "unchanged" });
  const legacyBefore = await collection.findOne({ _id: legacyId });
  let primary;
  let spoofed;

  await t.test("User A creates a problem without sending an owner", async () => {
    primary = await create(a, content("Shared Alpha"));
    const stored = await collection.findOne({ _id: new mongoose.Types.ObjectId(primary._id) });
    assert.equal(stored.userId.toString(), a.id);
  });

  await t.test("User B cannot spoof ownership or reuse another problem ID on create", async () => {
    spoofed = await create(b, {
      ...content("Shared B"), userId: a.id, ownerId: a.id, user: { id: a.id },
      _id: primary._id, $set: { userId: a.id },
    });
    assert.notEqual(spoofed._id, primary._id);
    assert.equal((await Problem.findById(primary._id)).userId.toString(), a.id);
    assert.ok(!Object.hasOwn(spoofed, "ownerId"));
    assert.ok(!Object.hasOwn(spoofed, "user"));
    for (const userId of [null, { $ne: null }, "not-an-id"]) {
      const extra = await create(b, { ...content("Ignored owner"), userId });
      assert.equal((await send(b, "delete", `/api/problems/${extra._id}`)).status, 200);
    }
  });

  await t.test("User B cannot list, retrieve, update, or delete User A's problem", async () => {
    const before = await collection.findOne({ _id: new mongoose.Types.ObjectId(primary._id) });
    const listed = await send(b, "get", "/api/problems");
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body.data.problems.map((problem) => problem._id), [spoofed._id]);
    assert.equal(listed.body.data.pagination.totalProblems, 1);
    const missingId = new mongoose.Types.ObjectId().toString();
    for (const method of ["get", "patch", "delete"]) {
      let foreign = send(b, method, `/api/problems/${primary._id}`);
      let missing = send(b, method, `/api/problems/${missingId}`);
      if (method === "patch") {
        foreign = foreign.send({ userLearningInfo: { confidence: 5 } });
        missing = missing.send({ userLearningInfo: { confidence: 5 } });
      }
      const response = await foreign;
      const absent = await missing;
      assert.equal(response.status, 404);
      assert.equal(absent.status, 404);
      assert.deepEqual(response.body, absent.body);
    }
    assert.deepEqual(await collection.findOne({ _id: new mongoose.Types.ObjectId(primary._id) }), before);
  });

  await t.test("User A retrieves and updates its problem without changing ownership", async () => {
    const fetched = await send(a, "get", `/api/problems/${primary._id}`);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.data._id, primary._id);
    const updated = await send(a, "patch", `/api/problems/${primary._id}`).send({
      userLearningInfo: { confidence: 4 },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.userId, a.id);
    assert.equal(updated.body.data.userLearningInfo.confidence, 4);
    assert.equal((await Problem.findById(primary._id)).userId.toString(), a.id);
    const ownershipOnly = await send(a, "patch", `/api/problems/${primary._id}`).send({ userId: b.id });
    assert.equal(ownershipOnly.status, 400);
  });

  await t.test("each supported PATCH field persists independently and omitted fields remain unchanged", async () => {
    for (const [field, value] of [
      ["confidence", 0],
      ["whatILearned", "  Preserve this learning text exactly.  "],
      ["whatIStruggledWith", "Recognizing the invariant"],
      ["mistake", "Forgot the empty input case"],
    ]) {
      const before = await collection.findOne({ _id: new mongoose.Types.ObjectId(primary._id) });
      const response = await send(a, "patch", `/api/problems/${primary._id}`)
        .send({ userLearningInfo: { [field]: value } });
      assert.equal(response.status, 200, field);
      assert.equal(response.body.data.userLearningInfo[field], value);
      const after = await collection.findOne({ _id: before._id });
      // Apart from the automatic update timestamp, only the supplied field changes.
      assert.deepEqual({ ...after, updatedAt: before.updatedAt }, {
        ...before, userLearningInfo: { ...before.userLearningInfo, [field]: value },
      });
      const fetched = await send(a, "get", `/api/problems/${primary._id}`);
      assert.equal(fetched.status, 200);
      assert.equal(fetched.body.data.userLearningInfo[field], value);
    }
  });

  await t.test("combined PATCH accepts 1000-character text, confidence boundaries, and empty strings", async () => {
    for (const updates of [
      { confidence: 5, whatILearned: "a".repeat(1000), whatIStruggledWith: "b".repeat(1000), mistake: "c".repeat(1000) },
      { confidence: 0, whatILearned: "", whatIStruggledWith: "", mistake: "" },
    ]) {
      const before = await collection.findOne({ _id: new mongoose.Types.ObjectId(primary._id) });
      const response = await send(a, "patch", `/api/problems/${primary._id}`).send({ userLearningInfo: updates });
      assert.equal(response.status, 200);
      for (const [field, value] of Object.entries(updates)) {
        assert.equal(response.body.data.userLearningInfo[field], value);
      }
      const after = await collection.findOne({ _id: before._id });
      assert.deepEqual({ ...after, updatedAt: before.updatedAt }, {
        ...before, userLearningInfo: { ...before.userLearningInfo, ...updates },
      });
    }
    // Keep the original confidence used by the subsequent sorting regression checks.
    assert.equal((await send(a, "patch", `/api/problems/${primary._id}`)
      .send({ userLearningInfo: { confidence: 4 } })).status, 200);
  });

  await t.test("invalid PATCH bodies are rejected before the update query and cause no database writes", async (patchTest) => {
    const update = patchTest.mock.method(Problem, "findOneAndUpdate", () => {
      throw new Error("Invalid requests must not reach the update operation");
    });
    const before = await collection.find({}).sort({ _id: 1 }).toArray();
    const invalidBodies = [
      {}, [], { userLearningInfo: {} }, { userLearningInfo: null },
      { userLearningInfo: [] }, { userLearningInfo: "invalid" },
      { userId: b.id },
      ...["userId", "ownerId", "user", "_id", "problemInfo", "notes", "$set", "userLearningInfo.confidence"]
        .map((field) => ({ userLearningInfo: { confidence: 2 }, [field]: field === "$set" ? { userId: b.id } : b.id })),
      ...["notes", "firstSolvedAt", "lastSolvedAt", "userId", "$set"]
        .map((field) => ({ userLearningInfo: { confidence: 2, [field]: "unsupported" } })),
      ...[-1, 6, "4", null, true, [], {}].map((confidence) => ({ userLearningInfo: { confidence } })),
      ...["whatILearned", "whatIStruggledWith", "mistake"].flatMap((field) =>
        [null, 123, false, [], {}, "x".repeat(1001)].map((value) => ({
          userLearningInfo: { confidence: 2, [field]: value },
        }))),
    ];
    for (const body of invalidBodies) {
      const response = await send(a, "patch", `/api/problems/${primary._id}`).send(body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal(response.body.message, "Validation failed");
      assert.ok(Array.isArray(response.body.errors));
      assert.equal(update.mock.callCount(), 0);
      assert.deepEqual(await collection.find({}).sort({ _id: 1 }).toArray(), before);
    }
  });

  await t.test("another user cannot PATCH any learning field and denied updates change no records", async () => {
    const before = await collection.find({}).sort({ _id: 1 }).toArray();
    const missingId = new mongoose.Types.ObjectId().toString();
    for (const updates of [
      { confidence: 0 }, { whatILearned: "spoofed learning" },
      { whatIStruggledWith: "spoofed struggle" }, { mistake: "spoofed mistake" },
      { confidence: 5, whatILearned: "", whatIStruggledWith: "", mistake: "" },
    ]) {
      const response = await send(b, "patch", `/api/problems/${primary._id}`).send({ userLearningInfo: updates });
      const missing = await send(b, "patch", `/api/problems/${missingId}`).send({ userLearningInfo: updates });
      assert.equal(response.status, 404);
      assert.equal(missing.status, 404);
      assert.deepEqual(response.body, missing.body);
      assert.deepEqual(await collection.find({}).sort({ _id: 1 }).toArray(), before);
    }
    const spoofedOwner = await send(b, "patch", `/api/problems/${primary._id}`)
      .send({ userId: a.id, userLearningInfo: { whatILearned: "spoofed owner" } });
    assert.equal(spoofedOwner.status, 400);
    assert.deepEqual(await collection.find({}).sort({ _id: 1 }).toArray(), before);
  });

  await t.test("search, filters, every sort, pagination, and counts stay user-scoped", async () => {
    const beta = await create(a, {
      ...content("Shared Beta", { platform: "gfg", difficulty: "medium", tags: ["graphs"] }),
      userLearningInfo: { firstSolvedAt: "2026-11-17T00:00:00Z", lastSolvedAt: "2026-11-17T00:00:00Z" },
    });
    const gamma = await create(a, {
      ...content("Shared Gamma", { difficulty: "hard", tags: ["graphs"] }),
      userLearningInfo: { firstSolvedAt: "2026-11-19T00:00:00Z", lastSolvedAt: "2026-11-19T00:00:00Z" },
    });
    for (const [problem, confidence] of [[beta, 1], [gamma, 5]]) {
      assert.equal((await send(a, "patch", `/api/problems/${problem._id}`)
        .send({ userLearningInfo: { confidence } })).status, 200);
    }
    const secret = await create(b, content("OnlyBSecret", { platform: "gfg", difficulty: "medium", tags: ["graphs"] }));
    const checkList = async (user, query, expected, total, ordered = false) => {
      const response = await send(user, "get", "/api/problems").query(query);
      assert.equal(response.status, 200);
      const { problems, pagination } = response.body.data;
      const ids = problems.map((problem) => problem._id);
      assert.deepEqual(ordered ? ids : ids.sort(), ordered ? expected : [...expected].sort());
      assert.ok(problems.every((problem) => problem.userId === user.id));
      const page = query.page ?? 1;
      const limit = query.limit ?? 10;
      const pages = Math.ceil(total / limit);
      assert.deepEqual(pagination, { page, limit, totalProblems: total, totalPages: pages, hasNextPage: page < pages, hasPreviousPage: page > 1 });
    };
    await checkList(a, {}, [primary._id, beta._id, gamma._id], 3);
    await checkList(b, {}, [spoofed._id, secret._id], 2);
    await checkList(a, { search: "OnlyBSecret" }, [], 0);
    await checkList(a, { search: "shared", tags: "graphs", platform: "gfg", difficulty: "medium", limit: 1 }, [beta._id], 1);
    await checkList(b, { search: "shared" }, [spoofed._id], 1);
    await checkList(b, { difficulty: "hard", limit: 1 }, [], 0);
    for (const sortBy of ["difficulty", "confidence", "firstSolvedAt", "lastSolvedAt"]) {
      const ascending = sortBy === "difficulty" ? [primary._id, beta._id, gamma._id] : [beta._id, primary._id, gamma._id];
      const descending = [...ascending].reverse();
      await checkList(a, { sortBy, order: "asc", limit: 2 }, ascending.slice(0, 2), 3, true);
      await checkList(a, { sortBy, order: "desc", page: 1, limit: 2 }, descending.slice(0, 2), 3, true);
      await checkList(a, { sortBy, order: "desc", page: 2, limit: 2 }, descending.slice(2), 3, true);
      await checkList(a, { sortBy, page: 3, limit: 2 }, [], 3, true);
    }
    assert.equal((await send(b, "get", "/api/problems").query({ userId: a.id })).status, 400);
  });

  await t.test("ownerless records are inaccessible to both users and remain unchanged", async () => {
    for (const user of users) {
      const listed = await send(user, "get", "/api/problems").query({ search: "Shared Legacy" });
      assert.equal(listed.status, 200);
      assert.deepEqual(listed.body.data.problems, []);
      assert.equal(listed.body.data.pagination.totalProblems, 0);
      assert.equal((await send(user, "get", `/api/problems/${legacyId}`)).status, 404);
      assert.equal((await send(user, "patch", `/api/problems/${legacyId}`)
        .send({ userLearningInfo: { confidence: 5, whatILearned: "cannot claim", whatIStruggledWith: "", mistake: "" } })).status, 404);
      assert.equal((await send(user, "delete", `/api/problems/${legacyId}`)).status, 404);
    }
    assert.deepEqual(await collection.findOne({ _id: legacyId }), legacyBefore);
  });

  await t.test("User A deletes its problem and User B retains its own problem", async () => {
    const deleted = await send(a, "delete", `/api/problems/${primary._id}`);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.data._id, primary._id);
    assert.equal(await Problem.findById(primary._id), null);
    assert.equal((await send(a, "get", `/api/problems/${primary._id}`)).status, 404);
    assert.equal((await send(b, "get", `/api/problems/${spoofed._id}`)).status, 200);
    assert.deepEqual(await collection.findOne({ _id: legacyId }), legacyBefore);
  });
});
