# Day 02 — MongoDB Data Modeling

## Goal

Understand how Recall's data should be represented in MongoDB and how collections relate to each other.

---

# Collections

Recall V1 will contain the following main collections:

- User
- Problem
- Topic
- Revision
- Goal
- Sheet

---

# Relationships

## User → Problem

One user can create many problems.

Relationship:

    User 1 ─────── N Problem

A Problem belongs to one User.

---

## User → Revision

One user can have many revision records.

    User 1 ─────── N Revision

---

## Problem → Revision

One problem can have many revision events.

    Problem 1 ─────── N Revision

A revision is NOT N:N with Problem because each revision document represents one revision event for one problem.

---

## User → Goal

A user can have multiple historical goals, but only one active goal at a time.

    User 1 ─────── N Goal

Historical goals are preserved.

---

## User → Sheet

A user can create multiple sheets.

    User 1 ─────── N Sheet

---

## Problem ↔ Topic

A problem can belong to multiple topics.

A topic can contain multiple problems.

    Problem N ─────── N Topic

This will be represented using topic ObjectIds inside a Problem document.

---

## Problem ↔ Sheet

A problem can exist in multiple sheets.

A sheet can contain multiple problems.

    Problem N ─────── N Sheet

---

## Topic → Topic

Topics can have parent/subtopic relationships.

For V1:

    Topic 1 ─────── N Child Topics

Each child topic can have only one parent.

A topic cannot have multiple parents in V1.

---

# Embedding vs Referencing

## Embedding

Embedding means storing related data inside the same document.

Example:

    User
      └── socialLinks
          ├── github
          ├── leetcode
          └── gfg

Social links are embedded because they are:

- Small
- Tightly connected to User
- Not independently queried as major entities

---

## Referencing

Referencing means storing the ObjectId of another document.

Example:

    Problem
      └── userId → User

And:

    Revision
      ├── userId → User
      └── problemId → Problem

Large or independently growing data should generally be referenced.

---

# Important MongoDB Concepts Learned

## ObjectId

MongoDB uses ObjectId as the default `_id` value.

Example:

    66xxxxxxxxxxxxxxxxxxxxxx

It uniquely identifies a document.

---

## ref

Mongoose `ref` tells Mongoose which model an ObjectId refers to.

Example:

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }

`ref` establishes the relationship for Mongoose operations such as populate.

It does NOT automatically cascade-delete related documents.

---

## Important Design Decision

We will NOT store thousands of complete Problem documents inside User.

Instead:

    User
      ↓
    Problem documents

and references will be used.

---

# Learning Outcome

I now understand:

- Collections
- Documents
- Fields
- Nested objects
- ObjectId
- Embedding
- Referencing
- 1:N relationships
- N:N relationships
- Self-referencing relationships

The main principle learned:

> Store small tightly-coupled data together; reference large, independently growing or shared data.