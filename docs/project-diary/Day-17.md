# Day 17 — Sorting Problems

## Goal / Objective
Implement sorting for the Recall Problems API with normal field sorting and custom difficulty sorting, while preserving filtering, search, and pagination.

## Concepts Learned
- `sortBy` selects the field to sort.
- `order` selects ascending (`1`) or descending (`-1`).
- Normal fields use Mongoose `.sort()`.
- Difficulty requires custom ordering: `easy → medium → hard`.
- `$indexOfArray` maps difficulty to ranks: `easy=0`, `medium=1`, `hard=2`.
- Difficulty sorting uses an aggregation pipeline.
- `$skip` and `$limit` provide pagination after sorting.
- `countDocuments(filter)` gives the total matching records before pagination.
- `Promise.all()` can run the independent fetch and count queries concurrently.
- `difficultyRank` is derived data, so it is not stored permanently; this avoids redundant data and consistency issues.

## Architecture / Request Flow

```text
Query Parameters
      ↓
Zod validation
      ↓
Build filter
      ↓
Check sortBy
      ├── difficulty → aggregation pipeline
      ├── confidence/date → find().sort()
      └── missing → normal find()
      ↓
Pagination
      ↓
Problems + pagination metadata
```

Difficulty pipeline:

```text
$match
↓
$addFields → difficultyRank
↓
$sort
↓
$skip
↓
$limit
↓
$project → remove difficultyRank
```

## Sorting Behavior

Supported fields:
- `difficulty`
- `confidence`
- `firstSolvedAt`
- `lastSolvedAt`

Behavior:
- `asc` → `1`
- `desc` → `-1`
- missing `order` → ascending
- `order` without `sortBy` → invalid

## Testing

Postman tests passed for:
- Confidence ascending
- Confidence descending
- Difficulty ascending
- Difficulty descending
- Default order
- Invalid `order` without `sortBy`
- Combined filtering + search + sorting + pagination

Example:

```text
GET /api/problems?difficulty=medium&search=binary&sortBy=confidence&order=desc&page=1&limit=5
```

## Code Practiced

Normal sorting:

```js
const sortOrder = order === "desc" ? -1 : 1;

const sortOptions = {};

if (sortBy !== undefined) {
  sortOptions[`userLearningInfo.${sortBy}`] = sortOrder;
}
```

Custom difficulty sorting:

```js
const pipeline = [
  { $match: filter },
  {
    $addFields: {
      difficultyRank: {
        $indexOfArray: [
          ["easy", "medium", "hard"],
          "$problemInfo.difficulty",
        ],
      },
    },
  },
  {
    $sort: {
      difficultyRank: sortOrder,
    },
  },
  { $skip: skip },
  { $limit: limit },
  {
    $project: {
      difficultyRank: 0,
    },
  },
];
```

## Key Learnings
- Lexicographical string sorting does not match the required difficulty order.
- `$indexOfArray` can convert categorical values into sortable numeric ranks.
- Aggregation is useful when sorting requires calculated values.
- Pagination must be applied after sorting.
- Total count must be calculated without pagination.
- Derived fields do not always need to be persisted.

## Mistakes / Debugging
- Used `learningInfo` instead of the actual schema path `userLearningInfo`.
- Initially tried `Problem.sort()`, but `.sort()` belongs to the query chain.
- Initially tried putting an aggregation pipeline inside `sortOptions`; aggregation and normal query sorting are separate approaches.
- Initially considered using the paginated result length as the total count; corrected to `countDocuments(filter)`.
- Temporary `difficultyRank` must be removed from the API response.

## Interview Round

### Main Explanation
I use two query parameters for sorting: `sortBy` specifies which field to sort, and `order` specifies ascending or descending order. For normal fields like confidence and dates, I use MongoDB's regular `.sort()` operation. Difficulty is different because we need a custom order: easy, medium, hard. So I use `$indexOfArray` to convert these values into ranks 0, 1, and 2, then sort using that rank in an aggregation pipeline. I apply pagination after sorting using `$skip` and `$limit`. I don't store the rank permanently because `difficulty` is the source of truth, and storing a derived rank would create redundant data and potential consistency issues.

### Assessment
- Technical understanding: 8.5/10
- Implementation: 9/10
- Recall/project understanding: 8.5/10
- Problem solving: 9/10
- Interview explanation: 7.5/10
- Communication clarity: 7/10
- Overall: 8.2/10

## Communication Improvement
The technical concepts are understood better than they are explained. Answers should be structured as:

```text
What?
Why?
How?
Tradeoff?
```

Focus on concise, structured interview explanations instead of listing disconnected points.

## Learning Pattern
Day 17 reinforced the difference between:
- simple database operations for straightforward requirements
- aggregation for custom business logic

The main lesson was choosing the database operation according to the requirement rather than forcing everything into one query style.

## Day Status
- [x] Normal field sorting
- [x] Ascending / descending order
- [x] Custom difficulty sorting
- [x] `$indexOfArray`
- [x] Aggregation pipeline
- [x] Pagination with sorting
- [x] Total result counting
- [x] Combined query testing
- [x] Interview round
- [x] Communication feedback

**Status: Day 17 Completed ✅**
