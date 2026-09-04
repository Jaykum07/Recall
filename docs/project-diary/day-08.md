# Day 8 — MongoDB + Mongoose + Problem Model

## 🎯 Today's Goal

Today I connected Recall with MongoDB using Mongoose and learned how Schema, Model, Service, and Controller work together to create a real problem in the database.

---

# MongoDB + Mongoose

## What is the difference between MongoDB and Mongoose?

- MongoDB is the actual database where our data is stored.
- Mongoose is a Node.js/JavaScript library that helps us connect and work with MongoDB.
- Mongoose provides Schema, Model, validation, and database methods.

```text
Node.js
   ↓
Mongoose
   ↓
MongoDB
````

---

## What does `mongoose.connect()` do?

```js
await mongoose.connect(process.env.MONGO_URI);
```

It connects our Node.js application with MongoDB through Mongoose.

We use:

```js
process.env.MONGO_URI
```

instead of directly writing the MongoDB connection string because the connection string can contain sensitive credentials.

---

# Database Configuration

## `database.js`

```text
server/
└── src/
    └── config/
        └── database.js
```

The responsibility of `database.js` is to handle the MongoDB connection.

```text
Node.js
   ↓
database.js
   ↓
Mongoose
   ↓
MongoDB
```

---

# `app.listen()` vs `mongoose.connect()`

## `app.listen(PORT)`

Starts the Express server and allows it to receive HTTP requests.

## `mongoose.connect(MONGO_URI)`

Connects our Node.js application to MongoDB.

```text
app.listen()
→ Starts HTTP server

mongoose.connect()
→ Connects application with MongoDB
```

---

# Mongoose Schema

## What is a Mongoose Schema?

A Mongoose Schema defines the structure of our documents.

It also helps us define:

* Data types
* Required fields
* Validation
* Default values
* Enum values
* Minimum / maximum values

Example:

```js
difficulty: {
  type: String,
  enum: ["easy", "medium", "hard"],
  required: true
}
```

### My Understanding

MongoDB is flexible, but we use Mongoose Schema because we want our Recall data to follow a proper structure and rules.

---

# Problem Schema

Our Recall Problem Schema contains:

```text
Problem
│
├── userId
│
├── problemInfo
│   ├── problemName
│   ├── problemUrl
│   ├── description
│   ├── platform
│   ├── difficulty
│   ├── topicIds
│   └── tags
│
└── userLearningInfo
    ├── whatILearned
    ├── whatIStruggledWith
    ├── confidence
    ├── mistake
    ├── firstSolvedAt
    └── lastSolvedAt
```

---

# Schema Validation

## `required`

```js
required: true
```

The field must be provided.

---

## `trim`

```js
trim: true
```

Removes unnecessary spaces from strings.

---

## `minlength`

```js
minlength: 3
```

The string must contain at least 3 characters.

---

## `maxlength`

```js
maxlength: 100
```

The string cannot contain more than 100 characters.

---

## `enum`

```js
enum: ["easy", "medium", "hard"]
```

Only these values are allowed.

For example:

```text
easy      ✅
medium    ✅
hard      ✅
extreme   ❌
```

---

## `min` and `max`

For confidence:

```js
min: 0,
max: 5
```

So:

```text
0 → valid
3 → valid
5 → valid
6 → invalid
```

---

# ObjectId

We used:

```js
mongoose.Schema.Types.ObjectId
```

ObjectId is used to identify/reference MongoDB documents.

Example:

```js
userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true
}
```

---

# `ref`

Example:

```js
ref: "User"
```

`ref` tells Mongoose that this ObjectId refers to the `User` model.

Similarly:

```js
ref: "Topic"
```

means the ID refers to a Topic model.

### Important

`ref` does not create the User or Topic.

It tells Mongoose which model the ID refers to, especially when we use features like `populate()`.

---

# Mongoose Model

We created:

```js
const Problem = mongoose.model("Problem", problemSchema);
```

## Schema

Schema defines:

> What should the Problem document look like?

## Model

Model provides methods to work with Problem documents.

Examples:

```js
Problem.create()
Problem.find()
Problem.findById()
Problem.findByIdAndUpdate()
Problem.findByIdAndDelete()
```

### Easy way to remember

```text
Schema → Blueprint
Model  → Database operations
MongoDB → Actual storage
```

---

# Timestamps

Our Schema uses:

```js
{ timestamps: true }
```

Mongoose automatically creates:

```text
createdAt
updatedAt
```

So we don't need to manually create these fields.

---

# Controller vs Service vs Model

Our architecture is now:

```text
Route
   ↓
Controller
   ↓
Service
   ↓
Model
   ↓
MongoDB
```

## Controller

Controller handles HTTP-specific tasks.

It:

* Receives request
* Reads request data
* Calls Service
* Sends HTTP response
* Sends status code

---

## Service

Service handles:

* Business logic
* Recall-specific rules
* Calling Model

---

## Model

Model handles database operations using Mongoose.

---

# Why do we use Service?

Instead of putting database and business logic directly inside Controller, we separate it.

```text
Controller
→ HTTP responsibility

Service
→ Business logic

Model
→ Database responsibility
```

This keeps our code cleaner and easier to maintain.

---

# Async Service

Previously our Service returned a temporary JavaScript object.

Now we use the actual MongoDB database.

```js
import Problem from "../models/problem.model.js";

