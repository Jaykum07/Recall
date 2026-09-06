# Day 10 — GET One Problem & PATCH Update

## 🎯 Goal

Today I worked on:

- Get a single problem using ID
- Validate MongoDB ObjectId
- Handle 400 and 404 errors
- Implement PATCH API
- Understand `findByIdAndUpdate()`
- Understand `$set`
- Understand dot notation
- Understand optional chaining `?.`
- Preserve existing nested data during PATCH

---

## 📚 Concepts Learned

### 1. Get Problem by ID

For:

```http
GET /api/problems/:id
````

The ID comes from:

```js
req.params.id
```

Service uses:

```js
Problem.findById(id)
```

---

### 2. ObjectId Validation

Before querying MongoDB, validate the ID:

```js
mongoose.Types.ObjectId.isValid(id)
```

If the ID is invalid:

```text
400 Bad Request
```

If the ID is valid but the problem doesn't exist:

```text
404 Not Found
```

---

### 3. PATCH API

PATCH is used when we want to update only part of a resource.

Example:

```http
PATCH /api/problems/:id
```

Body:

```json
{
  "userLearningInfo": {
    "confidence": 4
  }
}
```

The ID comes from:

```js
req.params.id
```

The update data comes from:

```js
req.body
```

---

## 🔧 Mongoose Update

Used:

```js
Problem.findByIdAndUpdate(
  id,
  { $set: updatedData },
  { new: true }
);
```

### `new: true`

Returns the updated document after the update.

---

## 🧠 `$set` and Dot Notation

Initially, sending:

```json
{
  "userLearningInfo": {
    "confidence": 4
  }
}
```

could replace the existing `userLearningInfo` object.

This caused other fields to disappear.

Using:

```js
{
  $set: {
    "userLearningInfo.confidence": 4
  }
}
```

changes only the confidence field.

Dot notation:

```js
"userLearningInfo.confidence"
```

means:

```text
userLearningInfo
      ↓
confidence
```

Other existing fields remain preserved.

---

## ❓ Optional Chaining

Learned:

```js
data.userLearningInfo?.confidence
```

`?.` is optional chaining.

It safely accesses `confidence` only when `userLearningInfo` exists.

Without `?.`:

```js
data.userLearningInfo.confidence
```

can throw an error if `userLearningInfo` is undefined.

### Memory Trick

```text
.   → I expect it to exist
?.  → It might not exist, check safely
```

---

## 🏗️ Architecture / Request Flow

### GET One

```text
GET /api/problems/:id
        ↓
      Route
        ↓
    Controller
        ↓
     Service
        ↓
Problem.findById()
        ↓
     MongoDB
        ↓
    Controller
        ↓
   HTTP Response
```

### PATCH

```text
PATCH /api/problems/:id
        ↓
      Route
        ↓
    Controller
        ↓
Service(id, req.body)
        ↓
findByIdAndUpdate()
        ↓
     MongoDB
        ↓
 Updated Problem
        ↓
    Controller
        ↓
   HTTP Response
```

---

## ❌ Error Flow

Invalid ObjectId:

```text
Invalid ID
   ↓
400 Bad Request
```

Valid ObjectId but problem doesn't exist:

```text
Valid ID
   ↓
findById()
   ↓
null
   ↓
404 Not Found
```

Unexpected error:

```text
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
500 Internal Server Error
```

---

## 🧪 Testing

### GET existing problem

```http
GET /api/problems/:id
```

✅ Working

### GET invalid ID

```http
GET /api/problems/1
```

✅ Returns `400 Bad Request`

### GET nonexistent problem

✅ Returns `404 Problem not Found`

### PATCH confidence

```json
{
  "userLearningInfo": {
    "confidence": 4
  }
}
```

✅ Working

### PATCH preservation

Changed:

```text
confidence: 3 → 4
```

Other existing nested fields remained preserved.

✅ `$set` working correctly.

---

## 💻 Code Practiced

### Update Service

```js
export const updateProblemService = async (id, data) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("Bad Request");
      error.statusCode = 400;
      throw error;
    }

    const updatedData = {};

    if (data.userLearningInfo?.confidence !== undefined) {
      updatedData["userLearningInfo.confidence"] =
        data.userLearningInfo.confidence;
    }

    const problemData = await Problem.findByIdAndUpdate(
      id,
      { $set: updatedData },
      {
        new: true,
      }
    );

    if (!problemData) {
      const error = new Error("Problem not Found");
      error.statusCode = 404;
      throw error;
    }

    return problemData;
  } catch (err) {
    throw err;
  }
};
```

---

## 📝 Key Learnings

1. `req.params.id` gets the ID from the URL.
2. `req.body` contains update data.
3. `findById()` gets one document.
4. `findByIdAndUpdate()` updates one document.
5. `await` waits for the MongoDB operation.
6. `new: true` returns the updated document.
7. `ObjectId.isValid()` validates MongoDB IDs.
8. `400` means invalid request/input.
9. `404` means resource doesn't exist.
10. `$set` allows partial updates.
11. Dot notation updates nested fields.
12. `?.` is optional chaining.
13. PATCH should update only the required fields.
14. Existing nested data should be preserved.

---

## ⚠️ Mistakes & Debugging

### Mistake 1 — Missing `await`

Initially:

```js
const problemData = Problem.findByIdAndUpdate(...)
```

Fixed:

```js
const problemData = await Problem.findByIdAndUpdate(...)
```

### Mistake 2 — Nested data replacement

Updating:

```json
{
  "userLearningInfo": {
    "confidence": 4
  }
}
```

removed other nested fields.

Solved using:

```js
$set
```

and dot notation.

### Mistake 3 — Optional chaining understanding

Learned why:

```js
data.userLearningInfo?.confidence
```

is safer when nested data may not exist.

---

## ✅ Day 10 Status

* [x] GET problem by ID
* [x] ObjectId validation
* [x] 400 handling
* [x] 404 handling
* [x] PATCH problem
* [x] `findByIdAndUpdate()`
* [x] `await`
* [x] `$set`
* [x] Dot notation
* [x] Optional chaining
* [x] Preserve nested fields
* [x] Error middleware flow
