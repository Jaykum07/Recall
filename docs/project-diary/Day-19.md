# Recall V1 — Day 19

## Topic
Combined Query API — Filtering + Search + Sorting + Pagination

## Day Objective
Integrate all Problems API query features into one dynamic and reusable query pipeline.

### Completed Features
- Filtering
- Search
- Sorting
- Custom difficulty sorting
- Pagination
- Pagination metadata
- Zod query validation
- Cross-field validation
- Combined query parameters

---

## 1. Cumulative Recall — Days 1–17

Reviewed:
- Express request flow: route → middleware → controller → service → model
- `req.params` vs `req.query`
- Zod `safeParse()`
- `.strict()`
- `.refine()` / `.superRefine()`
- Dynamic MongoDB filters
- `$in`
- `$regex`
- `$options: "i"`
- MongoDB sorting
- `$skip` and `$limit`
- Pagination formula
- `Promise.all()`
- `countDocuments()`
- Aggregation pipeline
- `$addFields`
- `$indexOfArray`
- `$project`
- 400 / 404 / 500 error handling

Cumulative retention: **~8.5/10**

Main weakness identified: precise technical communication rather than backend understanding.

---

## 2. Combined Query Architecture

The API follows:

```text
Query validation
      ↓
Build filter
      ↓
Search
      ↓
Sorting
      ↓
Pagination
      ↓
Count total
      ↓
Pagination metadata
      ↓
Response
```

Responsibilities:

```text
Filter / Search
→ Which documents should match?

sortBy / order
→ In what order should matched documents appear?

page / limit
→ Which portion of the results should be returned?
```

`page`, `limit`, `sortBy`, and `order` are therefore not part of the document-selection filter.

---

## 3. Zod Query Validation

The schema validates:
- `difficulty`
- `tags`
- `platform`
- `search`
- `page`
- `limit`
- `sortBy`
- `order`

Cross-field validation ensures:

```text
order without sortBy → invalid
```

Final design:

```js
order: z.enum(["asc", "desc"]).optional()
```

instead of:

```js
order: z.enum(["asc", "desc"]).default("asc")
```

Reason: applying a default before cross-field validation made an empty query appear to contain `order: "asc"`.

Custom validation:

```js
.superRefine((data, ctx) => {
  if (data.order !== undefined && data.sortBy === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["order"],
      message: "order requires sortBy",
    });
  }
});
```

Default sorting behavior is handled in the service:

```js
const sortOrder = order === "desc" ? -1 : 1;
```

---

## 4. Dynamic Aggregation Pipeline

The service creates one dynamic pipeline:

```text
$match
   ↓
$addFields (only for custom difficulty sorting)
   ↓
$sort
   ↓
$skip
   ↓
$limit
   ↓
$project (remove temporary rank)
```

The filter is built dynamically from the provided parameters.

Example:

```js
filter["problemInfo.difficulty"] = difficulty;

filter["problemInfo.platform"] = platform;

filter["problemInfo.tags"] = {
  $in: tagList,
};
```

Search is incorporated into the filter:

```js
filter["problemInfo.problemName"] = {
  $regex: search.trim(),
  $options: "i",
};
```

---

## 5. Custom Difficulty Sorting

Normal string sorting does not guarantee:

```text
easy → medium → hard
```

So a temporary rank is calculated:

```text
easy   → 0
medium → 1
hard   → 2
```

using `$indexOfArray`.

```js
const customSorting = {
  difficultyRank: {
    $indexOfArray: [
      ["easy", "medium", "hard"],
      "$problemInfo.difficulty",
    ],
  },
};
```

Then:

```js
pipeline.push({ $addFields: customSorting });
pipeline.push({
  $sort: { difficultyRank: sortOrder },
});
```

The rank is temporary and is not stored in MongoDB.

It is removed with:

```js
pipeline.push({
  $project: {
    difficultyRank: 0,
  },
});
```

### Architecture lesson

Aggregation is not required for every query. `find()` can handle normal filtering, searching, sorting, and pagination. Aggregation was chosen because custom difficulty sorting requires a calculated rank and the pipeline cleanly combines the query stages.

---

## 6. Pagination

Pagination uses:

```js
const skip = (page - 1) * limit;
```

Then:

```js
pipeline.push({ $skip: skip });
pipeline.push({ $limit: limit });
```

Sorting must happen before pagination:

```text
Filter
 ↓
Sort
 ↓
Skip
 ↓
Limit
```

---

## 7. Promise.all() + Total Count

The API needs:
1. Paginated problems
2. Total matching problems

Therefore:

