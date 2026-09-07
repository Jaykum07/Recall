# Day 11 — CRUD Completion: Validation, DELETE & Error Handling

## 🎯 Today's Goal

Implement and understand:

- Complete CRUD API flow
- PUT vs PATCH
- Partial nested updates using `$set`
- Mongoose update validation with `runValidators: true`
- `new: true`
- DELETE a problem by ID
- Handle DELETE edge cases
- Understand `400 Bad Request`, `404 Not Found`, and `500 Internal Server Error`
- Understand `throw err` vs `next(err)`
- Understand optional chaining `?.`
- Test APIs with Postman
- Maintain Controller → Service → Model → Error Middleware architecture

---

## 1. PUT vs PATCH

### PUT

Generally used to replace/update the complete resource.

### PATCH

Used to update only part of a resource.

For our Recall API, PATCH is useful when changing only one field such as:

```json
{
  "userLearningInfo": {
    "confidence": 5
  }
}
```

---

## 2. `$set` and Dot Notation

Directly passing a nested object can replace the nested object.

For a partial update, we use:

```js
{
  $set: {
    "userLearningInfo.confidence": confidence
  }
}
```

Dot notation:

```text
userLearningInfo.confidence
        ↓
userLearningInfo
        ↓
confidence
```

Only `confidence` changes.

Other fields inside `userLearningInfo` remain preserved.

---

## 3. `runValidators: true`

`findByIdAndUpdate()` does not run Mongoose schema validators for updates by default.

We use:

```js
{
  new: true,
  runValidators: true
}
```

This makes update operations respect schema validation such as:

```js
confidence: {
  type: Number,
  min: 0,
  max: 5
}
```

Example:

```text
confidence = 10
      ↓
Schema max = 5
      ↓
Mongoose ValidationError
      ↓
400 Bad Request
```

---

## 4. `new: true`

With:

```js
Problem.findByIdAndUpdate(
  id,
  updateData,
  { new: true }
);
```

`new: true` makes Mongoose return the **updated document** instead of the old document.

---

## 5. ObjectId Validation

Before database operations using an ID:

```js
mongoose.Types.ObjectId.isValid(id)
```

We validate the ID first.

Example:

```js
if (!mongoose.Types.ObjectId.isValid(id)) {
  const error = new Error("Bad Request");
  error.statusCode = 400;
  throw error;
}
```

Invalid ID:

```text
/api/problems/123
        ↓
Invalid ObjectId
        ↓
400 Bad Request
```

Valid ObjectId but no matching document:

```text
Valid ObjectId
        ↓
Problem doesn't exist
        ↓
404 Not Found
```

---

## 6. DELETE — Delete Problem

Endpoint:

```http
DELETE /api/problems/:id
```

The ID comes from:

```js
req.params.id
```

The service uses:

```js
const data = await Problem.findByIdAndDelete(id);
```

If the problem doesn't exist:

```js
if (!data) {
  const error = new Error("Problem not found.");
  error.statusCode = 404;

  throw error;
}
```

---

## 7. Current DELETE Service Logic

```js
export const deleteProblemService = async (id) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("Bad Request");
      error.statusCode = 400;

      throw error;
    }

    const data = await Problem.findByIdAndDelete(id);

    if (!data) {
      const error = new Error("Problem not found.");
      error.statusCode = 404;

      throw error;
    }

    return data;
  } catch (err) {
    throw err;
  }
};
```

---

## 8. DELETE Controller

```js
export const deleteProblemController = async (req, res, next) => {
  try {
    const data = await deleteProblemService(req.params.id);

    res.status(200).json({
      success: true,
      message: "problem deleted",
      data,
    });
  } catch (err) {
    next(err);
  }
};
```

Important:

The controller must be `async` because the service is asynchronous.

We use:

```js
await deleteProblemService(...)
```

so that `data` contains the actual result instead of a Promise.

---

## 9. DELETE Edge Case — Same Problem Twice

First request:

```text
DELETE existing problem
        ↓
Problem exists
        ↓
Delete succeeds
        ↓
200 OK
```

Second request with the same ID:

```text
DELETE same problem
        ↓
Problem no longer exists
        ↓
findByIdAndDelete() → null
        ↓
throw 404 error
        ↓
404 Not Found
```

Therefore:

```text
First DELETE  → 200 OK
Second DELETE → 404 Not Found
```

This verifies that the API correctly handles a resource that has already been deleted.

---

## 10. HTTP Status Codes

### 400 — Bad Request

The client's request is invalid.

Examples:

```text
Invalid ObjectId
Invalid update data
Invalid confidence value
```

### 404 — Not Found

The request is valid, but the requested resource doesn't exist.

Example:

