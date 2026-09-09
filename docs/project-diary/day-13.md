# Day 13 — Request Validation with Zod

## 🎯 Goal

Today I worked on:

- Understand request validation vs Mongoose validation
- Understand why both validation layers are required
- Identify problems with manual validation
- Install and use Zod
- Create a Zod schema for PATCH requests
- Understand `z.object()`
- Understand nested Zod objects
- Understand `.optional()`
- Understand `.min()` and `.max()`
- Understand `.strict()`
- Understand `.refine()`
- Understand `safeParse()`
- Connect Zod with Express middleware
- Test request validation using Postman
- Refactor validation schema outside middleware

---

## 📚 Concepts Learned

### 1. Request Validation vs Mongoose Validation

Request validation checks whether incoming client data follows the API contract before reaching the controller.

Mongoose validation protects the model/data layer before data is stored or updated in the database.

### Request Validation

```text
Client
  ↓
Request Validation
  ↓
Controller
  ↓
Service
```

### Mongoose Validation

```text
Service
  ↓
Mongoose Model
  ↓
Mongoose Validation
  ↓
MongoDB
```

We need both because they protect different layers of the application.

---

### 2. Why Manual Validation Does Not Scale

Initially, validation was written using multiple `if` conditions:

```js
if (...) {
  ...
}

if (...) {
  ...
}

if (...) {
  ...
}
```

As the number of fields and validation rules increases, this creates:

- Repeated code
- More conditions
- Difficult maintenance
- Less readable validation logic

This is why we introduced Zod.

---

## 🔧 Zod

Installed Zod in the backend:

```bash
npm install zod
```

Zod allows us to define the expected structure and validation rules using a schema.

---

### 3. `z.object()`

Basic Zod structure:

```js
const schema = z.object({
  confidence: z.number()
});
```

This means the input must be an object containing a `confidence` field.

---

### 4. Nested Objects

Our request contains:

```json
{
  "userLearningInfo": {
    "confidence": 4
  }
}
```

Therefore we use a nested object:

```js
const updateProblemSchema = z.object({
  userLearningInfo: z.object({
    confidence: z.number()
  })
});
```

---

### 5. Optional Fields

PATCH requests are partial updates.

Therefore individual fields should not necessarily be required.

Example:

```js
confidence: z.number().optional()
```

This means:

```text
confidence provided
      ↓
must be a number

confidence not provided
      ↓
allowed
```

---

### 6. Range Validation

Confidence should be between `0` and `5`.

```js
confidence: z.number().min(0).max(5).optional()
```

Examples:

```text
0 → valid
3 → valid
5 → valid
10 → invalid
-1 → invalid
```

---

### 7. `.strict()`

We don't want clients to send unknown fields.

Example:

```json
{
  "userLearningInfo": {
    "confidence": 4,
    "randomField": "hello"
  }
}
```

Using:

```js
.strict()
```

rejects `randomField` because it is not part of our schema.

Allowed fields:

```text
confidence
whatILearned
whatIStruggledWith
mistake
```

---

### 8. `.refine()`

`.refine()` allows us to add custom validation rules.

For our PATCH request:

```js
.refine((data) => Object.keys(data).length > 0)
```

This ensures that `userLearningInfo` contains at least one field.

Therefore:

```json
{
  "userLearningInfo": {}
}
```

is rejected.

While:

```json
{
  "userLearningInfo": {
    "confidence": 4
  }
}
```

is accepted.

---

## 🧠 Complete Zod Schema

Our current schema:

```js
const updateProblemSchema = z.object({
  userLearningInfo: z
    .object({
      confidence: z.number().min(0).max(5).optional(),
      whatILearned: z.string().optional(),
      whatIStruggledWith: z.string().optional(),
      mistake: z.string().optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0),
});
```

---

## 🔍 `safeParse()`

Zod schemas do not validate data just by being created.

We use:

```js
const result = updateProblemSchema.safeParse(req.body);
```

`safeParse()` returns a result containing:

```text
success: true
```

or:

```text
success: false
```

This allows us to handle validation without directly throwing a Zod exception.

---

## 🏗️ Validation Middleware

Our middleware:

```js
export const validateUpdateProblem = (req, res, next) => {
  const result = updateProblemSchema.safeParse(req.body);

  if (!result.success) {
    const err = new Error("Invalid request data");
    err.statusCode = 400;

    return next(err);
  }

  next();
};
```

---

## 🔄 Request Flow

```text
PATCH /api/problems/:id
        ↓
      Route
        ↓
validateUpdateProblem
        ↓
    safeParse()
        ↓
   ┌────┴────┐
   ↓         ↓
Invalid    Valid
   ↓         ↓
400       next()
   ↓         ↓
Error    Controller
Middleware    ↓
           Service
              ↓
           Mongoose
              ↓
           MongoDB
```

---

## 🧪 Testing

### Test 1 — Valid confidence

```json
{
  "userLearningInfo": {
    "confidence": 4
  }
}
```

✅ Passed

---

### Test 2 — Confidence out of range

```json
{
  "userLearningInfo": {
    "confidence": 10
  }
}
```

✅ Correctly rejected with `400 Bad Request`

---

### Test 3 — Unknown field

```json
{
  "userLearningInfo": {
    "confidence": 4,
    "randomField": "hello"
  }
}
```

✅ Correctly rejected with `400 Bad Request`

---

### Test 4 — Empty update

```json
{
  "userLearningInfo": {}
}
```

✅ Correctly rejected with `400 Bad Request`

---

## 💻 Code Practiced

### `problem.validator.js`

