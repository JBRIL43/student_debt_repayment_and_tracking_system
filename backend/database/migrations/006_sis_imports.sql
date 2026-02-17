CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sis_imports (
    import_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    imported_by INTEGER REFERENCES users(user_id),
    import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_name VARCHAR(255),
    student_count INTEGER,
    total_debt_imported DECIMAL(12, 2)
);

CREATE TABLE IF NOT EXISTS student_sis_data (
    student_id INTEGER PRIMARY KEY REFERENCES students(student_id) ON DELETE CASCADE,
    sis_student_id VARCHAR(50) UNIQUE,
    program_code VARCHAR(20),
    enrollment_date DATE,
    expected_graduation DATE,
    living_stipend_choice BOOLEAN DEFAULT TRUE,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
