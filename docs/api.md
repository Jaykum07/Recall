# Recall V1 API

Local base URL: `http://localhost:5000/api` when `PORT=5000`.

Registration, login, JWT generation, and JWT verification middleware are implemented and tested.
The Problem ownership schema and ownership enforcement are implemented.
All Problem routes require a Bearer access token. Health, registration, and login
remain public.
Problem database operations still need broader testing; the examples describe
what the current code accepts and returns.

## Register a user

**POST `/api/auth/register`**

Authentication: none. Send `Content-Type: application/json`.

Required body:

```json
{
  "name": "Jay",
  "email": "jay@example.com",
  "password": "example-only-long-password"
}
```

- Name: trimmed, 2 to 80 characters.
- Email: trimmed, lowercased, valid format, at most 254 characters.
- Password: at least 12 characters and at most 72 UTF-8 bytes. It is not trimmed.
- Extra fields are rejected. The password above is an example, not a credential.

Response: **201 Created**

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "<user-id>",
      "name": "Jay",
      "email": "jay@example.com"
    }
  }
}
```

No password, password hash, or access token is returned. Passwords are stored as
bcrypt hashes with work factor 12. Users have a unique email and timestamps.
The stored hash is excluded from normal queries and document serialization.

Possible errors:

| Status | Reason |
| --- | --- |
| 400 | Missing or invalid fields, extra fields, or malformed JSON |
| 409 | Email is already registered, including simultaneous requests |
| 429 | More than 20 registration attempts per IP in 15 minutes |
| 500 | Unexpected server error |

Example duplicate-email response:

```json
{
  "success": false,
  "message": "Email is already registered",
  "errors": null
}
```

Registration limits are stored in memory and reset when the server restarts.
They are not shared between server processes. A reverse-proxy deployment needs
careful trusted-proxy configuration before relying on client-IP limits.

## Log in

**POST `/api/auth/login`**

Authentication: none. Send `Content-Type: application/json`.

```json
{
  "email": "jay@example.com",
  "password": "example-only-long-password"
}
```

Email is trimmed, lowercased, validated, and limited to 254 characters. Password
uses the registration rules: at least 12 characters and at most 72 UTF-8 bytes;
it is never trimmed. Extra fields are rejected.

Response: **200 OK**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "<user-id>",
      "name": "Jay",
      "email": "jay@example.com"
    },
    "accessToken": "<signed-jwt>"
  }
}
```

The user object contains only ID, name, and email. The service explicitly selects the hidden
password hash for `bcrypt.compare()`; it never includes the hash in the response.
After password verification, the service issues an HS256 access token with a
15-minute expiry. The login response includes `data.accessToken` alongside
`data.user`. No cookie or server session is created. Token verification middleware
is available but this stage does not protect problem routes.

