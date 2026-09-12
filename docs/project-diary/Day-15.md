# 🚀 Day 15 — Filtering Problems

## Objective

Build and understand the Recall Problems filtering API using `req.query`, Zod query validation, dynamic MongoDB filters, and multiple filter combinations.

## Topics Covered

- `req.query`, `req.params`, and `req.body`
- Filtering by difficulty, platform, and tags
- Dynamic MongoDB filter construction
- Empty filter `{}` → all problems
- Multiple filters with AND logic
- Filtering array fields
- MongoDB `$in`
- Zod query validation
- `.strict()`, `.enum()`, `.optional()`
- `safeParse()` and `result.data`
- `req.validatedQuery`
- Validation → controller → service separation
- Postman testing
- Cumulative interview practice from Day 1–15

## Key Concepts

### Dynamic Filter

```js
const filter = {};

if (difficulty !== undefined) {
  filter["problemInfo.difficulty"] = difficulty;
}

if (tags !== undefined) {
  const tagList = tags.split(",");
  filter["problemInfo.tags"] = { $in: tagList };
}

if (platform !== undefined) {
  filter["problemInfo.platform"] = platform;
}

const problemsData = await Problem.find(filter);
```

### Empty Filter

```http
GET /api/problems
```

produces:

```js
{}
```

Therefore:

```js
Problem.find({})
```

returns all problems.

### Multiple Filters

```http
GET /api/problems?difficulty=easy&platform=leetcode
```

means:

```text
difficulty = easy
AND
platform = leetcode
```

Only problems satisfying both conditions are returned.

### Tags + `$in`

For:

```http
GET /api/problems?tags=string,stack
```

the query value is initially the string:

```js
"string,stack"
```

We transform it:

```js
tags.split(",")
```

into:

```js
["string", "stack"]
```

and use:

```js
{
  "problemInfo.tags": {
    $in: ["string", "stack"]
  }
}
```

`$in` means **ANY of the requested values can match**.

## Query Validation

Our Zod schema:

```js
const problemFilterSchema = z
  .object({
    difficulty: z
      .enum(["easy", "medium", "hard"])
      .optional(),

    tags: z.string().optional(),

    platform: z
      .enum(["leetcode", "gfg", "codechef", "codeforces", "other"])
      .optional(),
  })
  .strict();
```

- `.enum()` restricts values to allowed options.
- `.optional()` means the parameter does not have to be provided.
- `.strict()` rejects unknown query fields.

Example:

```http
GET /api/problems?difficulty=banana
```

→ `400 Bad Request`.

## `safeParse()`

```js
const result = problemFilterSchema.safeParse(req.query);
```

Success:

```js
{
  success: true,
  data: {...}
}
```

Failure:

```js
{
  success: false,
  error: {...}
}
```

We pass:

```js
result.data
```

because it contains data that passed validation.

## Validated Query Flow

```text
Client
  ↓
req.query
  ↓
Zod validation
  ↓
❌ invalid → 400 → Error Middleware
  ↓
✅ result.data
  ↓
req.validatedQuery
  ↓
Controller
  ↓
Service
  ↓
Dynamic MongoDB Filter
  ↓
Problem.find(filter)
  ↓
MongoDB
  ↓
Controller
  ↓
Client
```

## Problem Solving / Approaches

### Multiple filters

Instead of separate database requests, one dynamic filter object is built and passed to one `Problem.find(filter)` query.

### Unknown query parameters

The service explicitly accepts only:

```text
difficulty
tags
platform
```

and the Zod `.strict()` schema rejects unknown parameters before the service.

### Validation vs service responsibility

```text
Validation
= Is the input allowed?

Service
= What should we do with valid input?
```

## Interview Round

### Q1 — Complete PATCH flow
**Score: 9/10**

Client → route → Zod request validation → controller → service → ObjectId validation → `$set` + dot notation → `findByIdAndUpdate` → controller → client.

### Q2 — Filtering flow
**Score: 9/10**

Zod validates `req.query`, validated data is stored in `req.validatedQuery`, controller passes it to the service, service builds the MongoDB filter, and `Problem.find(filter)` retrieves matching problems.

### Q3 — `.strict()` vs `.refine()`
**Score: 9/10**

`.strict()` rejects unknown fields. `.refine()` adds custom validation conditions, such as ensuring an update object contains at least one field.

### Q4 — `runValidators: true`
**Score: 9.5/10**

Zod protects the API boundary while Mongoose validation provides another protection layer during database updates.

### Q5 — `req.params` vs `req.query`
**Score: 8.5/10**

`req.params` identifies a specific resource; `req.query` provides optional retrieval criteria such as filtering, searching, sorting, or pagination.

### Q6 — 400 vs 404 vs 500
**Score: 9/10**

- `400` → invalid client request
- `404` → valid request but resource doesn't exist
- `500` → unexpected server-side error

### Q7 — `$set` + dot notation
**Score: 9.5/10**

`$set` with dot notation updates only the required nested field and preserves the other fields in the nested object.

## Mistakes to Carry Forward

1. Use precise technical verbs instead of vague phrases such as "perform operation" or "send data".
2. `req.query` is raw client input.
3. `req.validatedQuery` is validated input.
4. `.strict()` restricts the object to defined fields.
5. `.refine()` adds custom validation logic.
6. `$in` means ANY matching value.
7. Different MongoDB filter fields work together with AND logic.
8. `tags=string,stack` arrives as a string and must be transformed for multiple-tag filtering.

## Communication Improvement

### Instead of:
> "Service checks data and appropriate create object."

### Say:
> "The service checks which filters are provided and dynamically builds the MongoDB filter object."

### Instead of:
> "If otherwise return to controller."

### Say:
> "If validation succeeds, the request proceeds to the controller."

### Focus

Use precise technical verbs:

```text
validate
extract
construct
transform
query
retrieve
update
return
forward
reject
```

## Learning Pattern

```text
Concept
  ↓
Write code
  ↓
Understand behavior
  ↓
Test with Postman
  ↓
Interview explanation
  ↓
Correction
  ↓
Retry
```

## Day Status

### ✅ DAY 15 — COMPLETED

**Technical Understanding:** 9/10  
**Backend Understanding:** 9/10  
**Problem Solving:** 9/10  
**Communication:** 8.5/10  
**Interview Performance:** 9/10

### Cumulative Interview Test

**7/7 questions completed ✅**

### Main Achievement

Built and tested the Recall filtering foundation:

```text
req.query
   ↓
Zod validation
   ↓
validatedQuery
   ↓
Controller
   ↓
Service
   ↓
Dynamic MongoDB filter
   ↓
Problem.find()
```

## Next

**Day 16 — Search Problems**

Focus:

```text
Search by problem name
```
