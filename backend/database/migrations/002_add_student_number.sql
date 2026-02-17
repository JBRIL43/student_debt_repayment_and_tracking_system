-- Add student_number to students table
ALTER TABLE students
ADD COLUMN student_number VARCHAR(50) UNIQUE;

CREATE INDEX idx_students_student_number ON students(student_number);
