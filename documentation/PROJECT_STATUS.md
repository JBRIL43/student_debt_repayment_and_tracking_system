# Student Debt Management System — Project Documentation

**Updated:** 2026-02-07
**Workspace:** /home/jj/flutter/std_debt

This document summarizes the current state of the project: database, backend API, Flutter mobile app, and admin dashboard. It is intended as a ready-to-go overview for onboarding and maintenance.

---

## 1) Database (PostgreSQL)

### Core Tables
- **users**: all roles (students, department heads, finance, registrar admin)
- **students**: extends users with student-specific fields
- **departments**: department lookup
- **debt_records**: legacy aggregate debt per student
- **payment_history**: audit trail of payments
- **payment_requests**: approvals workflow (extended for semester-specific requests)
- **receipts**: payment receipt verification

### Semester-Based Debt Model
- **debt_components**: semester-by-semester accrual of debt (tuition, stipend, etc.)
- **payment_allocations**: links payment_history to specific components
- **student_debt_summary** view: aggregated per-student totals

### Key Migrations/Seeds
- Migration: **backend/database/migrations/003_add_payment_history.sql**
- Migration: **backend/database/migrations/004_create_debt_components.sql**
- Seed: **backend/database/seeds/cs_student_debt.sql** (uses student number)

### Notes
- `debt_components` is used when present; falls back to `debt_records` for students without components.
- Default initial/current debt for newly created students: **ETB 133,000.00**

---

## 2) Backend API (Node.js/Express)

### Key Files
- **backend/api/server.js**: Express setup and routes
- **backend/api/controllers/authController.js**: Firebase ID token login, JWT issuance
- **backend/api/controllers/debtController.js**: debt balance, unpaid components, mock payment
- **backend/api/controllers/paymentController.js**: payment request creation (semester-based)
- **backend/api/controllers/adminController.js**: admin CRUD, stats, SSE stream
- **backend/api/routes/**: auth, admin, debt, payment

### Important Endpoints
- `POST /api/auth/login` — Firebase ID token → JWT
- `GET /api/debt/balance` — Student debt summary
- `GET /api/debt/components` — Unpaid components by type
- `POST /api/debt/mock-pay` — Mock payment (deducts DB balance)
- `POST /api/payments/request` — Payment request (semester-based)

**Admin:**
- `GET /api/admin/stats` — Dashboard metrics
- `GET /api/admin/debt-details` — Per-student debt table
- `GET /api/admin/stream` — SSE stream for real-time dashboard updates
- `PATCH /api/admin/users/:id` — Update user details
- `PATCH /api/admin/users/:id/password` — Reset password (auto-link Firebase UID)
- `POST /api/admin/users` — Create users (students/staff)
- `GET /api/admin/users` — List users
- `POST /api/admin/students` — Create students
- `GET /api/admin/students` — List students
- `DELETE /api/admin/users/:id` — Delete user
- `DELETE /api/admin/students/:id` — Delete student

### SSE Real-Time Stream
The admin dashboard subscribes to `/api/admin/stream` and receives:
- `stats` (collections, outstanding debt, pending approvals/verifications)
- `students` (debt detail table rows)
- `notifications` (payment + registration events)

---

## 3) Flutter Mobile App

### Key Files
- **lib/services/auth_service.dart**: auth + API base URL
- **lib/services/debt_service.dart**: debt API + mock pay
- **lib/models/debt_model.dart**: supports component totals + unpaid components
- **lib/screens/home_screen.dart**: dashboard UI (greeting, debt card, progress ring, actions)
- **lib/screens/payment_screen.dart**: payment plan selection + method picker
- **lib/widgets/payment_request_form.dart**: request approval dialog

### Key Behaviors
- **API base URL** uses `127.0.0.1` for Android device with `adb reverse`.
- Home dashboard shows: greeting, total remaining, progress ring, status, quick actions.
- Bottom navigation tabs: Home, Payments, Profile, Notifications.
- Payment screen includes the same bottom navigation.
- Mock payment updates DB and shows a toast with the new balance.
- Home refreshes after returning from Payment screen.

---

## 4) Admin Dashboard (React + Vite)

### Key Files
- **admin_dashboard/src/components/Dashboard.tsx**
  - Live stats, per-student debt table, SSE notifications
- **admin_dashboard/src/components/UserListPage.tsx**
  - Edit user details, reset password, delete
- **admin_dashboard/src/components/AddUserPage.tsx**
  - Create users (students/staff)
- **admin_dashboard/src/App.tsx**
  - Login persistence (Remember Me)

### Real-Time Features
- Notification bell with count + list updates on payment/registration
- SSE stream updates stats and student debt table every ~5 seconds

---

## 5) Recent User Scenarios

### Students
- **Jibril Nuredin**: updated to ETB 133,000 initial; paid in full shows “Payment completed”
- **Numan Fadil Khedir**: Information System, student number NaScR/0815/15, zero balance
- **Noah Daniel**: NaScR/0111/15, half paid (66,500 remaining)

---

## 6) Known Workflows

### Login Flow
- Flutter app logs in via Firebase Auth → ID token → backend JWT.
- Backend uses `users.firebase_uid` and sets `studentId` in JWT.

### Payment Flow (Mock)
- Payment screen triggers `/api/debt/mock-pay`.
- Backend deducts `debt_records.current_balance` and adds `payment_history` entry.

### Admin Dashboard Flow
- Admin logs in locally; dashboard fetches stats + debt details.
- SSE keeps dashboard in sync as students pay.

---

## 7) How to Run (Quick)

### Backend
```bash
cd /home/jj/flutter/std_debt/backend/api
node server.js
```

### Flutter (Device)
```bash
adb reverse tcp:5000 tcp:5000
flutter run
```

### Admin Dashboard
```bash
cd /home/jj/flutter/std_debt/admin_dashboard
npm run dev
```

---

## 8) Notes / Caveats
- Ensure PostgreSQL is running (`systemctl start postgresql`).
- When using a physical Android device, keep `adb reverse` active.
- Admin dashboard requires correct admin credentials from `.env`.

---

If you need a separate README per module, let me know and I’ll split this into individual files.
