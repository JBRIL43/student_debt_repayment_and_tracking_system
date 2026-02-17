# Hawassa University Student Debt Repayment & Tracking System

## 1. Executive Summary
This document provides the official university-level documentation for the Hawassa University Student Debt Repayment & Tracking System. The system digitizes student debt tracking, payment requests, verification, and clearance readiness, aligned with Ethiopia’s cost‑sharing policy and semester‑based debt components. The platform consists of:
- **Backend API** (Node.js/Express + PostgreSQL)
- **Mobile Student App** (Flutter)
- **Admin & Staff Dashboard** (React/Vite)

## 2. Objectives
- Maintain accurate student debt records (semester‑based components).
- Enable transparent payment requests and verification.
- Provide real‑time administrative insight (stats, audit trail).
- Support clearance issuance only when balance is zero.
- Enforce role‑based access (student, department head, finance officer, registrar, admin).

## 3. Scope
### In Scope
- Student debt components by semester and type.
- Student payment request submission.
- Finance verification and payment history tracking.
- Registrar clearance issuance for zero‑balance students.
- Admin user management (create, edit, reset password, delete).

### Out of Scope (Current Phase)
- Full multi‑role approval UI in admin dashboard (buttons removed per request).
- Automated payment gateways in production (mocked where applicable).
- Production identity federation and SSO.

## 4. Stakeholders & Roles
- **Student**: View debt, submit payment requests, see history.
- **Department Head**: Review requests for their department.
- **Finance Officer**: Verify payments, upload receipts, update balances.
- **Registrar Admin**: Issue clearance letters for zero‑balance students.
- **System Admin**: Manage all users and roles, view dashboard analytics.

## 5. System Architecture
### High‑Level Components
- **Frontend (Admin Dashboard)**: React + Vite for staff/admin operations.
- **Mobile App**: Flutter app for student access.
- **Backend API**: Node/Express services and PostgreSQL database.
- **Authentication**: Firebase Authentication for staff and students, JWT for backend session.

### Data Flow Summary
1. Student logs in → receives JWT from backend after Firebase verification.
2. Student requests payment → stored in `payment_requests`.
3. Staff verifies payment → recorded in `payment_history`, `debt_records` updated.
4. Registrar issues clearance → `clearance_letters` PDF generated.

## 6. Database Design (Key Tables)
- **users**: All system users and roles.
- **students**: Student profile linked to users.
- **departments**: Departments and faculties.
- **debt_records**: Legacy total balance per student.
- **debt_components**: Semester‑based debt components by type.
- **payment_requests**: Student payment requests with status tracking.
- **payment_history**: Verified payment audit trail.
- **payment_allocations**: Links payment history to specific components.
- **clearance_letters**: Issued clearance PDFs and metadata.
- **audit_logs**: Admin/finance/registrar actions.

## 7. API Overview
### Authentication
- `POST /api/auth/login` – Verify Firebase ID token and issue JWT.

### Student Debt
- `GET /api/debt/balance` – Current debt summary + components + history.
- `GET /api/debt/components` – Unpaid component list by type.
- `POST /api/debt/mock-pay` – Demo payment deduction.

### Payments
- `POST /api/payments/request` – Create payment request (semester + component).

### Admin
- `POST /api/admin/students` – Create student + debt record.
- `GET /api/admin/students` – List students.
- `GET /api/admin/users` – List users (all roles).
- `PATCH /api/admin/users/:userId/password` – Reset user password.
- `PATCH /api/admin/users/password-by-email` – Reset by email (bootstrap Firebase).
- `PATCH /api/admin/users/:userId` – Edit user profile.
- `DELETE /api/admin/users/:userId` – Delete user and cleanup references.
- `GET /api/admin/stats` – Dashboard stats.
- `GET /api/admin/debt-details` – Student debt summary.
- `GET /api/admin/stream` – SSE real‑time dashboard updates.

### Workflow (Role‑Based)
- Department: `/api/workflow/department/*`
- Finance: `/api/workflow/finance/*`
- Registrar: `/api/workflow/registrar/*`

## 8. Admin Dashboard Features
- Dashboard stats (collections, outstanding debt).
- User management (create/edit/reset/delete).
- Notifications feed (payments, registrations).
- Role‑based staff login via Firebase.

## 9. Student Mobile App Features
- Debt summary and progress.
- Semester component breakdown.
- Payment request form.
- Payment history and status updates.

## 10. Security & Compliance
- **Role‑Based Access Control (RBAC)** enforced via JWT.
- **Firebase Authentication** for staff/student identity.
- **Audit logs** for sensitive actions (approval/verification/clearance).
- **Data Integrity**: FK constraints and server‑side validation.

## 11. Deployment & Operations
### Backend
- Node.js + PostgreSQL.
- Required env variables in `backend/api/.env`.

### Admin Dashboard
- Vite build deployment (static hosting).
- Requires Firebase web config.

### Mobile App
- Flutter app with Firebase config per platform.

## 12. Setup Guide (Local)
### Backend
1. Install dependencies in `backend/api`.
2. Configure `.env`.
3. Run migrations in `backend/database/migrations`.
4. Start server: `node server.js`.

### Admin Dashboard
1. Install dependencies in `admin_dashboard`.
2. Run: `npm run dev`.

### Mobile App
1. Run: `flutter pub get`.
2. Start app: `flutter run`.

## 13. Known Limitations
- Approval/verification UI buttons are temporarily removed (per request).
- Automated payment gateway integration not finalized.

## 14. Change Log (Summary)
- Added semester‑based debt components and payment allocations.
- Implemented admin stats and SSE updates.
- Added payment request creation and mock payment handling.
- Added clearance letter generation and PDF storage.
- Implemented Firebase + JWT login for staff.

## 15. Future Enhancements
- Reinstate approval/verification UI with complete multi‑role workflow.
- Integrate Chapa and bank transfer reconciliation.
- Add analytics exports for finance and registrar.

---
**Document Owner:** Hawassa University ICT Directorate
**Last Updated:** 2026‑02‑09
