# Recall V1 API

Local base URL: `http://localhost:5000/api` when `PORT=5000`.

Registration, login, and JWT generation are implemented and tested.
JWT verification middleware and user ownership are pending. No endpoint requires a token.
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
is pending, so this stage does not protect problem routes.

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

## Add a problem

**POST `/api/problems`**

Authentication: none at this checkpoint. Send `Content-Type: application/json`.

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

Authentication: none at this checkpoint. Request body: none.

All query parameters are optional:

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

Authentication: none at this checkpoint. Request body: none. Replace `:id` with
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
Possible errors: **400** for an invalid ID; **404** if absent; **500** for an
unexpected failure.

## Update confidence

**PATCH `/api/problems/:id`**

Authentication: none at this checkpoint. Send `Content-Type: application/json`.

Required body for a working update:

```json
{
  "userLearningInfo": {
    "confidence": 4
  }
}
```

Confidence must be a number from 0 to 5. Other learning fields pass validation
but are currently ignored by the service. Sending only notes or mistakes
returns 400. Problem metadata cannot be edited yet.

Response: **200 OK** (problem fields abbreviated):

```json
{
  "success": true,
  "message": "update succesfully",
  "data": {
    "_id": "<problem-id>",
    "userLearningInfo": { "confidence": 4 }
  }
}
```

The message spelling matches the current code. Possible errors: **400** for
invalid input, invalid ID, or no supported update; **404** if absent; **500**
for unexpected failures.

## Delete a problem

**DELETE `/api/problems/:id`**

Authentication: none at this checkpoint. Request body: none.

Response: **200 OK** (problem fields abbreviated):

```json
{
  "success": true,
  "message": "problem deleted",
  "data": { "_id": "<problem-id>" }
}
```

`data` contains the deleted document. Possible errors: **400** for an invalid
ID; **404** if absent; **500** for unexpected failures.

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

The [server README](../server/README.md) explains automated tests. The last
Checkpoint 2, Stage 2 run on November 16, 2026 passed all 22 tests with none skipped,
including isolated registration/login verification and query-string logging protection.
JWT verification middleware and ownership are pending. Ownerless records have not been changed;
there is no automatic assignment or public claim endpoint.
