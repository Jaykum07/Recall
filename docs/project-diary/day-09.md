# Day 9 — Error Handling in Express

## 🎯 Today's Goal

Today I learned how to handle errors properly in our Recall backend.

I learned:

- try...catch
- throw error
- next()
- next(error)
- Error-handling middleware
- Centralized error handling
- HTTP error status codes
- Complete error flow from MongoDB to client

---

# Error Handling

## What is Error Handling?

Error handling means when something goes wrong in our application, we should handle it properly instead of allowing the application to return an incorrect response or expose internal errors.

Example:

```text
Request
   ↓
Controller
   ↓
Service
   ↓
MongoDB
   ↓
ERROR
   ↓
Error Handler
   ↓
HTTP Response
````

---

# try...catch

We use `try...catch` when an operation can fail.

```js
try {
  // risky operation
} catch (err) {
  // handle error
}
```

In our Recall project, database operations can fail, so we use `try...catch`.

Example:

```js
const createProblemService = async (problemData) => {
  try {
    const problem = await Problem.create({
      ...problemData,
      userLearningInfo: {
        ...problemData.userLearningInfo,
        confidence: 3,
      },
    });

    return problem;
  } catch (err) {
    console.log("Problem creation failed");
    throw err;
  }
};
```

---

# Why `console.log(error)` is not enough?

If we only write:

```js
console.log(err);
```

the error is printed only in the server terminal.

The client does not receive a proper HTTP response.

So we need to pass the error through the Express error-handling flow.

```text
console.log(err)
      ↓
Server terminal only
```

Instead:

```text
Error
 ↓
throw err
 ↓
Controller
 ↓
next(err)
 ↓
Error Middleware
 ↓
HTTP Response
```

---

# throw error

Inside the Service:

```js
catch (err) {
  console.log("Problem creation failed");
  throw err;
}
```

`throw err` passes the error back to the layer calling the Service.

We don't send an HTTP response from the Service because HTTP response handling belongs to the Controller/Error Middleware.

---

# Controller Error Handling

Our Controller:

```js
export const createProblemController = async (req, res, next) => {

  try {

    const problem = await createProblemService(req.body);

    res.status(201).json({
      success: true,
      message: "problem created",
      data: problem,
    });

  } catch (err) {

    next(err);

  }

};
```

The Controller has two responsibilities here:

### Successful request

```text
Service returns problem
        ↓
Controller
        ↓
201 Created
```

### Failed request

```text
Service throws error
        ↓
Controller catch
        ↓
next(err)
```

---

# `next()` vs `next(err)`

## `next()`

```js
next();
```

means:

> Continue to the next middleware in the normal middleware chain.

---

## `next(err)`

```js
next(err);
```

means:

> An error occurred. Pass this error to Express's error-handling middleware.

### Easy way to remember

```text
next()
→ Continue normally

next(err)
→ Something went wrong
→ Go to error handling
```

---

# Error Middleware

Created:

```text
server/src/middleware/error.middleware.js
```

Code:

```js
export const errorMiddleware = (err, req, res, next) => {

  res.status(500).json({
    success: false,
    message: "Internal Server Error"
  });

};
```

---

# Why does Error Middleware have 4 parameters?

Normal middleware usually has:

```js
(req, res, next)
```

Error middleware has:

```js
(err, req, res, next)
```

The first parameter is the error.

Express recognizes a middleware with four parameters as an error-handling middleware.

---

# Why don't we call `next()` after `res.json()`?

We initially wrote:

```js
res.status(500).json({
  success: false,
  message: "Internal Server Error"
});

next();
```

This is unnecessary.

Once we send the response:

```js
res.json(...)
```

the request is finished.

So we don't call `next()` afterward.

```text
Error
 ↓
Error Middleware
 ↓
res.json()
 ↓
END
```

---

# Error Middleware Position

Error middleware should be registered after our routes.

In `app.js`:

```js
app.use(express.json());

app.use(logger);

app.use("/api", healthRouter);
app.use("/api/problems", problemRouter);

