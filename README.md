# Recall

A simple way to keep track of DSA problems and build a regular revision habit.

## About the project

I am building Recall as my college major project. I wanted one place to save the
DSA problems I solve and keep track of what I learn. The goal is to make it easier
to revisit problems, remember mistakes, and plan revisions.

## Features and progress

| Feature | Current status |
| --- | --- |
| User registration | Backend completed and tested |
| Login API | Returns a signed access token and safe user details |
| JWT authentication | Token issuance and verification middleware completed and tested; routes remain public |
| Private problems for each user | Not implemented yet |
| Problem management | Backend APIs exist; editing is incomplete |
| Search, filters, sorting, and pagination | Backend code exists; database results still need verification |
| Learning notes and mistakes | Fields exist; editing needs fixing |
| Revision tracking, goals, streaks, and dashboard | Planned |
| Frontend | Basic React page only |

Registration and login work through the API. There is no authentication UI yet.
Problem APIs are still public until user ownership is added.

## Technologies used

- React, Vite, and Tailwind CSS
- Node.js and Express.js
- MongoDB and Mongoose
- Zod for input validation
- bcrypt for password hashing

## Project structure

```text
Recall/
  client/   React frontend
  server/   Express backend and tests
  docs/     API reference and project diary
```

## Requirements

- Node.js and npm (tested with Node.js 22.23.2)
- A MongoDB database for local development

## Installation and setup

From the project root, install the dependencies:

```sh
npm ci
npm ci --prefix client
npm ci --prefix server
```

Copy `server/.env.example` to `server/.env`. Set your development database URL:

```dotenv
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/recall_dev
JWT_SECRET=<hex-encoded-secret-generated-locally>
JWT_ISSUER=recall-api
JWT_AUDIENCE=recall-client
```

This example uses local MongoDB. Replace the URL if you use another development
database. Keep `.env` and any real credentials out of Git.

Login requires a JWT secret made from at least 32 cryptographically random bytes,
encoded as hex (64 or more hex characters), plus a nonempty issuer and audience.
Generate it locally using the instructions in the [server README](server/README.md).
The placeholder above is intentionally invalid. Tokens use HS256 and expire in
15 minutes. Missing or invalid JWT settings cause login to return a generic 500.

## Run the project

Start both apps from the project root:

```sh
npm run dev
```

Or run them in separate terminals:

```sh
npm run client
npm run server
```

The frontend normally runs at `http://localhost:5173`. The API uses
`http://localhost:5000` with the settings above. The server needs a working
MongoDB connection before it starts listening.

## Current development status

Recall V1 is on Day 1, Checkpoint 2, Stage 3. Registration and login are tested,
including registering and logging in against a separate test database.
Login issues JWTs. The reusable `authenticate` middleware verifies Bearer tokens,
HS256 signatures, issuer, audience, expiration, and MongoDB user existence. It
attaches only `id`, `name`, and `email` to `req.user`. No production route uses
it yet; problem ownership and frontend authentication are still pending.
Existing problems without an owner have not been changed.

Stage 3 adds middleware tests for valid, missing, malformed, tampered, expired,
wrong-issuer, wrong-audience, and deleted-user tokens, plus claim and algorithm
checks. The isolated MongoDB test also verifies authentication before and after
deleting an account. See the API reference for a local Postman probe.
The November 17, 2026 run passed all 46 tests with isolated MongoDB enabled and
none skipped.
See the [server README](server/README.md) to run tests and the
[API reference](docs/api.md) for requests and responses.

V2 is separate. External coding-platform integrations are not part of V1.
