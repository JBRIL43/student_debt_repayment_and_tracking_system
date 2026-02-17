-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Debt components table (semester-by-semester accrual)
CREATE TABLE IF NOT EXISTS debt_components (
    component_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    semester VARCHAR(20) NOT NULL,
    academic_year VARCHAR(9) NOT NULL,
    component_type VARCHAR(50) NOT NULL
        CHECK (component_type IN ('TUITION', 'LIVING_STIPEND', 'MEDICAL', 'OTHER')),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
    description TEXT,
    accrued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'UNPAID'
        CHECK (status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'WAIVED')),
    CONSTRAINT unique_student_semester_component
        UNIQUE (student_id, semester, component_type)
);

CREATE INDEX IF NOT EXISTS idx_debt_components_student_id ON debt_components(student_id);
CREATE INDEX IF NOT EXISTS idx_debt_components_type ON debt_components(component_type);
CREATE INDEX IF NOT EXISTS idx_debt_components_status ON debt_components(status);
CREATE INDEX IF NOT EXISTS idx_debt_components_due_date ON debt_components(due_date);

-- Payment allocations table (links payments to specific debt components)
CREATE TABLE IF NOT EXISTS payment_allocations (
    allocation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id INTEGER NOT NULL REFERENCES payment_history(payment_id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES debt_components(component_id) ON DELETE CASCADE,
    allocated_amount DECIMAL(10, 2) NOT NULL CHECK (allocated_amount > 0),
    allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_component_id ON payment_allocations(component_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON payment_allocations(payment_id);

-- Extend payment_requests for semester-specific approvals
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS requested_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS semester VARCHAR(20),
  ADD COLUMN IF NOT EXISTS academic_year VARCHAR(9),
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS component_type VARCHAR(50)
    CHECK (component_type IN ('TUITION', 'LIVING_STIPEND', 'MEDICAL', 'OTHER'));

-- View: Current debt summary per student
CREATE OR REPLACE VIEW student_debt_summary AS
SELECT
    s.student_id,
    u.full_name,
    u.email,
    d.department_name,
    COALESCE(SUM(CASE WHEN dc.status IN ('UNPAID', 'PARTIALLY_PAID') THEN dc.amount ELSE 0 END), 0) AS total_unpaid,
    COALESCE(SUM(CASE WHEN dc.status = 'PARTIALLY_PAID' THEN dc.amount ELSE 0 END), 0) AS partially_paid,
    COALESCE(SUM(dc.amount), 0) AS total_debt_ever,
    COUNT(CASE WHEN dc.status = 'UNPAID' THEN 1 END) AS unpaid_components_count,
    MIN(dc.due_date) AS next_due_date
FROM students s
JOIN users u ON s.user_id = u.user_id
JOIN departments d ON s.department_id = d.department_id
LEFT JOIN debt_components dc ON s.student_id = dc.student_id
WHERE u.is_active = TRUE
GROUP BY s.student_id, u.full_name, u.email, d.department_name;