```text
Valid ObjectId
      ↓
No matching Problem document
      ↓
404
```

### 500 — Internal Server Error

An unexpected server-side error occurs while processing the request.

Example:

```text
Unexpected database/server failure
      ↓
500
```

---

## 11. `throw err` vs `next(err)`

Service:

```js
throw err;
```

The service throws the error.

Controller:

```js
catch (err) {
  next(err);
}
```

The controller passes the error to Express error middleware.

Flow:

```text
Service
   ↓
throw err
   ↓
Controller catch
   ↓
next(err)
   ↓
Error Middleware
   ↓
HTTP Response
```

---

## 12. Error Middleware

Express recognizes error-handling middleware through four parameters:

```js
(err, req, res, next)
```

Our middleware:

```js
export const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    message,
  });
};
```

The middleware is registered after the routes.

---

## 13. Optional Chaining `?.`

We used:

```js
data.userLearningInfo?.confidence
```

`?.` is optional chaining.

It safely checks whether `userLearningInfo` exists before accessing `confidence`.

Without optional chaining:

```js
data.userLearningInfo.confidence
```

If `userLearningInfo` is `undefined`, JavaScript can throw an error.

Memory trick:

```text
.   → I expect it to exist
?.  → It might not exist, check safely
```

---

## 14. Complete PATCH Flow

```text
PATCH /api/problems/:id
          ↓
        Route
          ↓
      Controller
          ↓
req.params.id + req.body
          ↓
        Service
          ↓
   ObjectId validation
          ↓
      $set update
          ↓
findByIdAndUpdate()
          ↓
runValidators
          ↓
       MongoDB
          ↓
   Updated document
          ↓
      Controller
          ↓
       200 OK
```

Error flow:

```text
Service Error
      ↓
throw err
      ↓
Controller catch
      ↓
next(err)
      ↓
Error Middleware
      ↓
400 / 404 / 500
```

---

## 15. Complete DELETE Flow

```text
DELETE /api/problems/:id
          ↓
        Route
          ↓
      Controller
          ↓
        Service
          ↓
   ObjectId validation
          ↓
findByIdAndDelete()
          ↓
       MongoDB
          ↓
    Document / null
          ↓
      Controller
          ↓
     HTTP Response
```

Error cases:

```text
Invalid ObjectId
      ↓
400 Bad Request

Valid ObjectId + no document
      ↓
404 Not Found

Unexpected server/database error
      ↓
500 Internal Server Error
```

---

## 16. Postman Testing Completed

- [x] POST problem → `201 Created`
- [x] GET all problems → `200 OK`
- [x] GET problem by ID → `200 OK`
- [x] GET invalid ObjectId → `400 Bad Request`
- [x] GET valid but non-existing ID → `404 Not Found`
- [x] PATCH confidence → `200 OK`
- [x] PATCH preserves other nested fields → tested
- [x] PATCH invalid confidence → `400 Bad Request`
- [x] PATCH empty body → `400 Bad Request`
- [x] DELETE existing problem → `200 OK`
- [x] DELETE same problem again → `404 Not Found`

---

## 🧠 Key Lessons

1. PUT generally updates/replaces the complete resource.
2. PATCH updates only part of a resource.
3. `req.params.id` gives the ID from the URL.
4. `req.body` gives request/update data.
5. `findById()` retrieves one document.
6. `findByIdAndUpdate()` updates one document.
7. `findByIdAndDelete()` deletes one document.
8. `new: true` returns the updated document.
9. `runValidators: true` enables Mongoose validation during updates.
10. `ObjectId.isValid()` checks whether an ID has a valid MongoDB ObjectId format.
11. `400` means the request/input is invalid.
12. `404` means the requested resource does not exist.
13. `500` means an unexpected server-side error occurred.
14. `$set` is useful for partial updates.
15. Dot notation updates a specific nested field.
16. `?.` safely accesses potentially missing nested data.
17. Services handle business/data logic.
18. Controllers handle HTTP request/response.
19. Error middleware sends the final error response.
20. `throw err` passes an error upward; `next(err)` forwards it to Express error middleware.

---

## 🔥 Final Architecture

```text
                    CLIENT
                      ↓
                HTTP Request
                      ↓
                    Route
                      ↓
                 Controller
                      ↓
                   Service
                      ↓
              Business Logic
                      ↓
                   Model
                      ↓
             Mongoose / MongoDB
                      ↓
                Database Result
                      ↓
                   Service
                      ↓
                 Controller
                      ↓
               HTTP Response
```

### Error Architecture

```text
Service Error
      ↓
throw err
      ↓
Controller catch
      ↓
next(err)
      ↓
Error Middleware
      ↓
400 / 404 / 500
```

