# Day 14 — Zod Validation & Error Handling

## Objective

Today I improved the Recall Project request validation by replacing manual validation logic with Zod.

The main focus was understanding how Zod validates PATCH requests, handles validation errors, and sends clean error information to the client.

---

## Topics Covered

- Zod schema
- `z.object()`
- `z.number()`
- `z.string()`
- `.optional()`
- `.min()`
- `.max()`
- `.strict()`
- `.refine()`
- `safeParse()`
- `result.success`
- `result.data`
- `result.error`
- `result.error.issues`
- `issue.path`
- `issue.message`
- Mapping validation errors
- Custom API validation errors
- Error middleware
- Multiple validation errors
- PATCH request validation

---

## Key Concepts

### 1. Request Validation with Zod

Instead of manually checking every field, I created a Zod schema that defines what the API accepts.

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

### 2. `.strict()`

`.strict()` rejects unknown fields.

For example:

```json
{
  "userLearningInfo": {
    "confidence": 4,
    "randomField": "hello"
  }
}
```

`randomField` is not part of the schema, so the request is rejected.

### 3. `.refine()`

`.refine()` is used for custom validation conditions.

In our case:

```js
.refine((data) => Object.keys(data).length > 0)
```

It ensures that `userLearningInfo` is not an empty object.

### 4. `safeParse()`

I learned that `safeParse()` validates data and returns a result instead of directly throwing an error.

Successful validation:

```js
result.success === true
```

The validated data is available through:

```js
result.data
```

Failed validation:

```js
result.success === false
```

The validation details are available through:

```js
result.error
```

### 5. `result.error.issues`

When validation fails, Zod provides individual validation issues through:

```js
result.error.issues
```

Each issue can contain information such as:

- `path`
- `message`
- `code`
- validation-specific details

### 6. Mapping Zod Errors

Instead of returning raw Zod errors, I created a cleaner API error format:

```js
const errors = result.error.issues.map((issue) => ({
  field: issue.path.join("."),
  message: issue.message,
}));
```

This produces field-specific errors that are easier for the client to understand.

---

## Final Validation Middleware

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
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    const err = new Error("Validation failed");
    err.errors = errors;
    err.statusCode = 400;

    return next(err);
  }

  next();
};
```

---

## Request Validation Flow

```text
Client
  ↓
PATCH /api/problems/:id
  ↓
Route
  ↓
validateUpdateProblem
  ↓
safeParse(req.body)
  ↓
Valid? ─────────────── Invalid?
  ↓                         ↓
next()                  result.error
  ↓                         ↓
Controller              issues[]
                            ↓
                          map()
                            ↓
                         errors[]
                            ↓
                       next(err)
                            ↓
                     Error Middleware
                            ↓
                       400 Response
                            ↓
                          Client
```

---

## Testing

### Test 1 — Valid Request

```json
{
  "userLearningInfo": {
    "confidence": 4
  }
}
```

Result:

```text
Validation passed
Request reaches controller
```

### Test 2 — Confidence Out of Range

```json
{
  "userLearningInfo": {
    "confidence": 10
  }
}
```

Result:

```text
400 Bad Request
Validation failed
```

### Test 3 — Wrong Data Type

```json
{
  "userLearningInfo": {
    "whatILearned": 123
  }
}
```

Result:

```text
400 Bad Request
Validation failed
```

### Test 4 — Unknown Field

```json
{
  "userLearningInfo": {
    "confidence": 4,
    "randomField": "hello"
  }
}
```

Result:

```text
400 Bad Request
Validation failed
```

because `.strict()` rejects the unknown field.

### Test 5 — Multiple Validation Errors

Request:

```json
{
  "userLearningInfo": {
    "confidence": 10,
    "whatILearned": 123,
    "randomField": "hello"
  }
}
```

API response:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "userLearningInfo.confidence",
      "message": "Too big: expected number to be <=5"
    },
    {
      "field": "userLearningInfo.whatILearned",
      "message": "Invalid input: expected string, received number"
    },
    {
      "field": "userLearningInfo",
      "message": "Unrecognized key: \"randomField\""
    }
  ]
}
```

