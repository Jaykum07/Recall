# Day 7 — Services & Business Logic

## What I Learned

### Service Layer

A service layer handles the business logic and actual rules of our application.

### Controller vs Service

- Controller handles HTTP-specific tasks like request and response.
- Service handles business logic and application rules.

### Why Separate Controller and Service?

If we put business logic directly inside the controller, the controller can become very large and difficult to understand.

Separating them makes the code cleaner and easier to maintain.

## Request Flow

POST /api/problems

Client
↓
Route
↓
Controller
↓
Service
↓
Controller
↓
HTTP Response

## Business Logic Example

For Recall, every newly created problem starts with confidence 3.

This rule belongs to the Service because it is a business rule, not an HTTP responsibility.

## What I Practiced

- Created `problem.service.js`
- Connected Controller with Service
- Passed `req.body` from Controller to Service
- Returned processed problem data from Service
- Added initial confidence rule
- Tested the API using Postman

## Important Understanding

Route → Where the request goes

Controller → Handles HTTP request/response

Service → Handles business logic

## Key Takeaway

Controller handles HTTP.
Service handles business logic.