# Recall Backend

This is the backend for Recall. It handles user registration, login credential
verification, JWT issuance and verification, and APIs for saving and listing DSA problems. Login
returns a signed access token; reusable JWT verification middleware is implemented.
Problem APIs require Bearer authentication and enforce per-user ownership. New
problems derive `userId` exclusively from the authenticated identity.

## Technologies used

- Node.js and Express.js
- MongoDB and Mongoose
- Zod, bcrypt, and express-rate-limit
- jsonwebtoken for signed access tokens
- Node's test runner and Supertest

## Folder structure

```text
server/
  src/
    config/        Database connection and JWT configuration
    controllers/   Request and response handling
    middleware/    JWT authentication, error handling, and authentication request limits
    models/        User and Problem schemas
    routes/        API endpoints
    services/      Registration, login, and problem operations
    validators/    Input checks
    app.js         Express app setup
    server.js      Database connection and server startup
  tests/           Authentication, ownership schema, and two-user authorization tests
```

## Install and configure

Run this from the project root:

```sh
npm ci --prefix server
```

Copy `server/.env.example` to `server/.env` and set:

```dotenv
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/recall_dev
JWT_SECRET=<hex-encoded-secret-generated-locally>
JWT_ISSUER=recall-api
JWT_AUDIENCE=recall-client
```

`PORT` is the API port. `MONGO_URI` is your development database URL. Never commit
real credentials or `.env`.

Generate a secret locally from the project root. This PowerShell command captures
it in a variable without printing it:

