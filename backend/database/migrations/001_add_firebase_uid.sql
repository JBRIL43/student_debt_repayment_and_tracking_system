-- Add firebase_uid column to users table (critical for sync)
ALTER TABLE users
ADD COLUMN firebase_uid VARCHAR(255) UNIQUE;

-- Create index for faster lookups
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);

-- Add department_id to users table (for dept heads)
ALTER TABLE users
ADD COLUMN department_id INTEGER REFERENCES departments(department_id);

-- Add student_id reference (for student users)
ALTER TABLE users
ADD COLUMN student_id INTEGER REFERENCES students(student_id);
