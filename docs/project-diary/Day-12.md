# Day 12 — PATCH Request Validation

## 🎯 Goal

Today I worked on:

- Understand request validation
- Differentiate request validation from Mongoose validation
- Identify existing schema validations
- Decide what the API should reject before reaching the service
- Create a PATCH request validator
- Connect the validator to the PATCH route
- Test validation errors through Postman
- Understand `return next(err)` middleware flow

---

## 📚 Concepts Learned

### 1. Request Validation

Request validation checks whether incoming client data follows the API's expected rules before the request reaches the controller/service.

For PATCH:

```http
PATCH /api/problems/:id
```

The validation layer checks `req.body` before the controller runs.

---

### 2. Request Validation vs Mongoose Validation

Both layers validate data, but they have different responsibilities.

**Request validation:**

- Validates API-specific input rules
- Rejects invalid input early
- Prevents unnecessary controller/service/database work
- Gives clear `400 Bad Request` responses

**Mongoose validation:**

- Protects the database/model schema
- Checks schema rules such as type, required, min, max, enum, etc.
- Acts as a second layer of protection

Flow:

```text
Client Request
      ↓
Request Validation
      ↓
Controller
      ↓
Service
      ↓
Mongoose Validation
      ↓
MongoDB
```

---

## 🔍 Existing Schema Validation

The problem schema already contains validations such as:

- `problemName` → String + required
- `problemUrl` → String
- `platform` → String
- `difficulty` → enum
- `whatILearned` → required / length constraint
- `whatIStruggledWith` → required / length constraint
- `confidence` → Number + required + min/max
- `firstSolvedAt` → required + Date
- `lastSolvedAt` → required + Date

---

## 🧠 Why Request Validation Is Still Needed

Mongoose can check that:

```text
confidence = 10
```

is outside the allowed range.

But request validation can reject it **before the request reaches the service and database layer**.

It can also enforce API-specific rules such as:

```text
{}                         → reject
userLearningInfo: {}       → reject
confidence: 10             → reject
```

This gives faster and clearer API-level error handling.

---

## 🛡️ PATCH Validation Rules

For our current PATCH API:

### Empty body

```json
{}
```

❌ Reject with `400 Bad Request`

### Empty user learning info

```json
{
  "userLearningInfo": {}
}
```

❌ Reject with `400 Bad Request`

### Missing confidence

```json
{
  "userLearningInfo": {}
}
```

❌ Reject with `400 Bad Request`

### Confidence outside range

```json
{
  "userLearningInfo": {
    "confidence": 10
  }
}
```

❌ Reject with `400 Bad Request`

### Valid confidence

```json
{
  "userLearningInfo": {
    "confidence": 4
  }
}
```

✅ Continue to controller

---

## 🔧 Request Validator

Created:

```js
export const validateUpdateProblem = (req, res, next) => {
  const data = req.body;

  if (Object.keys(data).length === 0) {
    const err = new Error("Provide update data");
    err.statusCode = 400;
    return next(err);
  }

  if (data?.userLearningInfo?.confidence === undefined) {
    const err = new Error("Confidence is required");
    err.statusCode = 400;
    return next(err);
  }

  const { confidence } = data.userLearningInfo;

  if (confidence < 0 || confidence > 5) {
    const err = new Error("Confidence must be between 0 and 5");
    err.statusCode = 400;
    return next(err);
  }

  next();
};
```

---

## 🧩 Why `return next(err)`?

Instead of:

```js
next(err);
```

we use:

```js
return next(err);
```

`return` immediately stops the current middleware function.

This prevents the middleware from continuing after an error.

Flow:

```text
Validation fails
      ↓
return next(err)
      ↓
Error Middleware
      ↓
400 Bad Request
```

If validation succeeds:

```js
next();
```

the request continues to the controller.

---

## 🏗️ PATCH Request Flow

After adding request validation:

