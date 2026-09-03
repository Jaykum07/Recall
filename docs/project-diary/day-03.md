# Day 03 — Mongoose Schema Design

## Goal

Design the MongoDB/Mongoose schemas for the Recall V1 backend.

---

# User Schema

The User document contains:

- name
- email
- passwordHash
- socialLinks
- avatarUrl
- timestamps

Important decisions:

- Email is unique
- Email is trimmed
- Email is converted to lowercase
- Password is stored as passwordHash
- passwordHash uses `select: false`
- Social links are embedded

Example:

    socialLinks: {
      github,
      leetcode,
      gfg,
      codechef,
      hackerrank,
      codeforces
    }

---

# Problem Schema

A Problem belongs to a User.

Important fields:

    userId
    problemInfo
    userLearningInfo

### problemInfo

Contains:

- problemName
- problemUrl
- description
- platform
- difficulty
- topicIds
- tags

### userLearningInfo

Contains:

- whatILearned
- whatIStruggledWith
- confidence
- mistake
- firstSolvedAt
- lastSolvedAt

---

# Important Unique Constraint Decision

`userId` inside Problem must NOT be unique.

Incorrect:

    userId: {
      type: ObjectId,
      unique: true
    }

That would allow only one Problem document per user.

Correct:

    userId: {
      type: ObjectId,
      ref: "User",
      required: true
    }

One user can create many problems.

---

# Difficulty Validation

Difficulty uses enum:

    easy
    medium
    hard

This prevents invalid values such as:

    very-easy
    medium-level
    super-hard

---

# Confidence

Confidence uses a range:

    min: 0
    max: 5

This represents the user's understanding level.

---

# Topic Schema

Topic contains:

- name
- parentTopicId
- timestamps

Topics use a self-reference.

Example:

    Arrays
      ├── Two Pointers
      ├── Sliding Window
      └── Prefix Sum

V1 allows each topic to have only one parent.

---

# Revision Schema

Revision represents one revision event.

Important fields:

- userId
- problemId
- revisionNumber
- scheduledFor
- completedAt
- status
- confidence

Status:

    pending
    completed
    skipped

---

# Important Revision Concept

`scheduledFor` and `completedAt` mean different things.

### scheduledFor

When the revision is supposed to happen.

### completedAt

When the user actually completed it.

Therefore:

    completedAt: null

is valid for a pending revision.

Confidence should also be nullable because the user may not have completed the revision yet.

---

# Goal Schema

Goal contains:

- userId
- target
- period
- startDate
- endDate
- isActive

Period:

    daily
    weekly

A user can have historical goals but only one active goal.

---

# Sheet Schema

Sheet contains:

- userId
- name
- description
- problemIds

A sheet can contain multiple problems.

A problem can belong to multiple sheets.

---

# Validation Principles Learned

### required

Field must be provided.

### default

Value used when no value is supplied.

### enum

Restricts values to predefined choices.

### min / max

Restricts numeric values.

### minlength / maxlength

Restricts string length.

### trim

Removes unnecessary whitespace.

### lowercase

Converts strings to lowercase.

### unique

Creates a uniqueness constraint/index.

Important:

`unique` is not normal validation.

---

# Important Design Learning

`required + default` is often unnecessary when the default already guarantees a value.

For example:

    target: {
      type: Number,
      required: true,
      default: 1
    }

is usually better represented as:

    target: {
      type: Number,
      required: true,
      min: 1
    }

when the API should explicitly provide the target.

---

# Learning Outcome

I now understand how to convert project requirements into Mongoose schemas.

I also understand that schema design is not just about creating fields.

It involves thinking about:

- Relationships
- Query patterns
- Validation
- Data ownership
- Growth of data
- Business rules