```js
import { z } from "zod";

const updateProblemSchema = z.object({
  userLearningInfo: z
    .object({
      confidence: z.number().min(0).max(5).optional(),
      whatILearned: z.string().optional(),
      whatIStruggledWith: z.string().optional(),
      mistake: z.string().optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0),
});

export const validateUpdateProblem = (req, res, next) => {
  const result = updateProblemSchema.safeParse(req.body);

  if (!result.success) {
    const err = new Error("Invalid request data");
    err.statusCode = 400;

    return next(err);
  }

  next();
};
```

---

## 📝 Key Learnings

1. Request validation protects the API boundary.
2. Mongoose validation protects the model/data layer.
3. Both validation layers are useful.
4. Manual `if`-based validation becomes difficult to maintain.
5. Zod provides schema-based validation.
6. `z.object()` defines an object schema.
7. Nested `z.object()` handles nested request data.
8. `.optional()` is useful for PATCH fields.
9. `.min()` and `.max()` validate numeric ranges.
10. `.strict()` rejects unknown fields.
11. `.refine()` adds custom validation rules.
12. `safeParse()` validates actual input data.
13. Invalid Zod validation should stop the request before the controller.
14. `return next(err)` immediately transfers control to error middleware.
15. PATCH should allow partial updates.
16. PATCH should not allow an empty update.
17. Validation schema should be defined outside the middleware.

---

## ⚠️ Mistakes & Debugging

### Mistake 1 — Incorrect `statusCode` usage

Initially:

```js
err.statusCode(400);
```

This treats `statusCode` like a function.

Correct:

```js
err.statusCode = 400;
```

---

### Mistake 2 — Understanding `.refine()`

Initially tried:

```js
if (updateProblemSchema.refine(...)) {
  ...
}
```

Learned that `.refine()` creates a new Zod schema.

It does not directly return a boolean validation result.

Actual validation is performed using:

```js
schema.safeParse(data);
```

---

### Mistake 3 — Refining the wrong level

The empty-object rule applies to:

```text
userLearningInfo
```

not the complete request object.

Therefore `.refine()` belongs on the nested `userLearningInfo` schema.

---

### Mistake 4 — Schema defined inside middleware

Initially the Zod schema was created inside:

```js
validateUpdateProblem
```

Refactored it outside the middleware so the schema is defined once and the middleware only performs validation.

---

## 💬 Communication Improvement

Today I practiced explaining:

- Difference between request validation and Mongoose validation
- Why both layers are required
- Why manual validation does not scale
- What `.strict()` does
- What `.refine()` does
- What `safeParse()` does
- Why PATCH requires partial validation

### Communication Focus

Instead of over-explaining, structure technical answers as:

```text
Definition
    ↓
Why
    ↓
Example
```

Example:

> Request validation checks incoming data before it reaches the controller. Mongoose validation checks data against the model schema before database operations. We use both because they protect different layers.

---

## 🧠 Learning Pattern

Today I identified a real limitation in the project instead of blindly adding code:

```text
Manual Validation
       ↓
Repeated if conditions
       ↓
Scalability problem
       ↓
Why Zod?
       ↓
Schema-based validation
```

This helped me understand why Zod is being introduced instead of just learning its syntax.

---

## 🎤 Interview Round

### Q1. Why do we need both request validation and Mongoose validation?

**Answer:**

Request validation checks whether incoming client data follows the API contract before reaching the application logic. Mongoose validation protects the model/data layer before persistence. Both provide protection at different layers.

**Status:** ✅ Good understanding

---

### Q2. What does `.strict()` do in Zod?

**Answer:**

`.strict()` rejects unknown fields that are not defined in the Zod object schema.

**Status:** ✅ Correct

---

### Q3. What does `.refine()` do?

**Answer:**

`.refine()` allows us to add custom validation conditions that are not covered by basic Zod rules.

**Status:** ✅ Correct

---

### Q4. What is `safeParse()`?

**Answer:**

`safeParse()` validates input against a Zod schema and returns a result containing either success or failure instead of directly throwing an exception.

**Status:** ✅ Good

---

### Q5. Why should PATCH allow optional fields?

**Answer:**

PATCH is used for partial updates, so the client should be able to update only the fields it needs to change.

**Status:** ✅ Correct

---

## 📈 Day 13 Progress

```text
Request Validation
        ↓
Manual Validation
        ↓
Problems Identified
        ↓
Zod Introduced
        ↓
Schema Created
        ↓
Strict Validation
        ↓
Custom Refinement
        ↓
safeParse()
        ↓
Express Middleware
        ↓
Postman Testing
        ↓
Working ✅
```

---

## ⚠️ Mistakes to Carry Forward

- Don't confuse a schema with actual validation.
- `.refine()` returns a schema; it doesn't directly validate data.
- Use `safeParse()` to validate actual input.
- JavaScript property names are case-sensitive.
- Don't write unnecessary manual validation when a schema validation library can handle it.
- Keep validation logic separate from controller and service logic.
- Use `return next(err)` when forwarding an error from middleware.

---

## ✅ Day 13 Status

- [x] Understand request validation
- [x] Understand Mongoose validation
- [x] Understand why both are needed
- [x] Identify manual validation limitations
- [x] Install Zod
- [x] Create Zod schema
- [x] Nested object validation
- [x] Number validation
- [x] Range validation
- [x] Optional fields
- [x] Strict validation
- [x] Custom refinement
- [x] `safeParse()`
- [x] Express validation middleware
- [x] Postman testing
- [x] Refactor schema outside middleware

**Day 13 — Completed ✅**