const createProblemService = async (problemData) => {
  const problem = await Problem.create(problemData);

  return problem;
};

export default createProblemService;
```

### What does `Problem.create()` do?

```js
Problem.create(problemData)
```

creates a new Problem document in MongoDB.

---

# Why `async` and `await`?

Database operations are asynchronous.

So our Service is:

```js
const createProblemService = async (problemData) => {
```

and:

```js
const problem = await Problem.create(problemData);
```

Without `await`:

```js
const problem = createProblemService(req.body);
```

`problem` would contain a Promise.

With `await`:

```js
const problem = await createProblemService(req.body);
```

`problem` contains the actual result.

---

# Async Controller

Because our Service is asynchronous, the Controller also needs to wait for it.

```js
export const createProblemController = async (req, res) => {

  const problem = await createProblemService(req.body);

  res.status(201).json({

    success: true,
    message: "problem created",
    data: problem,

  });

};
```

---

# Recall Business Rule

Our Recall application has a business rule:

```text
When a new problem is created,
initial confidence = 3
```

This is a business rule, so it belongs in the **Service layer**.

It is inside:

```text
userLearningInfo
      ↓
confidence
      ↓
3
```

---

# Schema Validation vs Business Logic

This is an important difference.

## Schema Validation

Example:

```js
confidence: {
  type: Number,
  min: 0,
  max: 5
}
```

It asks:

> Is this data valid?

---

## Business Logic

Example:

```text
New problem
   ↓
confidence = 3
```

It asks:

> What should Recall do?

---

## Easy Way to Remember

```text
Schema
→ Is this data valid?

Service
→ What should our application do?
```

---

# Real MongoDB Testing

## API Tested

```http
POST /api/problems
```

The API successfully returned:

```text
201 Created
```

The problem was actually stored in MongoDB.

---

## What I Verified

* Problem was created successfully.
* MongoDB generated `_id`.
* `createdAt` was generated.
* `updatedAt` was generated.
* Service business logic worked.
* Confidence was set to `3`.
* Controller returned the created problem.

---

# Complete Request Flow

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
Mongoose Schema Validation
   ↓
MongoDB
   ↓
Created Problem Document
   ↓
Service
   ↓
Controller
   ↓
201 Created
   ↓
Client
```

### In My Own Words

When the client sends a POST request to `/api/problems`, the request first reaches the problem route.

The route sends the request to the Problem Controller.

The Controller gets the request body and calls the Problem Service.

The Service handles our business logic and calls the Problem Model.

The Model uses Mongoose to create the document in MongoDB.

MongoDB returns the created document.

The Service returns that document to the Controller.

Finally, the Controller sends the HTTP response with `201 Created`.

---

# ❌ Problem Faced Today

Initially, our Problem Schema had:

```js
ref: "User"
ref: "Topic"
```

but we haven't created User and Topic models yet.

We learned that `ref` does not itself create those models or documents.

For today's work, we focused on getting the Problem → MongoDB creation flow working.

---

# 🧠 What I Learned Today

* MongoDB is the actual database.
* Mongoose helps Node.js work with MongoDB.
* `mongoose.connect()` connects Node.js with MongoDB.
* Schema defines document structure and validation.
* Model provides database operations.
* `ObjectId` is used for MongoDB document references.
* `ref` tells Mongoose which model an ObjectId refers to.
* `timestamps: true` automatically creates `createdAt` and `updatedAt`.
* `Problem.create()` creates a document in MongoDB.
* Database operations are asynchronous.
* `await` waits for the Promise result.
* Controller handles HTTP requests and responses.
* Service handles business logic.
* Model handles database operations.
* Schema validation and business logic are different.
* Recall initial confidence is a business rule.
* Successfully created a real Problem document in MongoDB.

---

# 🔑 Interview Revision

### Q1. What is MongoDB?

MongoDB is a NoSQL database that stores data as documents.

### Q2. What is Mongoose?

Mongoose is a Node.js library that helps us work with MongoDB using Schema, Model, validation, and database methods.

### Q3. What is a Mongoose Schema?

A Schema defines the structure, data types, and validation rules of a document.

### Q4. What is a Mongoose Model?

A Model is created from a Schema and provides methods to perform database operations.

### Q5. What does `Problem.create()` do?

It creates a new Problem document in MongoDB.

### Q6. Why is the Service async?

Because database operations are asynchronous and return a Promise.

### Q7. Why does the Controller use `await`?

Because it needs to wait for the asynchronous Service and receive the actual created document.

### Q8. Controller vs Service?

Controller handles HTTP request/response.

Service handles business logic and application rules.

### Q9. Schema validation vs Business Logic?

Schema validation checks whether data is valid.

Business logic defines what the application should do.

---

# 📁 Files Worked On

```text
server/src/config/database.js
server/src/models/problem.model.js
server/src/services/problem.service.js
server/src/controllers/problem.controller.js
docs/project-diary/day-08.md
```

---

# 🚀 Day 8 Result

### Before Day 8

```text
POST /api/problems
       ↓
Controller
       ↓
Fake JavaScript Object
```

### After Day 8

```text
POST /api/problems
       ↓
Controller
       ↓
Service
       ↓
Problem Model
       ↓
Mongoose
       ↓
MongoDB
       ↓
Real Problem Document
```