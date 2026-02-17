CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sis_import_batches (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    imported_by INTEGER REFERENCES users(user_id),
    import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_name VARCHAR(255),
    file_size_bytes BIGINT,
    student_count INTEGER NOT NULL DEFAULT 0,
    total_debt_imported DECIMAL(12, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'COMPLETED'
        CHECK (status IN ('COMPLETED', 'FAILED', 'PARTIAL')),
    error_log TEXT,
    notes TEXT
);

ALTER TABLE student_sis_data
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES sis_import_batches(batch_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS department_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS faculty VARCHAR(255),
  ADD COLUMN IF NOT EXISTS batch_year INTEGER,
  ADD COLUMN IF NOT EXISTS tuition_base_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_student_sis_batch'
  ) THEN
    CREATE INDEX idx_student_sis_batch ON student_sis_data(batch_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_student_sis_student_id'
  ) THEN
    CREATE INDEX idx_student_sis_student_id ON student_sis_data(sis_student_id);
  END IF;
END $$;
