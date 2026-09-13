# Day 16 — Search Problems

## Objective
Implement search functionality in the Problems API so clients can search problems by problem name using `req.query`, Zod validation, and MongoDB `$regex`.

## Topics Covered
- `req.query` for search parameters
- Search by problem name
- Zod validation with `z.string().optional()`
- MongoDB `$regex`
- Case-insensitive search with `$options: "i"`
- Combining search with difficulty, platform, and tags
- Handling empty search values
- Dynamic MongoDB filter construction
- Postman API testing

> **Roadmap note:** Pagination was practiced early during Day 16, but it is formally scheduled for **Day 18**.

## Key Concepts

### Search with `req.query`
Example:
```http
GET /api/problems?search=valid
```

Access:
```js
req.query.search
```

Search is an optional retrieval condition, so it belongs in `req.query`.

### Zod validation
```js
const problemFilterSchema = z
  .object({
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    tags: z.string().optional(),
    platform: z
      .enum(["leetcode", "gfg", "codechef", "codeforces", "other"])
      .optional(),
    search: z.string().optional(),
  })
  .strict();
```

### MongoDB `$regex`
```js
filter["problemInfo.problemName"] = {
  $regex: search,
  $options: "i",
};
```

- `$regex` → pattern/text matching
- `$options: "i"` → case-insensitive matching

Example:
```text
search=valid

Valid Parentheses → match
valid-palindrome  → match
VALID ANAGRAM     → match
Two Sum           → no match
```

### Empty search
Treat an empty search as no search condition:
```js
if (search !== undefined && search.trim() !== "") {
  filter["problemInfo.problemName"] = {
    $regex: search.trim(),
    $options: "i",
  };
}
```

## Problem Solving / Approach

Build one dynamic MongoDB filter:

```js
const filter = {};

if (difficulty !== undefined) {
  filter["problemInfo.difficulty"] = difficulty;
}

if (tags !== undefined) {
  const tagList = tags.split(",");

  filter["problemInfo.tags"] = {
    $in: tagList,
  };
}

if (platform !== undefined) {
  filter["problemInfo.platform"] = platform;
}

if (search !== undefined && search.trim() !== "") {
  filter["problemInfo.problemName"] = {
    $regex: search.trim(),
    $options: "i",
  };
}

const problemsData = await Problem.find(filter);
```

This supports multiple conditions in one database query.

Example:
```http
GET /api/problems?search=valid&difficulty=easy&platform=leetcode&tags=string,stack
```

Conceptually:
```js
{
  "problemInfo.difficulty": "easy",
  "problemInfo.platform": "leetcode",
  "problemInfo.tags": {
    $in: ["string", "stack"]
  },
  "problemInfo.problemName": {
    $regex: "valid",
    $options: "i"
  }
}
```

## Interview Round

### Q1. Why use `req.query` for search?
**Answer:** Search is an optional retrieval criterion, so it belongs in the query string along with filtering, sorting, and pagination.

### Q2. Why use `$regex`?
**Answer:** `$regex` allows MongoDB to match a text pattern inside the problem name instead of requiring an exact match.

### Q3. What does `$options: "i"` do?
**Answer:** It makes the regex search case-insensitive.

### Q4. Should search and difficulty use separate database queries?
**Answer:** No. Build one MongoDB filter containing both conditions and perform one `find()` operation.

### Q5. What is the difference between `search` and `problemInfo.problemName`?
**Answer:** `search` is the query parameter supplied by the client; `problemInfo.problemName` is the actual MongoDB field being searched.

### Score / Feedback
**Score: 9.5/10**

Strong understanding of query parameters, regex, case-insensitive search, dynamic filters, and combined conditions.

## Mistakes to Carry Forward

1. Do not confuse the query parameter with the database field.
```js
search
```
is not:
```js
problemInfo.search
```

The correct field is:
```js
problemInfo.problemName
```

2. Regex is case-sensitive by default. Use:
```js
$options: "i"
```
for case-insensitive search.

3. Do not create separate database queries for every filter. Build one filter object.

## Communication Improvement

### Improved interview explanation
> "The client sends the search keyword through `req.query`. Zod validates the query, and the controller passes the validated data to the service. The service dynamically builds a MongoDB filter and uses `$regex` with the `i` option to perform a case-insensitive search on `problemInfo.problemName`. The results are returned to the controller, which sends the response to the client."

## Learning Pattern

```text
Client
  ↓
req.query.search
  ↓
Zod validation
  ↓
validated query
  ↓
Controller
  ↓
Service
  ↓
Dynamic filter
  ↓
$regex + $options: "i"
  ↓
Problem.find(filter)
  ↓
MongoDB
  ↓
Controller
  ↓
Client
```

**Core idea:** Query parameters describe how the client wants to retrieve data; the service converts those parameters into database conditions.

## Day Status

**Day 16: ✅ COMPLETED**

### Completed
- [x] Search using `req.query`
- [x] Add `search` to Zod schema
- [x] Use `$regex`
- [x] Use case-insensitive `$options: "i"`
- [x] Search inside `problemInfo.problemName`
- [x] Handle empty search
- [x] Combine search with difficulty
- [x] Combine search with platform
- [x] Combine search with tags
- [x] Test search API in Postman

### Early Practice
- [x] Pagination concepts were practiced early
- [x] `page`, `limit`, `skip`
- [x] `countDocuments`
- [x] Pagination metadata
- [x] `Promise.all()`

> Pagination remains formally scheduled for **Day 18** according to the roadmap.

## Next Day

### Day 17 — Sorting Problems
Focus:
- `sortBy`
- `order`
- Mongoose `.sort()`
- Sort by difficulty
- Sort by confidence
- Sort by dates
- Validate sorting parameters safely
