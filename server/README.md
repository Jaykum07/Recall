# Recall Backend

This is the backend for Recall. It handles user registration, login credential
verification, JWT issuance and verification, and APIs for saving and listing DSA problems. Login
returns a signed access token; reusable JWT verification middleware is implemented.
Problem APIs are still public pending ownership.

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
  tests/           Registration, login, token, and authentication middleware tests
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

No endpoint requires a token yet. Authentication middleware is tested on a separate
probe app without mounting it on production routes. Registration and login are tested; problem database
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

The suite has 46 tests: 45 run and the database test is skipped unless `MONGOD_BINARY` is set.
To include it, point that variable to your local MongoDB executable. For example,
in PowerShell (replace the path with yours):

```powershell
$env:MONGOD_BINARY = 'C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
npm test --prefix server
```

Set this variable in your terminal, not in `.env`. The database test starts its
own MongoDB process on a random local port with a temporary data folder. It never
uses the app's database URL. It stops that process and removes its test folder
afterward.

The Stage 3 run on November 17, 2026 passed all 46 tests with isolated MongoDB
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

## JWT verification middleware

`src/middleware/auth.middleware.js` exports `authenticate`. For future protected
routes it runs before the controller. It is deliberately not mounted on any
production route in Checkpoint 2, Stage 3.

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
See [manual Postman testing](../docs/api.md#manual-postman-testing-for-jwt-middleware)
for a local-only probe without changing production routes.

Login normalizes the email, retrieves the account's hidden password hash only
for verification, and checks the password with `bcrypt.compare()`. Success
returns a user containing only `id`, `name`, and `email`, alongside `accessToken`.
The token contains only `sub` (the user's MongoDB ID), `iss`, `aud`, `iat`, and
`exp`; it contains no name, email, password, or password hash. Unknown emails and wrong passwords both
return 401 with `Invalid email or password`. No password or hash is returned.

The dependency audit during this stage reported 7 issues in existing dependencies
(2 moderate, 4 high, 1 critical); none was reported for jsonwebtoken. Dependency
remediation is separate from this JWT issuance change.
