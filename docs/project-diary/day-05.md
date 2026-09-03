# Day 5 — HTTP Methods, Status Codes & Express Request Flow

## Learned
- HTTP request and response
- GET
- POST
- PUT
- PATCH
- DELETE
- HTTP status codes
- 401 vs 403
- express.json()
- Middleware execution order
- next()

## Practical
- Added express.json()
- Created logger middleware
- Created GET /api/health
- Created POST /api/test

## Key Learning
Request → Middleware → Route → Controller → Database → Response

## Mistakes / Corrections
- 401 = authentication problem
- 403 = authenticated but not permitted
- POST means create, not simply "because it supports body"
- PORT is configuration, not a secret