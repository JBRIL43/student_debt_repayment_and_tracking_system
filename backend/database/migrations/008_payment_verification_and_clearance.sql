-- Add finance verification fields to payment_requests
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS transaction_ref VARCHAR(255),
  ADD COLUMN IF NOT EXISTS receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS verified_by INTEGER REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;

-- Clearance letters (simulation)
ALTER TABLE clearance_letters
  ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(student_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS issued_by INTEGER REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_clearance_letters_student_id ON clearance_letters(student_id);