---

## Problem Solving / Approaches

### Before Zod

The validation contained multiple manual checks:

```text
Check empty body
↓
Check confidence exists
↓
Check confidence type
↓
Check confidence range
↓
Add more checks for every field
```

This becomes difficult to maintain when the number of fields and validation rules increases.

### After Zod

The validation rules are defined in one schema:

```text
Zod Schema
↓
safeParse()
↓
Validation result
↓
Clean error mapping
```

This makes validation more structured and maintainable.

---

## Interview Round

### Questions Practiced

1. Complete Recall PATCH request flow.
2. Difference between `req.params`, `req.body`, and `req.query`.
3. Why validate MongoDB ObjectId.
4. Difference between 400, 404, and 500.
5. Why use `$set` with dot notation.
6. What is optional chaining.
7. Difference between `.strict()` and `.refine()`.
8. What does `safeParse()` return?
9. Where does Zod store validation errors?
10. How do we transform Zod errors into clean API errors?
11. What happens when multiple validation rules fail?
12. Complete Zod validation → error middleware → client flow.

### Interview Performance

**Technical Understanding: 8.6/10**

**Communication: 8.1/10**

**Interview Readiness: 8.3/10**

### Communication Improvement

Current focus:

```text
Think
↓
Organize
↓
Answer
↓
Stop
```

Preferred interview structure:

```text
Definition
↓
Why
↓
Recall Project Example
```

Main improvement areas:

- Avoid repeating the same point.
- Avoid using "go to" repeatedly.
- Use precise technical verbs.
- Give the complete flow instead of skipping steps.
- If unsure, say that clearly instead of guessing.

---

## Mistakes to Carry Forward

1. Do not confuse validation with optional chaining.
2. Remember that `safeParse()` returns a result object.
3. Remember that `result.error.issues` contains individual Zod validation issues.
4. Remember that `.strict()` handles unknown fields.
5. Remember that `.refine()` handles custom validation conditions.
6. Do not expose unnecessary internal library error details to API clients.
7. Continue practicing complete request-flow explanations.

---

## Communication Improvement

Today's main communication focus was concise and structured technical answers.

Instead of explaining every related detail, use:

```text
Definition
↓
Reason
↓
Example
```

Example:

> The validator checks the request body against the Zod schema. If validation succeeds, it calls `next()` and the request reaches the controller. If validation fails, it forwards a 400 error to the error middleware.

---

## Learning Pattern

Today's learning pattern:

```text
Understand
↓
Implement
↓
Test
↓
Observe errors
↓
Fix
↓
Explain in interview
```

The cumulative interview showed that I understand the concepts but need repeated retrieval to explain them smoothly under interview pressure.

---

## Cumulative Interview Rule

From now on, every day includes a cumulative interview covering concepts from:

```text
Day 1 → Current Day
```

The interview should follow the communication rules:

- Answer directly.
- Give a clear definition.
- Explain why.
- Give a Recall Project example when relevant.
- Avoid unnecessary details.
- Do not guess when unsure.
- Correct the answer after feedback.
- Practice speaking in structured sentences.

---

## Day Status

- [x] Zod schema created
- [x] Manual validation replaced with Zod
- [x] `.strict()` implemented
- [x] `.refine()` implemented
- [x] `safeParse()` implemented
- [x] Zod validation errors understood
- [x] Multiple validation errors tested
- [x] Zod errors mapped to clean API errors
- [x] Error middleware tested
- [x] Valid request tested
- [x] Invalid confidence tested
- [x] Invalid data type tested
- [x] Unknown field tested
- [x] Multiple errors tested
- [x] Cumulative interview completed
- [x] Communication feedback completed

---

## Day Status

**Day 14 — COMPLETED ✅**

### Git Commit

```bash
git add .
git commit -m "feat: improve zod validation errors"
git push
```