The payload contains only `sub` (the user's MongoDB ID), `iss`, `aud`, `iat`, and
`exp`. Name, email, passwords, hashes, and the signing secret are excluded. JWTs
are signed, not encrypted; treat the access token as a credential and do not log
or share it. The algorithm, issuer, audience, and expiry are set using the
[jsonwebtoken signing options](https://github.com/auth0/node-jsonwebtoken#jwtsignpayload-secretorprivatekey-options-callback).

JWT setup in `server/.env`:

```dotenv
JWT_SECRET=<hex-encoded-secret-generated-locally>
JWT_ISSUER=recall-api
JWT_AUDIENCE=recall-client
```

Generate `JWT_SECRET` from at least 32 cryptographically random bytes, encoded as
hex (at least 64 characters). See the [server README](../server/README.md) for the
local generation command. Missing, malformed, short, or single-byte repeated
secrets are rejected; issuer and audience must be nonempty, at most 256 characters,
and contain no whitespace. No fallback secret is used. Configuration is validated
after successful password verification; configuration or signing failures return
500 with `Internal Server Error` and `errors: null`, without a token.

Unknown emails and incorrect passwords both return **401 Unauthorized**:

```json
{
  "success": false,
  "message": "Invalid email or password",
  "errors": null
}
```

| Status | Reason |
| --- | --- |
| 400 | Missing or invalid fields, extra fields, or malformed JSON |
| 401 | Unknown email or incorrect password |
| 429 | More than 20 login attempts per IP in 15 minutes |
| 500 | Unexpected server error |

Login has a separate in-memory rate limit from registration, with the same
restart, multiple-process, and trusted-proxy limitations described above.
Unknown emails still trigger a bcrypt comparison to reduce timing differences.

## Check API health

**GET `/api/health`**

Authentication: none. Request body: none.

Response: **200 OK**

```json
{
  "success": true,
  "message": "Recall API is running."
}
```

This confirms the API responds; it does not check MongoDB readiness. There are
no endpoint-specific validation errors.

## Problem ownership schema

Checkpoint 3, Stage 1 adds `userId` to `server/src/models/problem.model.js`:

| Property | Schema behavior |
| --- | --- |
| Type | `mongoose.Schema.Types.ObjectId` |
| Reference | `User` (the existing registered model name) |
| Required | Yes, during normal document validation on create/save |
| Index | Non-unique ascending `{ userId: 1 }` for user-based queries |
| Default/backfill | None; existing ownerless records are not assigned an owner |

Existing ownerless records remain readable directly in MongoDB or through the
model, outside these authenticated APIs. Normal document saves fail required
validation until an owner is explicitly provided. Query updates validate only
affected paths; this schema change is not a database collection validator or a
complete authorization mechanism. `ref` permits population but does not require
the referenced account to exist. Multiple problems may reference the same user.

Checkpoint 3, Stage 3 enforces ownership after authentication. Controllers pass
`req.user.id` separately from request data. CREATE sets `userId` from that trusted
identity, ignoring ownership fields and `_id` in the body. UPDATE accepts only
the supported learning fields and rejects body-supplied ownership fields; it
cannot modify `userId`.

LIST begins with `{ userId: ObjectId(req.user.id) }` in its aggregation `$match`
and uses the same filter for counts. Search, filters, sorting, pagination, and
pagination totals therefore only operate on the caller's problems. Single-record
queries and atomic writes use `{ _id: problemId, userId: req.user.id }`.

Missing, other-user, and ownerless records return 404 for GET/UPDATE/DELETE with
the same error for each operation, without disclosing whether another user owns
the ID. Malformed IDs still return 400. Existing ownerless documents remain
unchanged in MongoDB and are excluded from all API queries and counts. There is
no automatic assignment, migration, or claim endpoint. Frontend integration is deferred.
The November 18, 2026 Checkpoint 3, Stage 3 run passed all 62 tests with isolated
MongoDB enabled and none skipped, including two-user authorization, spoofing,
ownerless preservation, and scoped search/filter/sort/pagination/count checks.

The November 17, 2026 Checkpoint 3, Stage 1 run passed all 50 tests with isolated
MongoDB enabled and none skipped. Ownership tests verify persistence with a real
user reference, the non-unique index, required/invalid ID validation, and unchanged
ownerless records.

## Add a problem

**POST `/api/problems`**

Authentication: Bearer access token required. Send `Content-Type: application/json`.

Minimum body:

```json
{
  "problemInfo": {
    "problemName": "Two Sum",
    "problemUrl": "https://leetcode.com/problems/two-sum/",
    "platform": "leetcode",
    "difficulty": "easy"
  },
  "userLearningInfo": {
    "firstSolvedAt": "2026-11-16T10:00:00.000Z",
    "lastSolvedAt": "2026-11-16T10:00:00.000Z"
  }
}
```

Optional fields: `problemInfo.description`, `problemInfo.tags`,
`userLearningInfo.whatILearned`, `userLearningInfo.whatIStruggledWith`, and
`userLearningInfo.mistake`. Notes and mistakes are limited to 1,000 characters.
Problem names must contain 3 to 100 characters.

Do not send `userId`. The service supplies the authenticated user's ID, satisfying
the schema's required ObjectId field. Body-supplied ownership fields (`userId`,
`ownerId`, `user`) and `_id` are safely ignored; they cannot create a problem for
another account or overwrite an existing document. The response includes the
server-assigned `userId` (illustrated below).

Platforms: `leetcode`, `gfg`, `codechef`, `codeforces`, `other`.
Difficulties: `easy`, `medium`, `hard`.

Known limitation: creation always sets confidence to `3`, even if another value
is supplied. Topic references are not implemented.

Response: **201 Created**

```json
{
  "success": true,
  "message": "problem created",
  "data": {
    "_id": "<problem-id>",
    "userId": "507f1f77bcf86cd799439011",
    "problemInfo": {
      "problemName": "Two Sum",
      "problemUrl": "https://leetcode.com/problems/two-sum/",
      "description": null,
      "platform": "leetcode",
      "difficulty": "easy",
      "tags": []
    },
    "userLearningInfo": {
      "confidence": 3,
      "firstSolvedAt": "2026-11-16T10:00:00.000Z",
      "lastSolvedAt": "2026-11-16T10:00:00.000Z"
    },
    "createdAt": "<timestamp>",
    "updatedAt": "<timestamp>",
    "__v": 0
  }
}
```

Possible errors: **400** for schema validation or malformed JSON; **500** for
unexpected failures. Creation uses Mongoose validation rather than a separate
request validator.

## List problems

**GET `/api/problems`**

Authentication: Bearer access token required. Request body: none.

All query parameters are optional:

Results and all pagination totals include only the authenticated user's problems.
Search, filters, and sorting cannot expand access to another user's or an ownerless
record. Client-supplied owner query parameters are rejected as unknown fields.

| Parameter | Accepted values |
| --- | --- |
| `difficulty` | `easy`, `medium`, `hard` |
| `platform` | One of the platforms listed above |
| `tags` | Comma-separated tags; matches any listed tag |
| `search` | Case-insensitive regular expression for the problem name |
| `page` | Integer of at least 1; default 1 |
| `limit` | Integer from 1 to 100; default 10 |
| `sortBy` | `difficulty`, `confidence`, `firstSolvedAt`, `lastSolvedAt` |
| `order` | `asc` or `desc`; requires `sortBy`; defaults to ascending when sorting |

Example:

```http
GET /api/problems?difficulty=easy&search=two&sortBy=confidence&order=desc&page=1&limit=5
```

Response: **200 OK**. Each entry in `problems` has the document shape shown in
the create response. This example shows an empty result:

```json
{
  "success": true,
  "message": "problems fetched",
  "data": {
    "problems": [],
    "pagination": {
      "page": 1,
      "limit": 5,
      "totalProblems": 0,
      "totalPages": 0,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```

Possible errors: **400** for invalid or unknown query parameters; **500** for
unexpected database/query failures.

Known limitations: tag whitespace is not trimmed, search accepts raw regex,
and page ordering has no unique tie-breaker. Invalid regex can fail at the
database. These behaviors still need fixes and database regression tests.

## Get one problem

**GET `/api/problems/:id`**

Authentication: Bearer access token required. Request body: none. Replace `:id` with
a MongoDB ObjectId.

Response: **200 OK** (problem fields abbreviated):

```json
{
  "success": true,
  "message": "problem with id fetched",
  "data": {
    "_id": "<problem-id>",
    "problemInfo": { "problemName": "Two Sum" }
  }
}
```

The full document uses the shape shown in the create response.
Possible errors: **400** for an invalid ID; **404** if absent, owned by another user,
or ownerless; **500** for an
unexpected failure.

## Update learning fields

**PATCH `/api/problems/:id`**

Authentication: Bearer access token required. Send `Content-Type: application/json`.

Send at least one supported field inside `userLearningInfo`. Fields can be updated
independently or together:

```json
{
  "userLearningInfo": {
    "confidence": 4,
    "whatILearned": "Use a map to find the complement.",
    "whatIStruggledWith": "Recognizing the invariant.",
    "mistake": "Forgot to check the empty input."
  }
}
```

| Field | Accepted value |
| --- | --- |
| `confidence` | Number from 0 to 5, inclusive |
| `whatILearned` | String of at most 1,000 characters |
| `whatIStruggledWith` | String of at most 1,000 characters |
| `mistake` | String of at most 1,000 characters |

Only supplied fields are changed; omitted learning fields, solved dates, metadata,
and ownership remain unchanged. `0` is a valid confidence, and `""` clears a text
field. Text is not trimmed. Nulls and incorrect types are rejected.

Both the top-level body and `userLearningInfo` are strict. Empty updates,
unsupported keys such as `notes`, solved dates, metadata, update operators, and
ownership fields such as `userId` return 400, even alongside valid learning fields.
Unlike CREATE, PATCH rejects body-supplied ownership fields rather than ignoring
them. Validation failures never reach the update query and do not write any
Problem data. Property names are case-sensitive.

The controller passes validated input and the authenticated owner ID to the
service. It builds a dotted-field `$set` from the four-field allowlist and retains
one atomic `findOneAndUpdate` using `{ _id: id, userId }`, with Mongoose validators
enabled. Another user's, ownerless, or missing problem returns 404 for a valid
update body. There is no ownership assignment or migration.

Phase 1 verification: all 17 targeted integration tests and all 66 backend tests
passed with isolated MongoDB enabled and none skipped. The invalid-body checks
assert that the update query is never called and stored Problem records,
including timestamps, remain unchanged.

Response: **200 OK** (problem fields abbreviated):

```json
{
  "success": true,
  "message": "update succesfully",
  "data": {
    "_id": "<problem-id>",
    "userLearningInfo": {
      "confidence": 4,
      "whatILearned": "Use a map to find the complement.",
      "whatIStruggledWith": "Recognizing the invariant.",
      "mistake": "Forgot to check the empty input."
    }
  }
}
```

The message spelling matches the current code. Possible errors: **400** for
invalid input, invalid ID, or no supported update; **404** if absent, owned by
another user, or ownerless; **500**
for unexpected failures.

## Delete a problem

**DELETE `/api/problems/:id`**

Authentication: Bearer access token required. Request body: none.

Response: **200 OK** (problem fields abbreviated):

```json
{
  "success": true,
  "message": "problem deleted",
  "data": { "_id": "<problem-id>" }
}
```

`data` contains the deleted document. Possible errors: **400** for an invalid
ID; **404** if absent, owned by another user, or ownerless; **500** for unexpected failures.

## Error format and testing

Application errors use this shape. Field details appear when available:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email address" }
  ]
}
```

Unexpected failures return `Internal Server Error` with `errors: null`.
Malformed JSON returns `Invalid JSON body` with `errors: null`.
The old POST `/api/test` endpoint has been removed and returns 404.

For Postman, use a development database. Check registration succeeds, repeated
normalized emails return 409, invalid inputs return 400, and repeated attempts
reach 429 with a Retry-After header. Never put passwords in URLs or logs.
Request logs omit query strings. Use HTTPS for deployment.

The [server README](../server/README.md) explains automated tests. The
Checkpoint 2, Stage 3 run on November 17, 2026 passed all 46 tests with isolated MongoDB enabled and none skipped,
including middleware authentication and rejection after deleting a real user.
Ownership is enforced. Ownerless records have not been changed;
there is no automatic assignment or public claim endpoint.

## JWT middleware contract

`authenticate` in `server/src/middleware/auth.middleware.js` expects:

```http
Authorization: Bearer <accessToken>
```

The scheme is case-insensitive. Missing credentials, incorrect schemes, extra
credentials, and malformed compact JWTs return 401. The middleware verifies the
signature using **HS256 only**, and checks configured `JWT_ISSUER`,
`JWT_AUDIENCE`, and expiration. `exp` must be present and numeric; expired tokens
are rejected at the expiration boundary. `sub` must be a string containing a
24-character hexadecimal MongoDB ObjectId. Invalid claims fail before a user query.

The middleware then looks up the user in MongoDB on every authenticated request.
An absent/deleted account returns 401 even if the token is correctly signed and
unexpired. On success it attaches only `{ id, name, email }` from the current
database record to `req.user` and calls the next handler. No password hash is
selected or attached, and extra token claims do not become identity fields.

All authentication rejections have the same **401 Unauthorized** response:

```json
{
  "success": false,
  "message": "Authentication required",
  "errors": null
}
```

Database or JWT configuration failures use **500 Internal Server Error** with
`errors: null`. No verification exception, configuration value, or database detail
is exposed. All five Problem routes apply this middleware before route validators
and controllers via `router.use(authenticate)`. Missing/invalid credentials return
401 before Problem data access. Global JSON parsing still runs before routers, so
malformed JSON can return 400 before authentication.

After authentication, Problem services scope queries to `req.user.id` and exclude
other users' and ownerless records. Frontend authentication is unchanged. All Problem endpoints
can return the generic 401 above in addition to their documented errors. Health,
registration, and login remain public.

## Manual Postman testing for JWT middleware

The Checkpoint 3, Stage 2 run on November 18, 2026 passed all 54 tests with isolated
MongoDB enabled and none skipped. Integration checks cover missing/invalid tokens
on all five Problem routes, authenticated CRUD through the existing controllers,
and public health/register/login access.

Use a disposable development database in `server/.env` and start the normal API
from the repository root with `npm run server`. No temporary probe server is needed.

1. In Postman, create an account with `POST http://localhost:5000/api/auth/register`
   using the registration JSON above and a fresh development-only email. No token is needed.