app.post("/api/test", (req, res) => {
  console.log(req.body);
  res.json(req.body);
});

app.use(errorMiddleware);
```

The error middleware is at the end.

---

# Why Error Middleware Comes Last?

Express processes middleware from top to bottom.

Normal request:

```text
logger
   ↓
route
   ↓
controller
   ↓
service
```

If an error occurs:

```text
service
   ↓
throw err
   ↓
controller
   ↓
next(err)
   ↓
errorMiddleware
```

So the error middleware is placed after the normal routes.

---

# HTTP Error Status Codes

Important status codes learned today:

```text
400 → Bad Request
401 → Unauthorized
403 → Forbidden
404 → Not Found
409 → Conflict
500 → Internal Server Error
```

## 400 — Bad Request

Used when the client sends invalid data.

Example:

```text
difficulty = "extreme"
```

when only:

```text
easy
medium
hard
```

are allowed.

---

## 409 — Conflict

Used when the request conflicts with an existing resource.

Example:

```text
Creating a user with an email
that already exists.
```

---

## 500 — Internal Server Error

Used for unexpected server-side errors.

Example:

```text
MongoDB connection/database error
```

---

# Important Correction

I initially thought a Mongoose validation error for an invalid difficulty should be `409`.

After revision, I learned that:

```text
Invalid input/data
→ 400 Bad Request
```

while:

```text
Conflict with an existing resource
→ 409 Conflict
```

---

# Complete Error Flow

For:

```http
POST /api/problems
```

the complete flow is:

```text
Client
   ↓
POST /api/problems
   ↓
Problem Route
   ↓
Problem Controller
   ↓
Problem Service
   ↓
Problem Model
   ↓
MongoDB
```

If MongoDB fails:

```text
MongoDB ❌
   ↓
Service catch(err)
   ↓
throw err
   ↓
Controller catch(err)
   ↓
next(err)
   ↓
Error Middleware
   ↓
500 Internal Server Error
   ↓
Client
```

---

# Testing

I deliberately created a database failure and tested the API.

The API returned:

```text
500
```

with:

```json
{
  "success": false,
  "message": "Internal Server Error"
}
```

This confirmed that our error-handling flow is working.

---

# 🧠 My Understanding

### Why do we use try...catch?

Because asynchronous operations like database operations can fail.

### Why do we use `throw err`?

Because the Service should not send the HTTP response. It passes the error to the next layer.

### Why do we use `next(err)`?

Because it tells Express that an error occurred and sends it to the error-handling middleware.

### Why does error middleware have 4 parameters?

```js
(err, req, res, next)
```

The first `err` parameter tells Express that this is an error-handling middleware.

### Why is error middleware last?

Because normal middleware and routes should execute first. When an error occurs, `next(err)` sends it to the error middleware.

---

# 📚 Controller vs Service vs Error Middleware

```text
Controller
→ HTTP request/response

Service
→ Business logic

Model
→ Database operations

Error Middleware
→ Centralized HTTP error response
```

---

# 🚀 Recall Architecture After Day 9

```text
Client
  ↓
Express
  ↓
Routes
  ↓
Controller
  ↓
Service
  ↓
Model
  ↓
MongoDB

If Error:
Model
  ↓
Service
  ↓
throw err
  ↓
Controller
  ↓
next(err)
  ↓
Error Middleware
  ↓
HTTP Response
```

---

# ✅ What I Practiced Today

* Created Service error handling using `try...catch`
* Used `throw err`
* Added error handling in Controller
* Used `next(err)`
* Created centralized error middleware
* Connected error middleware with `app.js`
* Placed error middleware after routes
* Tested a real server/database error
* Received `500 Internal Server Error`
* Learned difference between `400` and `409`

---

# 🎯 Day 9 Result

Before Day 9:

```text
Error
 ↓
undefined response / incorrect response
```

After Day 9:

```text
Error
 ↓
Service catch
 ↓
throw err
 ↓
Controller catch
 ↓
next(err)
 ↓
Error Middleware
 ↓
Proper HTTP response
```