```text
PATCH /api/problems/:id
          ↓
        Route
          ↓
validateUpdateProblem
          ↓
       Valid?
       ↙    ↘
     No      Yes
     ↓        ↓
 next(err) Controller
     ↓        ↓
Error       Service
Middleware    ↓
     ↓      Model
   400        ↓
           MongoDB
```

---

## 🔗 Route Integration

Updated PATCH route:

```js
router.patch(
  "/:id",
  validateUpdateProblem,
  updateProblemController
);
```

Middleware order is important:

```text
Route
 ↓
Validator
 ↓
Controller
 ↓
Service
 ↓
Database
```

Invalid requests never reach the controller/service.

---

## 🧪 Postman Testing

### Test 1 — Empty Body

Request:

```json
{}
```

Response:

```text
400 Bad Request
```

Message:

```text
Provide update data
```

✅ Passed

---

### Test 2 — Empty `userLearningInfo`

Request:

```json
{
  "userLearningInfo": {}
}
```

Response:

```text
400 Bad Request
```

Message:

```text
Confidence is required
```

✅ Passed

---

### Test 3 — Invalid Confidence

Request:

```json
{
  "userLearningInfo": {
    "confidence": 10
  }
}
```

Response:

```text
400 Bad Request
```

Message:

```text
Confidence must be between 0 and 5
```

✅ Passed

---

### Test 4 — Valid Confidence

Request:

```json
{
  "userLearningInfo": {
    "confidence": 4
  }
}
```

Response:

```text
200 OK
```

Message:

```text
update successfully
```

The updated problem was returned successfully.

✅ Passed

---

## ❌ Error Flow

When validation fails:

```text
Client
  ↓
PATCH Request
  ↓
Request Validator
  ↓
Validation Error
  ↓
return next(err)
  ↓
Error Middleware
  ↓
400 Bad Request
```

The controller and service are skipped.

---

## 📝 Key Learnings

1. Request validation protects the API boundary.
2. Mongoose validation protects the model/database layer.
3. Both layers can validate data, but they serve different purposes.
4. Invalid API input should be rejected as early as possible.
5. `req.body` contains PATCH update data.
6. `Object.keys(data).length` can detect an empty request body.
7. Optional chaining safely accesses nested properties.
8. `return next(err)` stops the current middleware and forwards the error.
9. `next()` allows a valid request to continue.
10. Middleware order determines the request flow.
11. Invalid PATCH requests should not reach the service.
12. `400 Bad Request` is appropriate for invalid client input.
13. Valid PATCH data continues to the controller and service.
14. Postman can verify both successful and rejected API requests.

---

## ⚠️ Mistakes & Debugging

### Mistake 1 — Incorrect `statusCode` assignment

Incorrect:

```js
err.statusCode(400);
```

Correct:

```js
err.statusCode = 400;
```

---

### Mistake 2 — Continuing after an error

Instead of:

```js
next(err);
```

used:

```js
return next(err);
```

This immediately stops the current middleware.

---

### Mistake 3 — Property name consistency

Nested property must be referenced consistently:

```js
data.userLearningInfo
```

not:

```js
data.userlearningInfo
```

---

## 🔄 Day 12 Architecture

```text
Client
  ↓
PATCH /api/problems/:id
  ↓
Route
  ↓
validateUpdateProblem
  ↓
Controller
  ↓
Service
  ↓
findByIdAndUpdate()
  ↓
Mongoose
  ↓
MongoDB
  ↓
Response
```

---

## ✅ Day 12 Status

- [x] Understand request validation
- [x] Compare request validation vs Mongoose validation
- [x] Review existing schema validations
- [x] Define PATCH validation rules
- [x] Create `validateUpdateProblem`
- [x] Understand `return next(err)`
- [x] Connect validator to PATCH route
- [x] Test empty body
- [x] Test empty `userLearningInfo`
- [x] Test invalid confidence
- [x] Test valid confidence
- [x] Verify `400` error responses
- [x] Verify `200` success response
- [x] Confirm invalid requests stop before service

**Day 12 = DONE ✅**