2. Log in with `POST http://localhost:5000/api/auth/login`. Save
   `data.accessToken` in a local Postman variable named `accessToken` and save
   `data.user.id` as `userId`.
3. Send `GET http://localhost:5000/api/problems`. Select Authorization > Bearer Token
   and enter `{{accessToken}}`. Expect **200** with the existing problems/pagination
   response containing only that account's problems. This endpoint does not return `req.user`.
4. Exercise POST, GET by ID, PATCH, and DELETE with the same Bearer token and the
   documented request bodies. Omit `userId` on POST; it is assigned from the token.
5. Run the failure cases below against `GET /api/problems`; expect the exact generic
   401 response above. Ensure inherited authorization is disabled when testing a
   missing header, and avoid duplicate Authorization headers.
6. Register and log in a second disposable user with a separate token. Create a
   problem as User A and save its `_id`. With User B's token, verify LIST excludes
   it and GET/PATCH/DELETE by that ID return 404. For PATCH use a valid confidence body.
7. As User B, POST a problem with User A's `userId` in the body: expect 201 with
   User B's ID in the response. As User A, PATCH its own problem with a valid
   learning-field change plus User B's `userId`: expect 400 with the problem
   completely unchanged. Remove `userId` and resend: expect 200 with ownership
   still set to User A. Repeat searches/filters and paginated lists using both tokens;
   each account's records and totals must remain separate.

