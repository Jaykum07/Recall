# Day 04 — Node.js, npm & Environment Variables

## Goal

Refresh Node.js fundamentals before implementing the Recall backend.

---

# Node.js

Node.js is a JavaScript runtime that allows JavaScript to execute outside the browser.

JavaScript is the language.

Node.js is the runtime.

V8 is the JavaScript engine used by Node.js.

---

# Node.js Mental Model

    Node.js Runtime
    │
    ├── V8
    │    └── Executes JavaScript
    │
    ├── Node APIs
    │    └── Timers, filesystem, HTTP, etc.
    │
    └── Event Loop
         └── Coordinates asynchronous work

Important:

V8 is NOT the event loop.

Node.js uses an event-driven architecture and libuv for important asynchronous I/O infrastructure.

---

# Event Loop

Example:

    console.log("A");

    setTimeout(() => {
      console.log("B");
    }, 0);

    console.log("C");

Output:

    A
    C
    B

Reason:

Synchronous JavaScript executes first.

A timer with `0ms` does not execute immediately.

Its callback becomes eligible for execution after the current synchronous work is completed.

---

# Blocking

An infinite synchronous loop can block the event loop.

When the event loop is blocked:

- Requests cannot be processed normally
- Timers are delayed
- The server becomes unresponsive

---

# npm

npm stands for Node Package Manager.

It helps us:

- Install packages
- Remove packages
- Update packages
- Manage project dependencies

Example:

    npm install express

Important terminology:

    Express → package/framework
    npm → package manager

---

# package.json

`package.json` contains project information and dependency requirements.

It can contain:

- Project name
- Version
- Description
- Scripts
- Dependencies
- DevDependencies

Example:

    "scripts": {
      "dev": "nodemon src/server.js"
    }

---

# dependencies vs devDependencies

## dependencies

Packages required by the application to run.

Examples:

- express
- mongoose
- cors
- dotenv

## devDependencies

Packages mainly required during development/testing/tooling.

Example:

- nodemon

---

# node_modules

`node_modules` contains installed packages and their dependencies.

Example:

    node_modules/
      ├── express/
      ├── mongoose/
      ├── cors/
      └── ...

We do not commit `node_modules` to GitHub because:

- It can be very large
- It can be recreated
- Git repository would become unnecessarily large

---

# package-lock.json

`package.json` describes dependency requirements.

`package-lock.json` records the resolved dependency tree and versions used for installation.

Therefore another developer can clone the project and run:

    npm install

to recreate `node_modules`.

---

# Modules

A module is a JavaScript file that encapsulates functionality and can share it with other files.

Node.js supports:

## CommonJS

    require()
    module.exports

## ES Modules

    import
    export

Recall will use ES Modules.

---

# ES Modules

To use modern `import/export` syntax in our Node.js project, we will add:

    "type": "module"

to the server `package.json`.

Example:

    import express from "express";

---

# Default vs Named Export

Default export:

    export default app;

Import:

    import app from "./app.js";

A module can have only one default export.

Named exports:

    export const add = () => {};
    export const subtract = () => {};

Import:

    import { add, subtract } from "./math.js";

A module can have multiple named exports.

---

# Environment Variables

Sensitive configuration should not be hardcoded into source code.

Bad:

    const mongoUrl = "mongodb+srv://username:password...";

Problems:

- Credentials can be exposed
- Anyone with repository access may see secrets
- Database/API resources can be compromised

---

# .env

`.env` is commonly used to store environment-variable values.

Example:

    PORT=5000
    MONGO_URI=...
    JWT_SECRET=...

`.env` should not be committed to GitHub.

---

# process

`process` is a global object provided by Node.js representing the currently running Node.js process.

It provides information and control related to that process.

---

# process.env

`process.env` is an object containing environment variables available to the Node.js process.

Example:

    process.env.PORT

may return:

    "5000"

Environment variables are generally represented as strings.

---

# dotenv

`dotenv` reads values from a `.env` file and loads them into `process.env`.

Mental model:

    .env
      ↓
    dotenv
      ↓
    process.env
      ↓
    process.env.MONGO_URI

Important:

`process.env` does NOT itself read the `.env` file.

`dotenv` performs that loading step.

---

# .env vs .env.example

## .env

Contains actual local secrets/configuration.

Example:

    MONGO_URI=actual-secret-value
    JWT_SECRET=actual-secret-value

Do not commit it.

## .env.example

Contains variable names/placeholders.

Example:

    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret

It is safe to commit and helps other developers understand which environment variables are required.

---

# Complete Environment Variable Flow

    .env
      │
      │ dotenv reads
      ↓
    process.env
      │
      ↓
    process.env.PORT
      │
      ↓
    "5000"

---

# Key Learnings

Today I refreshed:

- Node.js runtime
- V8
- Event loop
- npm
- package.json
- package-lock.json
- node_modules
- dependencies
- devDependencies
- CommonJS
- ES Modules
- import/export
- process
- process.env
- .env
- .env.example
- dotenv

The most important mental models:

> Node.js is a runtime, not a programming language.

> npm manages packages; Express is a package.

> `package.json` describes dependencies; `package-lock.json` records resolved dependency versions.

> `dotenv` loads `.env` values into `process.env`.

> Secrets belong in environment configuration, not source code.