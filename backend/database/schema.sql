-- Users table (all roles: students, dept heads, finance officers)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL CHECK (role IN ('STUDENT', 'DEPT_HEAD', 'FINANCE_OFFICER', 'REGISTRAR_ADMIN')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Departments table
CREATE TABLE departments (
    department_id SERIAL PRIMARY KEY,
    department_name VARCHAR(255) NOT NULL,
    faculty VARCHAR(255)
);

-- Students table (extends users)
CREATE TABLE students (
    student_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    batch VARCHAR(20),
    department_id INTEGER REFERENCES departments(department_id),
    enrollment_status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (enrollment_status IN ('ACTIVE', 'WITHDRAWN', 'GRADUATED'))
);

-- Debt Records table
CREATE TABLE debt_records (
    debt_id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(student_id) ON DELETE CASCADE,
    initial_amount DECIMAL(10, 2) NOT NULL,
    current_balance DECIMAL(10, 2) NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(user_id)
);

-- Payment Requests table
CREATE TABLE payment_requests (
    request_id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(student_id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'VERIFIED')),
    requested_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by INTEGER REFERENCES users(user_id),
    approval_date TIMESTAMP
);

-- Payments table
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES payment_requests(request_id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('CHAPA', 'RECEIPT', 'BANK_TRANSFER')),
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
    transaction_ref VARCHAR(255),
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Receipts table (for manual verification)
CREATE TABLE receipts (
    receipt_id SERIAL PRIMARY KEY,
    payment_id INTEGER REFERENCES payments(payment_id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN DEFAULT FALSE,
    verified_by INTEGER REFERENCES users(user_id),
    verification_date TIMESTAMP
);

-- Clearance Letters table
CREATE TABLE clearance_letters (
    letter_id SERIAL PRIMARY KEY,
    debt_id INTEGER REFERENCES debt_records(debt_id) ON DELETE CASCADE,
    issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    content TEXT,
    file_url TEXT
);

-- Create essential indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_debt_records_student_id ON debt_records(student_id);
CREATE INDEX idx_payment_requests_student_id ON payment_requests(student_id);
CREATE INDEX idx_payment_requests_status ON payment_requests(status);
CREATE INDEX idx_payments_request_id ON payments(request_id);
