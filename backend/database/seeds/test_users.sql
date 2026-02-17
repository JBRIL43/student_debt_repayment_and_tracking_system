-- Insert test department (Computer Science)
INSERT INTO departments (department_name, faculty)
VALUES ('Computer Science', 'Computing & Informatics');

-- Insert test users with roles
INSERT INTO users (full_name, email, phone, role, firebase_uid, department_id) VALUES
  -- Student (will link to student record later)
  ('John Doe', 'student@hu.edu.et', '+251912345678', 'STUDENT', 'firebase_uid_student_123', NULL),

  -- Department Head (CS)
  ('Dr. Abebe Kebede', 'cshead@hu.edu.et', '+251923456789', 'DEPT_HEAD', 'firebase_uid_dept_456', 1),

  -- Finance Officer
  ('Tigist Worku', 'finance@hu.edu.et', '+251934567890', 'FINANCE_OFFICER', 'firebase_uid_finance_789', NULL),

  -- Registrar Admin
  ('Admin User', 'registrar@hu.edu.et', '+251945678901', 'REGISTRAR_ADMIN', 'firebase_uid_admin_012', NULL);

-- Insert test student record linked to user
INSERT INTO students (user_id, batch, department_id, enrollment_status)
VALUES (1, '2020', 1, 'ACTIVE');

-- Update user with student_id reference
UPDATE users SET student_id = 1 WHERE user_id = 1;

-- Insert test debt record
INSERT INTO debt_records (student_id, initial_amount, current_balance, updated_by)
VALUES (1, 5000.00, 3500.00, 4);
