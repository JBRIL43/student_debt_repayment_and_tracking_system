# Backend API — Student Debt Management System

**Updated:** 2026-02-07
**Location:** /home/jj/flutter/std_debt/backend/api

## Purpose
Node.js/Express API that connects the Flutter app and admin dashboard to PostgreSQL. Authentication uses Firebase ID tokens and issues backend JWTs.

## Tech Stack
- Node.js, Express
- PostgreSQL (`pg`)
- Firebase Admin (ID token verification)
- JWT for API auth

## Key Files
- [backend/api/server.js](../backend/api/server.js) — Express setup and routes
- [backend/api/controllers/authController.js](../backend/api/controllers/authController.js) — Firebase ID token login, JWT issuance
- [backend/api/controllers/debtController.js](../backend/api/controllers/debtController.js) — debt balance, unpaid components, mock payment
- [backend/api/controllers/paymentController.js](../backend/api/controllers/paymentController.js) — payment request creation
- [backend/api/controllers/adminController.js](../backend/api/controllers/adminController.js) — admin CRUD, stats, SSE stream
- [backend/api/routes](../backend/api/routes) — auth, admin, debt, payment

## Required Environment
All variables are defined in [backend/api/.env](../backend/api/.env):
- Database: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Auth: `JWT_SECRET`, `JWT_EXPIRES_IN`, Firebase Admin keys
- Payments: Chapa keys + callback URL
- CORS: `CLIENT_URL`, `MOBILE_APP_URL`

## Important Endpoints
### Auth
- `POST /api/auth/login` — Firebase ID token → JWT

### Debt
- `GET /api/debt/balance` — Student debt summary
- `GET /api/debt/components` — Unpaid components by type
- `POST /api/debt/mock-pay` — Mock payment (deducts DB balance)

### Payments
- `POST /api/payments/request` — Payment request (semester-based)

### Admin
- `GET /api/admin/stats` — Dashboard metrics
- `GET /api/admin/debt-details` — Per-student debt table
- `GET /api/admin/stream` — SSE stream for real-time updates
- `PATCH /api/admin/users/:id` — Update user details
- `PATCH /api/admin/users/:id/password` — Reset password
- `POST /api/admin/users` — Create users (students/staff)
- `GET /api/admin/users` — List users
- `POST /api/admin/students` — Create students
- `GET /api/admin/students` — List students
- `DELETE /api/admin/users/:id` — Delete user
- `DELETE /api/admin/students/:id` — Delete student

## SSE Real-Time Stream
The admin dashboard subscribes to `/api/admin/stream` and receives:
- `stats` (collections, outstanding debt, pending approvals/verifications)
- `students` (debt detail table rows)
- `notifications` (payment + registration events)

## Login Flow
1) Flutter app authenticates via Firebase Auth and gets an ID token.
2) The app sends the ID token to `POST /api/auth/login`.
3) Backend validates token, links `users.firebase_uid`, and returns a JWT.
4) The JWT is used for subsequent API requests.

## Run
```bash
cd /home/jj/flutter/std_debt/backend/api
node server.js
```

## Health Check
- `GET /api/health` — verifies server and environment

## Notes
- Ensure PostgreSQL is running and matches [backend/api/.env](../backend/api/.env).
- Ensure Firebase Admin credentials are configured.