```powershell
$recallJwtSecret = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use that value for `JWT_SECRET` in `server/.env`; do not share it or commit it.
The secret must be hex-encoded, have an even length of at least 64 characters
(32 decoded bytes), and cannot consist of one repeated byte. Randomness cannot
be established from length or format alone: use the generator, not a passphrase.
`JWT_ISSUER` identifies this API and `JWT_AUDIENCE` identifies its intended client.
Both must be nonempty strings of at most 256 characters without whitespace.
The example identifiers above are suitable for development.

The signing algorithm is explicitly HS256; expiry is fixed at 900 seconds.
Configuration is checked when issuing a token after valid credentials. Missing
or invalid settings return a generic 500 without a token or configuration details.
Registration and invalid-credential responses do not depend on JWT settings.
Restart the server after changing `.env`.

## Available endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Verify credentials and return an access token and safe user details |
| GET | `/api/health` | Check that the API responds |
| POST | `/api/problems` | Add a problem |
| GET | `/api/problems` | List, search, filter, sort, and paginate problems |
| GET | `/api/problems/:id` | Get one problem |
| PATCH | `/api/problems/:id` | Update confidence only |
| DELETE | `/api/problems/:id` | Delete a problem |

Every Problem endpoint requires `Authorization: Bearer <accessToken>`. Health,
registration, and login remain public. Registration and login are tested; problem database
operations still need broader testing. See the [API reference](../docs/api.md)
for request bodies, responses, and known limitations.

## Run the server

From the project root:

```sh
npm run server
```

To run without automatic restarts:

```sh
npm start --prefix server
```

The server connects to MongoDB before listening on the configured port.

## Run tests

From the project root:

```sh
npm test --prefix server
```

Database integration tests are skipped unless `MONGOD_BINARY` is set.
To include them, point that variable to your local MongoDB executable. For example,
in PowerShell (replace the path with yours):

```powershell
$env:MONGOD_BINARY = 'C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
npm test --prefix server
```

Set this variable in your terminal, not in `.env`. Each database test starts its
own MongoDB process on a random local port with a temporary data folder. They never
use the app's database URL. Each stops its process and removes its test folder
afterward.

The Checkpoint 2, Stage 3 run on November 17, 2026 passed all 46 tests with isolated MongoDB
enabled and none skipped.
They cover registration, password hashing, validation, duplicate emails, safe
errors, request limits, and exclusion of query strings from request logs. The
database test also checks saved accounts after reconnecting and confirms an
existing ownerless problem fixture stays unchanged. Login tests cover successful
verification, incorrect passwords, unknown emails, invalid input, safe response
fields, hidden-hash retrieval, generic errors, and a separate login rate limit.
JWT tests verify signatures, minimal claims, the 15-minute expiry boundary,
configuration failures, and that invalid credentials never call the signer.
Tests generate temporary random signing keys and never read your `.env`.

## Problem ownership schema

Checkpoint 3, Stage 1 adds this field in `src/models/problem.model.js`:

```js
userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true,
  index: true,
}
```

The ascending `{ userId: 1 }` index is non-unique: one user may own many problems.
`ref` enables population; it does not check that the user exists or enforce access.
The schema requirement applies to normal Mongoose document validation, including create
and save. There is no default, backfill, migration, or database collection validator.
Existing ownerless documents remain readable directly through the model/database
and unchanged in storage. Saving one normally
fails validation until an explicit owner is supplied; query updates only validate
the affected paths, so this is not a blanket ownership requirement for every write.

Checkpoint 3, Stage 3 enforces ownership in the controllers and services:

- Controllers pass `req.user.id` as a separate argument to every Problem service.
- CREATE accepts only problem content and sets `userId` from that trusted argument.
  Client-supplied `userId`, ownership aliases, and `_id` are ignored. Omit `userId`
  from the request body; the schema requirement is fulfilled by the service.
- LIST starts with an ObjectId owner filter before search, filters, sorting, and
  pagination; aggregation and `countDocuments` share that filter.
- GET, UPDATE, and DELETE use `{ _id: id, userId }`. Writes are scoped in the
  database operation itself. Missing, other-user, and ownerless records return 404.
- UPDATE builds only a confidence `$set`; ownership fields cannot change ownership.
  An ownership-only request has no supported update and returns 400.

Ownerless records stay in MongoDB without assignment or migration and are excluded
from every user's API access and counts. The schema's `ref` alone is not an access
control; the scoped service queries enforce it. No frontend change is included.

`tests/problem-ownership.integration.test.js` uses isolated MongoDB to verify
creation with a real user reference, population, multiple problems per user, the
actual non-unique index, missing/null/malformed IDs, and preservation of a legacy
ownerless record after model initialization and a rejected save.
The Checkpoint 3, Stage 1 run on November 17, 2026 passed all 50 tests with both
isolated database tests enabled and none skipped.

## JWT verification middleware

`src/middleware/auth.middleware.js` exports `authenticate`. In Checkpoint 3,
Stage 2, `src/routes/problem.routes.js` applies `router.use(authenticate)` before
all five route declarations, their validators, and their controllers. Health,
registration, and login are mounted separately and remain public. The controllers
and services enforce ownership after authentication succeeds.

1. Read `Authorization: Bearer <token>` (case-insensitive scheme; one credential).
2. Verify with the decoded configured secret and `algorithms: ["HS256"]`, the
   configured issuer and audience, and expiration checking enabled.
3. Require a finite numeric `exp` and a string `sub` that is a 24-digit hex MongoDB ID.
4. Query MongoDB for that ID, selecting only `_id`, `name`, and `email`.
5. Reject absent/deleted users; otherwise set `req.user = { id, name, email }`
   from the current database record and call `next()`.

Missing, malformed, invalid, expired, or deleted-user credentials all return
401 with `{ "success": false, "message": "Authentication required", "errors": null }`.
Configuration and database failures return the existing generic 500 response.
No token, password hash, or internal error is returned. The JWT must contain an
expiration; merely omitting `exp` cannot create a non-expiring accepted token.

Middleware tests cover all required rejection cases, missing claims, invalid
subjects, HS384 and unsigned tokens, future `nbf`, safe identity fields, and
generic infrastructure failures. The isolated database test authenticates a
real login token, deletes that account, and checks the same token returns 401.
The isolated registration integration test also checks missing/invalid tokens on
all five Problem routes before Problem database calls, successful CRUD through the
existing controllers with a login token, and public health/register/login access.
The Checkpoint 3, Stage 2 run on November 18, 2026 passed all 54 tests with isolated
MongoDB enabled and none skipped.
`tests/problem-authorization.integration.test.js` registers and logs in two users,
checks cross-user and ownerless denials, ignores spoofed CREATE/UPDATE ownership,
and verifies owner-scoped filters, search, every supported sort, pagination, and counts.
The Checkpoint 3, Stage 3 run on November 18, 2026 passed all 62 tests with all three
isolated MongoDB integration fixtures enabled and none skipped.
See [manual Postman testing](../docs/api.md#manual-postman-testing-for-jwt-middleware)
for requests against the authenticated Problem API.

Login normalizes the email, retrieves the account's hidden password hash only
for verification, and checks the password with `bcrypt.compare()`. Success
returns a user containing only `id`, `name`, and `email`, alongside `accessToken`.
The token contains only `sub` (the user's MongoDB ID), `iss`, `aud`, `iat`, and
`exp`; it contains no name, email, password, or password hash. Unknown emails and wrong passwords both
return 401 with `Invalid email or password`. No password or hash is returned.

The dependency audit during this stage reported 7 issues in existing dependencies
(2 moderate, 4 high, 1 critical); none was reported for jsonwebtoken. Dependency
remediation is separate from this JWT issuance change.