| Case | How to test | Expected |
| --- | --- | --- |
| Missing token | Select No Auth and remove any Authorization header | 401 |
| Malformed token | Set `Authorization: Bearer not-a-jwt`, or use `Basic abc` | 401 |
| Tampered token | Change a character in the payload segment of the saved JWT, preserving its signature | 401 |
| Expired token | Wait at least 15 minutes after login, or use the locally signed expired fixture below | 401 |
| Wrong issuer | Use a locally signed fixture with a different issuer (below) | 401 |
| Wrong audience | Use a locally signed fixture with a different audience (below) | 401 |
| Deleted user | Log in again; delete only that disposable account in MongoDB Compass by `_id: ObjectId("<userId>")`; resend its unexpired token | 401 |

To create the wrong-issuer, wrong-audience, and expired fixtures quickly, open
another PowerShell terminal in `server/`, set the registered user's ID, and run:

```powershell
$env:RECALL_TEST_USER_ID = '<userId>'
@'
import "dotenv/config";
import jwt from "jsonwebtoken";
import { getJwtConfig } from "./src/config/jwt.js";
const { secret, issuer, audience } = getJwtConfig();
const options = { algorithm: "HS256", subject: process.env.RECALL_TEST_USER_ID, issuer, audience, expiresIn: 900 };
console.log("wrongIssuer:", jwt.sign({}, secret, { ...options, issuer: issuer + "-wrong" }));
console.log("wrongAudience:", jwt.sign({}, secret, { ...options, audience: audience + "-wrong" }));
console.log("expired:", jwt.sign({}, secret, { ...options, expiresIn: -1 }));
'@ | node --input-type=module
Remove-Item Env:RECALL_TEST_USER_ID
```

Use each printed development token as the Problem request's Bearer token. These fixtures
are signed locally with the same key, so issuer/audience failures exercise claim
checks rather than a signature mismatch. Do not paste secrets or real tokens
into online JWT tools, shared Postman environments, or committed files.
All `/api/problems` endpoints require a valid token; `/api/health` and the
registration/login endpoints remain public.
