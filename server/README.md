# Recall Backend

This is the backend for Recall. It currently handles user registration and has
APIs for saving and listing DSA problems. Login and user ownership are not added
yet, so problem APIs are still public.

## Technologies used

- Node.js and Express.js
- MongoDB and Mongoose
- Zod, bcrypt, and express-rate-limit
- Node's test runner and Supertest

## Folder structure

```text
server/
  src/
    config/        Database connection
    controllers/   Request and response handling
    middleware/    Error handling and registration limits
    models/        User and Problem schemas
    routes/        API endpoints
    services/      Registration and problem operations
    validators/    Input checks
    app.js         Express app setup
    server.js      Database connection and server startup
  tests/           Registration tests
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
```

`PORT` is the API port. `MONGO_URI` is your development database URL. Never commit
real credentials or `.env`. JWT settings are not needed at this checkpoint.

## Available endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account |
| GET | `/api/health` | Check that the API responds |
| POST | `/api/problems` | Add a problem |
| GET | `/api/problems` | List, search, filter, sort, and paginate problems |
| GET | `/api/problems/:id` | Get one problem |
| PATCH | `/api/problems/:id` | Update confidence only |
| DELETE | `/api/problems/:id` | Delete a problem |

All current endpoints are public. Registration is tested; problem database
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

This runs 9 tests and skips the database test unless `MONGOD_BINARY` is set.
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

The Checkpoint 1 run on November 16, 2026 passed all 10 tests with none skipped.
They cover registration, password hashing, validation, duplicate emails, safe
errors, request limits, and exclusion of query strings from request logs. The
database test also checks saved accounts after reconnecting and confirms an
existing ownerless problem fixture stays unchanged.
