# Admin Dashboard (Hawassa University Student Debt System)

A lightweight React + TypeScript admin dashboard to create student accounts and manage recent entries.

## Features
- Admin login (dev-only): `adminstudent@hu.edu.et` / `admin123`
- Create student form (email, full name, student number, department, temp password)
- Recent students list (local session)
- Optional backend sync via `POST /api/admin/students`

## Configuration
- API base URL is read from `VITE_API_BASE_URL` (defaults to `/api`).
- Dev proxy is configured in `vite.config.ts` to forward `/api` → `http://localhost:5000`.

## Development
```bash
npm install
npm run dev
```

## Backend Integration (expected)
The UI sends a request to:
```
POST /api/admin/students
{
  "fullName": "Alemu Bekele",
  "email": "student2@hu.edu.et",
  "studentNumber": "HU2026CS001",
  "department": "Computer Science",
  "password": "Temp@123"
}
```
If the API is unavailable, the student is saved locally and a warning is shown.
