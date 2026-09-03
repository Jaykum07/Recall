# Day 6 — Express Routes & Controllers

## 1. Express Router

### What is Express Router?

Express gives us `express.Router()` to create a router object.

A router works like a **mini Express application** where we can define and group related routes.

For example, all problem-related APIs can be kept inside `problem.routes.js`.

```js
import express from "express";

const router = express.Router();
````

Now we can define routes using:

```js
router.get("/", ...);
router.post("/", ...);
router.get("/:id", ...);
```

### Why do we use Express Router?

If we put every API directly inside `app.js`, the file can become very large and difficult to manage.

Instead, we separate routes according to their responsibility:

```text
routes/
├── health.routes.js
├── problem.routes.js
├── user.routes.js
├── revision.routes.js
├── goal.routes.js
└── sheet.routes.js
```

This keeps the project clean and scalable.

---

## 2. Route vs Controller

### Route

A route decides:

* Which HTTP method is being used.
* Which URL/path should be matched.
* Which controller should handle the request.

Example:

```js
router.post("/", createProblemController);
```

Route = **Where to go and who handles the request**

### Controller

A controller decides:

* What action should be performed.
* How to process the request.
* What response should be sent to the client.

Example:

```js
export const createProblemController = (req, res) => {
  res.status(201).json({
    success: true,
    message: "Problem created",
  });
};
```

Controller = **What to do with the request**

### Simple Difference

```text
Route      → Where to go
Controller → What to do
```

---

## 3. `app.use()`

### What is `app.use()`?

`app.use()` is used to register middleware or mount a router in the Express application.

Example:

```js
app.use("/api/problems", problemRouter);
```

This connects `problemRouter` with the `/api/problems` prefix.

The router then handles the routes under that prefix.

---

## 4. Route Prefix

### What is a Route Prefix?

A route prefix is the common starting part of a URL.

Example:

```js
app.use("/api/problems", problemRouter);
```

Here:

```text
/api/problems
```

is the route prefix.

If the router contains:

```js
router.get("/:id", getProblemController);
```

Express combines them:

```text
/api/problems + /:id
```

Final API:

```text
GET /api/problems/:id
```

### Example

```js
// app.js
app.use("/api/problems", problemRouter);
```

```js
// problem.routes.js
router.get("/", getProblemsController);
router.get("/:id", getProblemController);
```

Complete APIs:

```text
GET /api/problems
GET /api/problems/:id
```

---

## 5. Request Data

There are three important ways to receive data from a client:

```text
req.body
req.params
req.query
```

---

### `req.body`

`req.body` contains data sent inside the request body.

It is commonly used with:

```text
POST
PUT
PATCH
```

Example request:

```http
POST /api/problems
```

Body:

```json
{
  "problemName": "Two Sum",
  "difficulty": "easy"
}
```

Access the data using:

```js
req.body.problemName
req.body.difficulty
```

For JSON body parsing, Express needs:

```js
app.use(express.json());
```

Simple way to remember:

```text
req.body → What data am I sending?
```

---

### `req.params`

`req.params` contains values that are part of the URL.

We define a parameter using `:`.

Example route:

```js
router.get("/:id", getProblemController);
```

Request:

```text
GET /api/problems/123
```

Access:

```js
req.params.id
```

Result:

```text
123
```

Simple way to remember:

```text
req.params → Which specific resource?
```

---

### `req.query`

`req.query` contains query parameters.

Query parameters are written after `?` in the URL.

Example:

```text
GET /api/problems?difficulty=hard&platform=leetcode
```

Access:

```js
req.query.difficulty
req.query.platform
```

Result:

```text
difficulty → hard
platform   → leetcode
```

Query parameters can be used for:

* Filtering
* Searching
* Sorting
* Pagination
* Customizing results

Simple way to remember:

```text
req.query → How should I filter/customize the result?
```

---

## 6. Quick Difference: Body vs Params vs Query

| Type         | Used For                     | Example              |
| ------------ | ---------------------------- | -------------------- |
| `req.body`   | Data sent in request body    | `POST /api/problems` |
| `req.params` | Identify a specific resource | `/api/problems/:id`  |
| `req.query`  | Filter/customize results     | `?difficulty=easy`   |

### Easy Memory Trick

```text
BODY
↓
What data?

PARAMS
↓
Which resource?

QUERY
↓
How should I filter/customize?
```

---

## 7. Complete Request Flow

For a request:

```text
POST /api/problems
```

the request flows through the application like this:

```text
Client
  ↓
app.js
  ↓
Middleware
  ↓
problemRouter
  ↓
