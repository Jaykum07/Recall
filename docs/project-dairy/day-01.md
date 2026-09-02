# Day 01 — Project Planning & Architecture

## Date
2026-08-26

## Goal
Understand the Recall project requirements and decide the overall architecture before writing code.

---

## Project

Recall is a DSA learning and revision tracking platform.

The main goal is to help students:

- Track solved DSA problems
- Record what they learned
- Record mistakes and struggles
- Track confidence
- Schedule revisions
- Maintain consistency through goals and streaks
- Organize problems into sheets
- Track learning progress over time

---

## V1 Scope

The first version will be manually managed.

Users will:

- Register and login
- Add DSA problems manually
- Store problem links
- Select platform and difficulty
- Add topics/tags
- Record learning information
- Track revision schedules
- Set daily/weekly goals
- Organize problems into sheets
- Track revision confidence
- Receive reminders for pending goals/revisions

### Important V1 Decision

No LeetCode API integration will be implemented in V1.

External platform integrations can be considered for V2.

---

## Tech Stack

### Frontend
- React
- Tailwind CSS
- Vite

### Backend
- Node.js
- Express.js

### Database
- MongoDB
- Mongoose

### Project Structure
Monorepo architecture:

    recall/
    ├── client/
    ├── server/
    ├── docs/
    ├── .gitignore
    ├── README.md
    └── package.json

---

## Backend Architecture

The server will use separation of responsibilities:

    src/
    ├── config/
    ├── controllers/
    ├── middleware/
    ├── models/
    ├── routes/
    ├── services/
    ├── utils/
    ├── validators/
    ├── app.js
    └── server.js

### app.js

Responsible for creating/configuring the Express application.

It will contain:

- Express initialization
- Middleware
- Routes
- Error handling

It will NOT start the server.

### server.js

Responsible for:

- Loading environment variables
- Importing the Express app
- Starting the HTTP server using `app.listen()`

This separation will make testing easier because the Express app can be imported without automatically starting the server.

---

## Git Setup

Git repository initialized at the project root.

Initial commit:

    chore: initialize Recall client

Repository is connected to GitHub.

---

## Important Development Principle

We will not commit every tiny change.

Commits will represent logical milestones.

Example:

    feat: configure Express server

    feat: add user authentication

    feat: add problem management

    feat: add revision system

---

## Learning

Today I understood why we should plan the project architecture before implementing features.

I also understood the difference between:

- Client
- Server
- Database
- API
- Application architecture

The Recall project will be developed feature-by-feature instead of writing the entire application at once.