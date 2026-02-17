# Student Debt Management System — Documentation Index

**Updated:** 2026-02-07

This folder contains ready-to-go documentation for each module. Use this file as the quick entry point for onboarding.

## Module Docs
- Database: [documentation/DATABASE.md](DATABASE.md)
- Backend API: [documentation/BACKEND_API.md](BACKEND_API.md)
- Flutter Mobile App: [documentation/FLUTTER_MOBILE.md](FLUTTER_MOBILE.md)
- Admin Dashboard: [documentation/ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md)

---

## Quick Start (Local)
1) **Database**
	- Start PostgreSQL and apply migrations. See [documentation/DATABASE.md](DATABASE.md).
2) **Backend API**
	- Configure [backend/api/.env](../backend/api/.env) and run the server. See [documentation/BACKEND_API.md](BACKEND_API.md).
3) **Admin Dashboard**
	- Install dependencies and run the Vite dev server. See [documentation/ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md).
4) **Flutter Mobile App**
	- Configure Firebase and run the app (use `adb reverse` for local backend). See [documentation/FLUTTER_MOBILE.md](FLUTTER_MOBILE.md).

---

## Ports and URLs (Defaults)
- Backend API: http://localhost:5000
- Admin Dashboard (Vite): http://localhost:5173
- Flutter App: runs on device/emulator and calls backend via `127.0.0.1` with `adb reverse`.

---

## Repository Map
- [backend/database](../backend/database) — PostgreSQL schema, migrations, seeds
- [backend/api](../backend/api) — Node.js/Express API
- [admin_dashboard](../admin_dashboard) — React + Vite admin UI
- [mobile_app/student_debt_app](../mobile_app/student_debt_app) — Flutter mobile app
- [documentation](.) — This documentation

---

## Environment Summary
Backend configuration lives in [backend/api/.env](../backend/api/.env) and includes:
- Database: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Auth: `JWT_SECRET`, `JWT_EXPIRES_IN`, Firebase Admin keys
- Payments: Chapa keys + callback URL
- CORS: `CLIENT_URL`, `MOBILE_APP_URL`

If you need a single combined PDF or an export-ready package, say the word and I’ll generate it.