problem.routes.js
  ↓
createProblemController
  ↓
Response
```

### Detailed Flow

First, the client sends:

```text
POST /api/problems
```

The request reaches `app.js`.

In `app.js`:

```js
app.use("/api/problems", problemRouter);
```

Express matches the `/api/problems` prefix and sends the request to `problemRouter`.

Inside `problem.routes.js`:

```js
router.post("/", createProblemController);
```

The remaining `/` path matches the route.

Express then calls:

```js
createProblemController
```

The controller performs the required action and sends a response:

```js
res.status(201).json({
  success: true,
  message: "Problem created",
});
```

Complete flow:

```text
POST /api/problems
        ↓
      app.js
        ↓
  /api/problems
        ↓
  problemRouter
        ↓
  router.post("/")
        ↓
createProblemController
        ↓
    HTTP Response
```

---

## 8. Problem API Routes Created

Today I created the basic Problem API routes:

```text
POST   /api/problems
GET    /api/problems
GET    /api/problems/:id
PATCH  /api/problems/:id
DELETE  /api/problems/:id
```

### HTTP Methods

```text
POST
→ Create a new problem

GET
→ Get problems

GET /:id
→ Get a specific problem

PATCH /:id
→ Update part of a problem

DELETE /:id
→ Delete a problem
```

All five APIs were tested successfully.

---

## 9. Project Structure

After today's work, the relevant backend structure is:

```text
src/
├── app.js
├── server.js
│
├── routes/
│   ├── health.routes.js
│   └── problem.routes.js
│
├── controllers/
│   ├── health.controller.js
│   └── problem.controller.js
│
├── config/
├── middleware/
├── models/
├── services/
└── validators/
```

---

## 10. Example Problem Route

### `problem.routes.js`

```js
import express from "express";

import {
  createProblemController,
  deleteProblemController,
  getProblemController,
  getProblemsController,
  updateProblemController,
} from "../controllers/problem.controller.js";

const router = express.Router();

router.post("/", createProblemController);

router.get("/", getProblemsController);

router.get("/:id", getProblemController);

router.patch("/:id", updateProblemController);

router.delete("/:id", deleteProblemController);

export default router;
```

### `app.js`

```js
import express from "express";
import healthRouter from "./routes/health.routes.js";
import problemRouter from "./routes/problem.routes.js";

const app = express();

const logger = (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
};

app.use(express.json());

app.use(logger);

app.use("/api", healthRouter);
app.use("/api/problems", problemRouter);

export default app;
```

---

## 11. What I Practiced Today

* Learned what `express.Router()` is.
* Understood that Router works like a mini Express application.
* Learned why related routes should be grouped together.
* Understood the difference between routes and controllers.
* Created `problem.routes.js`.
* Created `problem.controller.js`.
* Connected `problemRouter` with `app.js`.
* Learned how route prefixes work.
* Practiced `req.body`.
* Practiced `req.params`.
* Practiced `req.query`.
* Tested all five Problem APIs.
* Understood the complete request flow from client to controller.

---

## 12. Key Learnings

### Express Router

```text
express.Router()
→ Creates a router object
→ Groups related routes
```

### Route

```text
Route
→ Where to go
→ Which controller handles the request
```

### Controller

```text
Controller
→ What to do
→ Process request
→ Send response
```

### `app.use()`

```text
app.use()
→ Register middleware
→ Mount routers
```

### Request Data

```text
req.body
→ Request body data

req.params
→ URL parameters

req.query
→ Query/filter parameters
```

---

## 13. Mistakes / Things I Need to Revise

* Initially I was confused about `express.Router()`.
* I understood that Router is a mini router/application used to group related routes.
* I initially mixed up the route prefix and the complete URL.
* I learned that the prefix from `app.use()` and the path inside the router combine to create the final endpoint.
* I need to remember the difference between `req.body`, `req.params`, and `req.query`.

---

## 14. Day 6 Status

* [x] Express Router
* [x] Routes
* [x] Controllers
* [x] `app.use()`
* [x] Route Prefix
* [x] `req.body`
* [x] `req.params`
* [x] `req.query`
* [x] Problem API routes
* [x] Controller separation
* [x] API Testing
* [x] Complete request flow
* [x] Day 6 Diary

---

## 15. Day 6 Summary

Today I learned how to structure Express APIs using routes and controllers instead of keeping everything inside `app.js`.

The main architecture I learned is:

```text
Client
  ↓
Express App
  ↓
Middleware
  ↓
Route
  ↓
Controller
  ↓
Response
```

This makes the backend cleaner, easier to understand, test, and scale.

```
```
