# Admin Dashboard — Student Debt Management System

**Updated:** 2026-02-07
**Location:** /home/jj/flutter/std_debt/admin_dashboard

## Purpose
React + Vite admin dashboard for managing users, students, and monitoring debt statistics with live updates.

## Tech Stack
- React 19
- Vite 7
- TypeScript

## Key Files
- [admin_dashboard/src/components/Dashboard.tsx](../admin_dashboard/src/components/Dashboard.tsx)
  - Live stats, per-student debt table, SSE notifications
- [admin_dashboard/src/components/UserListPage.tsx](../admin_dashboard/src/components/UserListPage.tsx)
  - Edit user details, reset password, delete
- [admin_dashboard/src/components/AddUserPage.tsx](../admin_dashboard/src/components/AddUserPage.tsx)
  - Create users (students/staff)
- [admin_dashboard/src/App.tsx](../admin_dashboard/src/App.tsx)
  - Login persistence (Remember Me)

## Real-Time Features
- Notification bell with count + list updates on payment/registration
- SSE stream updates stats and student debt table every ~5 seconds

## Run
```bash
cd /home/jj/flutter/std_debt/admin_dashboard
npm install
npm run dev
```

## Notes
- Backend must be running to serve API data and SSE stream.
- CORS allowed origins are configured in [backend/api/.env](../backend/api/.env).
