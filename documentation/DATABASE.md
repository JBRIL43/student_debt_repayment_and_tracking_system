# Database — Student Debt Management System

**Updated:** 2026-02-07
**Location:** /home/jj/flutter/std_debt/backend/database

## Purpose
PostgreSQL schema for users, students, departments, debts, payments, and audit trails. The system supports both a legacy aggregate debt table and a semester-based component model (preferred by the current app).

## Core Entities
- **users**: all roles (students, department heads, finance, registrar admin)
- **students**: student-specific profile and identifiers
- **departments**: department lookup
- **debt_records**: legacy aggregate debt per student
- **payment_history**: audit trail of payments
- **payment_requests**: approvals workflow (semester-based requests)
- **receipts**: receipt verification

## Semester-Based Debt Model
- **debt_components**: per-semester accrual (tuition, stipend, etc.)
- **payment_allocations**: links `payment_history` to components
- **student_debt_summary** (view): aggregated totals per student

## Migrations and Seeds
- Migrations: [backend/database/migrations](../backend/database/migrations)
- Seeds: [backend/database/seeds](../backend/database/seeds)

## Local Setup (Summary)
1) Start PostgreSQL.
2) Create the database and user configured in [backend/api/.env](../backend/api/.env).
3) Apply schema and migrations from [backend/database/migrations](../backend/database/migrations).
4) (Optional) Load seed data from [backend/database/seeds](../backend/database/seeds).

## Key Rules and Defaults
- `debt_components` is preferred when present; the API falls back to `debt_records`.
- Default initial/current debt for newly created students: **ETB 133,000.00**.

## Operational Notes
- All API reads rely on the PostgreSQL connection configured in [backend/api/.env](../backend/api/.env).
- The view `student_debt_summary` powers aggregate totals for dashboard metrics.