```js
const [problems, totalProblems] = await Promise.all([
  Problem.aggregate(pipeline),
  Problem.countDocuments(filter),
]);
```

`Promise.all()` allows the independent database operations to run concurrently.

It does not make an individual query faster; it avoids unnecessary sequential waiting.

Pagination metadata:

```js
const totalPages = Math.ceil(totalProblems / limit);
```

Response contains:

```text
problems
pagination:
  page
  limit
  totalProblems
  totalPages
  hasNextPage
  hasPreviousPage
```

---

## 8. Full Integration API

Tested successfully:

```http
GET /api/problems?difficulty=medium&platform=leetcode&tags=array,binary-search&search=binary&sortBy=confidence&order=desc&page=2&limit=5
```

This combines difficulty, platform, tags, search, sorting, order, page, and limit.

---

## 9. Postman Testing

All Day 19 tests passed.

### Basic

```http
GET /api/problems
```

**200 — Passed**

### Filter + Pagination

```http
GET /api/problems?difficulty=medium&page=1&limit=5
```

**Passed**

### Search + Pagination

```http
GET /api/problems?search=binary&page=1&limit=5
```

**Passed**

### Filter + Search

```http
GET /api/problems?difficulty=medium&search=binary
```

**Passed**

### Normal Sorting

```http
GET /api/problems?sortBy=confidence&order=desc
```

**Passed**

### Custom Difficulty Sorting

```http
GET /api/problems?sortBy=difficulty&order=asc
```

**Passed**

### Full Integration

```http
GET /api/problems?difficulty=medium&platform=leetcode&tags=array,binary-search&search=binary&sortBy=confidence&order=desc&page=2&limit=5
```

**Passed**

### Invalid Sorting

```http
GET /api/problems?order=desc
```

**400 Bad Request — Passed**

Reason:

```text
order requires sortBy
```

### Page Beyond Results

```http
GET /api/problems?page=999&limit=10
```

**Passed**

Returns an empty problems array with appropriate pagination metadata.

---

## 10. Debugging Lesson

A bug was found in Zod cross-field validation.

The initial schema used:

```js
order: z.enum(["asc", "desc"]).default("asc")
```

For:

```js
{}
```

the default was applied before cross-field validation, effectively producing:

```js
{
  order: "asc"
}
```

This caused `superRefine()` to incorrectly reject `GET /api/problems`.

### Fix

Use:

```js
order: z.enum(["asc", "desc"]).optional()
```

and apply the default in the service:

```js
const sortOrder = order === "desc" ? -1 : 1;
```

This separates validation from business behavior.

---

## 11. Interview Practice

### Why aren't page, limit, sortBy, and order in the filter?

> We don't put them in the filter because they don't determine which documents should match. `sortBy` and `order` are used to sort the matched documents, while `skip` and `limit` are used for pagination.

### Why Promise.all()?

> `Promise.all()` allows independent database operations to run concurrently, so we don't have to wait for the first operation to finish before starting the second one.

### Why aggregation instead of find()?

> We need aggregation because our API requires custom difficulty sorting, so we calculate a rank for each difficulty and sort by that rank. The `find()` method can easily handle normal filtering, searching, sorting, and pagination.

### Large-scale performance

For Recall V1, the current approach is acceptable for the expected smaller dataset and traffic. At larger scale, unanchored regex search, frequent `countDocuments()`, aggregation, and sorting could become performance concerns. Possible future improvements include appropriate indexes, a more suitable search solution, and query optimization.

---

## 12. Code Review

Readability cleanup:

```js
hasPreviousPage: 1 < page,
```

should be:

```js
hasPreviousPage: page > 1,
```

The second version communicates the intent more clearly.

---

## 13. Day 19 Assessment

| Area | Score |
|---|---:|
| Technical understanding | 9/10 |
| Implementation | 9/10 |
| Query/pipeline thinking | 9/10 |
| Debugging | 9/10 |
| Interview explanation | 8/10 |
| English communication | 7.5/10 |
| **Overall** | **8.5/10** |

### Main weakness

Backend concepts are understood well.

The bigger remaining challenge is converting understood concepts into short, precise, natural English while speaking.

---

## 14. Day 19 Completion

### Completed

- Combined filtering
- Search
- Sorting
- Custom difficulty sorting
- Pagination
- Pagination metadata
- Zod cross-field validation
- Dynamic aggregation pipeline
- `Promise.all()`
- `countDocuments()`
- Postman testing
- Edge-case testing
- Debugging
- Code review
- Interview practice
- Communication correction
- Retesting

### Next

**Day 20 — Backend Review + Postman Testing + Cumulative Day 1–20 Interview/Project Defense Test**
