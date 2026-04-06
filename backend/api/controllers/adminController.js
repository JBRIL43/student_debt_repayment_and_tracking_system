const admin = require('../firebase-admin');
const { calculateSemesterComponents } = require('../services/debtCalculator');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const DEFAULT_INITIAL_DEBT = 133000.0;

const normalize = (value) => (value || '').trim();

// Helper: retry Firebase createUser on transient network timeouts
const createUserWithRetry = async (userData, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await admin.auth().createUser({
        email: userData.email,
        password: userData.password,
        displayName: userData.name || userData.displayName || userData.fullName,
      });
    } catch (error) {
      const code = error && (error.code || (error.errorInfo && error.errorInfo.code));
      const isTimeout = code === 'app/network-timeout' || String(error).toLowerCase().includes('timeout');
      if (isTimeout && i < retries - 1) {
        console.log(`CreateUser timeout attempt ${i + 1}, retrying...`);
        await new Promise((res) => setTimeout(res, 3000));
        continue;
      }
      throw error;
    }
  }
};

const getAdminCredentials = () => ({
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
});

const getStaffCredentials = () => ({
  Admin: {
    email: process.env.ADMIN_EMAIL || 'adminstudent@hu.edu.et',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },
  'Finance Officer': {
    email: process.env.FINANCE_EMAIL || 'finance@hu.edu.et',
    password: process.env.FINANCE_PASSWORD || 'Finance@2026',
  },
  Registrar: {
    email: process.env.REGISTRAR_EMAIL || 'registrar@hu.edu.et',
    password: process.env.REGISTRAR_PASSWORD || 'Registrar@2026',
  },
  'Department Head': {
    email: process.env.DEPARTMENT_EMAIL || 'cshead@hu.edu.et',
    password: process.env.DEPARTMENT_PASSWORD || 'Dept@2026',
  },
});

const isValidAdmin = (email, password) => {
  const creds = getAdminCredentials();
  return !!creds.email && !!creds.password && email === creds.email && password === creds.password;
};

const fetchDashboardStats = async () => {
  const totalCollectionsResult = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM payment_history
     WHERE status = 'SUCCESS'`
  );

  const outstandingDebtResult = await pool.query(
    `WITH component_remaining AS (
      SELECT
        student_id,
        SUM(CASE WHEN status IN ('UNPAID', 'PARTIALLY_PAID') THEN amount ELSE 0 END) AS remaining
      FROM debt_components
      GROUP BY student_id
    ),
    records_without_components AS (
      SELECT dr.student_id, dr.current_balance
      FROM debt_records dr
      LEFT JOIN component_remaining cr ON cr.student_id = dr.student_id
      WHERE cr.student_id IS NULL
    )
    SELECT
      COALESCE((SELECT SUM(remaining) FROM component_remaining), 0) +
      COALESCE((SELECT SUM(current_balance) FROM records_without_components), 0) AS total`
  );

  const pendingApprovalsResult = await pool.query(
    `SELECT COUNT(*) AS count
     FROM payment_requests
     WHERE status = 'PENDING'`
  );

  const pendingVerificationsResult = await pool.query(
    `SELECT COUNT(*) AS count
     FROM payment_requests
     WHERE status = 'PENDING'`
  );

  return {
    totalCollections: parseFloat(totalCollectionsResult.rows[0].total),
    outstandingDebt: parseFloat(outstandingDebtResult.rows[0].total),
    pendingApprovals: parseInt(pendingApprovalsResult.rows[0].count, 10),
    pendingVerifications: parseInt(pendingVerificationsResult.rows[0].count, 10),
  };
};

const fetchStudentDebtDetails = async () => {
  const result = await pool.query(
    `SELECT
       s.student_id,
       s.student_number,
       s.batch,
       u.full_name,
       u.email,
       d.department_name,
      COALESCE(dr.initial_amount, dc.total_debt, 0) AS total_debt,
       COALESCE(dc.remaining, dr.current_balance, 0) AS current_balance
     FROM students s
     JOIN users u ON u.user_id = s.user_id
     LEFT JOIN departments d ON d.department_id = s.department_id
     LEFT JOIN debt_records dr ON dr.student_id = s.student_id
     LEFT JOIN (
       SELECT
         student_id,
         SUM(amount) AS total_debt,
         SUM(CASE WHEN status IN ('UNPAID', 'PARTIALLY_PAID') THEN amount ELSE 0 END) AS remaining
       FROM debt_components
       GROUP BY student_id
     ) dc ON dc.student_id = s.student_id
     WHERE u.is_active = TRUE
     ORDER BY u.created_at DESC
     LIMIT 500`
  );

  return result.rows;
};

const syncNotificationsFromEvents = async () => {
  await pool.query(
    `INSERT INTO admin_notifications (source_type, source_key, type, message, event_created_at)
     SELECT
       'PAYMENT' AS source_type,
       CONCAT('payment-', ph.payment_id) AS source_key,
       'PAYMENT' AS type,
       CONCAT(u.full_name, ' made a payment of ETB ', ph.amount) AS message,
       ph.payment_date AS event_created_at
     FROM payment_history ph
     JOIN debt_records dr ON dr.debt_id = ph.debt_id
     JOIN students s ON s.student_id = dr.student_id
     JOIN users u ON u.user_id = s.user_id
     WHERE ph.status = 'SUCCESS'
     ON CONFLICT (source_key)
     DO UPDATE SET
       message = EXCLUDED.message,
       event_created_at = EXCLUDED.event_created_at,
       updated_at = CURRENT_TIMESTAMP`
  );

  await pool.query(
    `INSERT INTO admin_notifications (source_type, source_key, type, message, event_created_at)
     SELECT
       'REGISTRATION' AS source_type,
       CONCAT('user-', u.user_id) AS source_key,
       'REGISTRATION' AS type,
       CONCAT(u.full_name, ' registered as a student') AS message,
       u.created_at AS event_created_at
     FROM users u
     WHERE u.role = 'STUDENT'
     ON CONFLICT (source_key)
     DO UPDATE SET
       message = EXCLUDED.message,
       event_created_at = EXCLUDED.event_created_at,
       updated_at = CURRENT_TIMESTAMP`
  );
};

const ensureAdminNotificationsTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS admin_notifications (
      notification_id BIGSERIAL PRIMARY KEY,
      source_type VARCHAR(50) NOT NULL,
      source_key VARCHAR(255) UNIQUE NOT NULL,
      type VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      event_created_at TIMESTAMP NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      is_deleted BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_admin_notifications_event_created_at
      ON admin_notifications(event_created_at DESC)`
  );

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_admin_notifications_status
      ON admin_notifications(is_deleted, is_read)`
  );
};

const fetchNotifications = async () => {
  await ensureAdminNotificationsTable();

  try {
    await syncNotificationsFromEvents();
  } catch (syncError) {
    const syncMessage = syncError instanceof Error ? syncError.message : String(syncError);
    console.warn('Notification sync skipped:', syncMessage);
  }

  const result = await pool.query(
    `SELECT
       notification_id::TEXT AS id,
       type,
       message,
       event_created_at AS created_at,
       is_read,
       is_deleted
     FROM admin_notifications
     WHERE COALESCE(is_deleted, FALSE) = FALSE
     ORDER BY event_created_at DESC
     LIMIT 50`
  );

  return result.rows;
};

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await fetchNotifications();
    return res.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ error: 'Failed to load notifications.' });
  }
};

exports.markNotificationRead = async (req, res) => {
  const notificationId = Number(req.params.notificationId);

  if (!notificationId) {
    return res.status(400).json({ error: 'Valid notification ID is required.' });
  }

  try {
    await ensureAdminNotificationsTable();

    const result = await pool.query(
      `UPDATE admin_notifications
       SET is_read = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE notification_id = $1
       RETURNING notification_id::TEXT AS id, is_read, is_deleted`,
      [notificationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    return res.json({ notification: result.rows[0] });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
};

exports.deleteNotification = async (req, res) => {
  const notificationId = Number(req.params.notificationId);

  if (!notificationId) {
    return res.status(400).json({ error: 'Valid notification ID is required.' });
  }

  try {
    await ensureAdminNotificationsTable();

    const result = await pool.query(
      `UPDATE admin_notifications
       SET is_deleted = TRUE,
           is_read = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE notification_id = $1
       RETURNING notification_id::TEXT AS id, is_read, is_deleted`,
      [notificationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    return res.json({ notification: result.rows[0] });
  } catch (error) {
    console.error('Delete notification error:', error);
    return res.status(500).json({ error: 'Failed to delete notification.' });
  }
};

exports.requireAdminAuth = (req, res, next) => {
  const adminEmail = req.headers['x-admin-email'];
  const adminPassword = req.headers['x-admin-password'];
  const creds = getAdminCredentials();

  if (!creds.email || !creds.password) {
    return res.status(500).json({ error: 'Admin credentials not configured on server.' });
  }

  if (adminEmail !== creds.email || adminPassword !== creds.password) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }

  return next();
};

exports.requireStaffAuth = (allowedRoles = ['Admin']) => (req, res, next) => {
  return (async () => {
    const staffEmail = normalize(req.headers['x-admin-email']).toLowerCase();
    const staffPassword = normalize(req.headers['x-admin-password']);
    const staffCreds = getStaffCredentials();

    const isAuthorizedByStaticCreds = allowedRoles.some((role) => {
      const creds = staffCreds[role];
      return creds && staffEmail === normalize(creds.email).toLowerCase() && staffPassword === normalize(creds.password);
    });

    if (isAuthorizedByStaticCreds) {
      return next();
    }

    const roleToDbRole = {
      'Department Head': 'DEPT_HEAD',
      'Finance Officer': 'FINANCE_OFFICER',
      Registrar: 'REGISTRAR_ADMIN',
    };

    const allowedDbRoles = allowedRoles
      .map((role) => roleToDbRole[role])
      .filter(Boolean);

    if (!staffEmail || !allowedDbRoles.length) {
      return res.status(401).json({ error: 'Invalid staff credentials.' });
    }

    try {
      const userResult = await pool.query(
        `SELECT user_id
         FROM users
         WHERE LOWER(email) = LOWER($1)
           AND role = ANY($2)
           AND is_active = TRUE
         LIMIT 1`,
        [staffEmail, allowedDbRoles]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid staff credentials.' });
      }

      return next();
    } catch (error) {
      console.error('Staff auth error:', error);
      return res.status(500).json({ error: 'Failed to validate staff credentials.' });
    }
  })();
};

exports.createStudent = async (req, res) => {
  const fullName = normalize(req.body.fullName);
  const email = normalize(req.body.email).toLowerCase();
  const studentNumber = normalize(req.body.studentNumber);
  const departmentName = normalize(req.body.department);
  const password = normalize(req.body.password);

  if (!fullName || !email || !studentNumber || !departmentName || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const client = await pool.connect();
  let firebaseUser = null;
  let firebaseWarning = null;

  try {
    await client.query('BEGIN');

    const existingUser = await client.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );
    if (existingUser.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already exists in the system.' });
    }

    const existingStudentNumber = await client.query(
      'SELECT student_id FROM students WHERE student_number = $1',
      [studentNumber]
    );
    if (existingStudentNumber.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Student number already exists.' });
    }

    const departmentResult = await client.query(
      'SELECT department_id FROM departments WHERE LOWER(department_name) = LOWER($1) LIMIT 1',
      [departmentName]
    );

    let departmentId = null;
    if (departmentResult.rows.length) {
      departmentId = departmentResult.rows[0].department_id;
    } else {
      const insertDept = await client.query(
        'INSERT INTO departments (department_name) VALUES ($1) RETURNING department_id',
        [departmentName]
      );
      departmentId = insertDept.rows[0].department_id;
    }

    try {
      firebaseUser = await createUserWithRetry({ email, password, name: fullName });
    } catch (firebaseError) {
      await client.query('ROLLBACK');
      console.error('Create student Firebase error:', firebaseError);
      return res.status(500).json({ error: 'Failed to create Firebase user', details: firebaseError.message });
    }

    const userResult = await client.query(
      `INSERT INTO users (full_name, email, role, is_active, firebase_uid, department_id)
       VALUES ($1, $2, 'STUDENT', TRUE, $3, $4)
       RETURNING user_id`,
      [fullName, email, firebaseUser ? firebaseUser.uid : null, departmentId]
    );

    const userId = userResult.rows[0].user_id;

    const studentResult = await client.query(
      `INSERT INTO students (user_id, department_id, student_number, enrollment_status)
       VALUES ($1, $2, $3, 'ACTIVE')
       RETURNING student_id`,
      [userId, departmentId, studentNumber]
    );

    const studentId = studentResult.rows[0].student_id;

    await client.query('UPDATE users SET student_id = $1 WHERE user_id = $2', [
      studentId,
      userId,
    ]);

    await client.query(
      `INSERT INTO debt_records (student_id, initial_amount, current_balance, updated_by)
       VALUES ($1, $2, $2, NULL)`,
      [studentId, DEFAULT_INITIAL_DEBT]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      warning: firebaseWarning,
      student: {
        studentId,
        userId,
        fullName,
        email,
        studentNumber,
        departmentId,
        departmentName,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (firebaseUser) {
      try {
        await admin.auth().deleteUser(firebaseUser.uid);
      } catch (cleanupError) {
        console.error('Failed to cleanup Firebase user:', cleanupError);
      }
    }

    console.error('Create student error:', error);
    return res.status(500).json({ error: 'Failed to create student', details: error.message });
  } finally {
    client.release();
  }
};

exports.listStudents = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         s.student_id,
         s.student_number,
         u.full_name,
         u.email,
         u.created_at,
         d.department_name
       FROM students s
       JOIN users u ON u.user_id = s.user_id
       LEFT JOIN departments d ON d.department_id = s.department_id
       WHERE u.is_active = TRUE
       ORDER BY u.created_at DESC
       LIMIT 200`
    );

    return res.json({
      success: true,
      students: result.rows,
    });
  } catch (error) {
    console.error('List students error:', error);
    return res.status(500).json({ error: 'Failed to fetch students', details: error.message });
  }
};

exports.resetStudentPassword = async (req, res) => {
  const studentId = Number(req.params.studentId);
  const newPassword = normalize(req.body.newPassword);

  if (!studentId || !newPassword) {
    return res.status(400).json({ error: 'Student ID and new password are required.' });
  }

  try {
    const result = await pool.query(
      `SELECT u.firebase_uid, u.email, u.full_name
       FROM students s
       JOIN users u ON u.user_id = s.user_id
       WHERE s.student_id = $1 AND u.is_active = TRUE`,
      [studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const { firebase_uid: firebaseUid, email, full_name: fullName } = result.rows[0];
    let resolvedUid = firebaseUid;

    // Resolve or create the Firebase user first. If this fails, abort.
    if (!resolvedUid) {
      try {
        const existing = await admin.auth().getUserByEmail(email);
        resolvedUid = existing.uid;
      } catch (lookupError) {
        try {
          const created = await createUserWithRetry({ email, password: newPassword, name: fullName });
          resolvedUid = created.uid;
        } catch (createError) {
          console.error('Reset student password Firebase create error:', createError);
          return res.status(500).json({ error: 'Failed to resolve or create Firebase user', details: createError.message });
        }
      }
    }

    try {
      await admin.auth().updateUser(resolvedUid, { password: newPassword });
    } catch (firebaseError) {
      console.error('Reset password Firebase error:', firebaseError);
      return res.status(500).json({ error: 'Failed to update Firebase password', details: firebaseError.message });
    }

    // Persist firebase_uid if it was missing
    if (!firebaseUid && resolvedUid) {
      try {
        await pool.query('UPDATE users SET firebase_uid = $1 WHERE email = $2', [resolvedUid, email]);
      } catch (dbErr) {
        console.error('Failed to save firebase_uid after password reset:', dbErr);
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password', details: error.message });
  }
};

exports.deleteStudent = async (req, res) => {
  const studentId = Number(req.params.studentId);

  if (!studentId) {
    return res.status(400).json({ error: 'Student ID is required.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT u.user_id, u.firebase_uid
       FROM students s
       JOIN users u ON u.user_id = s.user_id
       WHERE s.student_id = $1`,
      [studentId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Student not found.' });
    }

    const { user_id: userId, firebase_uid: firebaseUid } = result.rows[0];

    // Prevent deletion if student has outstanding debt or pending payments
    try {
      const pendingReq = await client.query(
        `SELECT COUNT(*) AS count FROM payment_requests WHERE student_id = $1 AND status IN ('PENDING','PROCESSING')`,
        [studentId]
      );
      const pendingCount = parseInt(pendingReq.rows[0].count, 10);

      const debtRecord = await client.query(
        `SELECT COALESCE(current_balance, 0) AS balance FROM debt_records WHERE student_id = $1 LIMIT 1`,
        [studentId]
      );
      const balance = debtRecord.rows.length ? parseFloat(debtRecord.rows[0].balance) : 0;

      const compReq = await client.query(
        `SELECT COUNT(*) AS count FROM debt_components WHERE student_id = $1 AND status IN ('UNPAID','PARTIALLY_PAID')`,
        [studentId]
      );
      const compCount = parseInt(compReq.rows[0].count, 10);

      if (pendingCount > 0 || balance > 0 || compCount > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot delete student while they have outstanding debt or pending payments.' });
      }

    } catch (checkErr) {
      await client.query('ROLLBACK');
      console.error('Failed to verify student payment state before delete:', checkErr);
      return res.status(500).json({ error: 'Failed to verify student payment state', details: checkErr.message });
    }

    // Clear FK reference first to avoid users.student_id constraint
    await client.query('UPDATE users SET student_id = NULL WHERE user_id = $1', [userId]);

    // Deleting the student will cascade to dependent tables (debt_records, payment_requests, etc.)
    await client.query('DELETE FROM students WHERE student_id = $1', [studentId]);
    await client.query('DELETE FROM users WHERE user_id = $1', [userId]);

    // Attempt to delete Firebase user before committing; if it fails, rollback.
    if (firebaseUid) {
      try {
        await admin.auth().deleteUser(firebaseUid);
      } catch (firebaseError) {
        await client.query('ROLLBACK');
        console.error('Failed to delete Firebase user:', firebaseError);
        return res.status(500).json({ error: 'Failed to delete Firebase user', details: firebaseError.message });
      }
    }

    await client.query('COMMIT');

    return res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete student error:', error);
    return res.status(500).json({ error: 'Failed to delete student', details: error.message });
  } finally {
    client.release();
  }
};

exports.listUsers = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         u.user_id,
         u.full_name,
         u.email,
         u.role,
         u.created_at,
         u.department_id,
         u.student_id,
         s.student_number,
         d.department_name
       FROM users u
       LEFT JOIN students s ON s.student_id = u.student_id
       LEFT JOIN departments d ON d.department_id = u.department_id
       WHERE u.is_active = TRUE
       ORDER BY u.created_at DESC
       LIMIT 500`
    );

    return res.json({
      success: true,
      users: result.rows,
    });
  } catch (error) {
    console.error('List users error:', error);
    return res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
};

exports.getDashboardStats = async (_req, res) => {
  try {
    const stats = await fetchDashboardStats();
    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({
      error: 'Failed to fetch dashboard stats',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.getStudentDebtDetails = async (_req, res) => {
  try {
    const rows = await fetchStudentDebtDetails();

    return res.json({
      success: true,
      students: rows,
    });
  } catch (error) {
    console.error('Student debt details error:', error);
    return res.status(500).json({
      error: 'Failed to fetch student debt details',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const resolveDepartmentHead = async (staffEmail) => {
  const requesterResult = await pool.query(
    `SELECT u.user_id, u.role, u.department_id, d.department_name
     FROM users u
     LEFT JOIN departments d ON d.department_id = u.department_id
     WHERE LOWER(u.email) = LOWER($1)
       AND u.is_active = TRUE
     LIMIT 1`,
    [staffEmail]
  );

  if (requesterResult.rows.length === 0) {
    return { error: `Department head account not found for ${staffEmail}. Ensure this email exists in users with role DEPT_HEAD and an assigned department.`, status: 404 };
  }

  const requester = requesterResult.rows[0];
  const normalizedRole = normalize(requester.role)
    .toUpperCase()
    .replace(/\s+/g, '_');

  if (normalizedRole !== 'DEPT_HEAD' && normalizedRole !== 'DEPARTMENT_HEAD') {
    return { error: 'Only department heads can access this resource.', status: 403 };
  }

  if (!requester.department_id) {
    return { error: 'Department head is not assigned to a department.', status: 400 };
  }

  return { requester };
};

exports.getDepartmentStudents = async (req, res) => {
  const staffEmail = normalize(req.headers['x-admin-email']).toLowerCase();

  if (!staffEmail) {
    return res.status(400).json({ error: 'Staff email header is required.' });
  }

  try {
    const { requester, error, status } = await resolveDepartmentHead(staffEmail);
    if (!requester) {
      return res.status(status).json({ error });
    }

    const studentsResult = await pool.query(
      `SELECT
         s.student_id,
         s.student_number,
         u.full_name,
         u.email,
         d.department_name,
         COALESCE(dr.current_balance, 0) AS current_balance
       FROM students s
       JOIN users u ON u.user_id = s.user_id
       LEFT JOIN departments d ON d.department_id = s.department_id
       LEFT JOIN debt_records dr ON dr.student_id = s.student_id
       WHERE u.is_active = TRUE
         AND s.department_id = $1
       ORDER BY u.full_name ASC
       LIMIT 500`,
      [requester.department_id]
    );

    return res.json({
      success: true,
      department: requester.department_name,
      students: studentsResult.rows,
    });
  } catch (error) {
    console.error('Department students error:', error);
    return res.status(500).json({ error: 'Failed to fetch department students', details: error.message });
  }
};

exports.getDepartmentPaymentRequests = async (req, res) => {
  const staffEmail = normalize(req.headers['x-admin-email']).toLowerCase();

  if (!staffEmail) {
    return res.status(400).json({ error: 'Staff email header is required.' });
  }

  try {
    const { requester, error, status } = await resolveDepartmentHead(staffEmail);
    if (!requester) {
      return res.status(status).json({ error });
    }

    const result = await pool.query(
      `SELECT
         pr.request_id,
         pr.student_id,
         pr.requested_amount,
         pr.payment_method,
         pr.semester,
         pr.academic_year,
         pr.component_type,
         pr.requested_at,
         pr.status,
         CASE
           WHEN pr.status = 'PENDING' THEN 'PENDING_DEPT_REVIEW'
           WHEN pr.status = 'APPROVED' THEN 'APPROVED_BY_DEPT'
           WHEN pr.status = 'VERIFIED' THEN 'VERIFIED_BY_FINANCE'
           WHEN pr.status = 'REJECTED' THEN 'REJECTED'
           ELSE 'UNKNOWN'
         END AS workflow_stage,
         u.full_name,
         u.email,
         s.student_number,
         s.enrollment_status,
         d.department_name
       FROM payment_requests pr
       JOIN students s ON s.student_id = pr.student_id
       JOIN users u ON u.user_id = s.user_id
       LEFT JOIN departments d ON d.department_id = s.department_id
       WHERE s.department_id = $1
         AND pr.status = 'PENDING'
       ORDER BY pr.requested_at DESC NULLS LAST, pr.requested_date DESC
       LIMIT 200`,
      [requester.department_id]
    );

    return res.json({
      success: true,
      department: requester.department_name,
      requests: result.rows,
    });
  } catch (error) {
    console.error('Department payment requests error:', error);
    return res.status(500).json({ error: 'Failed to fetch department payment requests', details: error.message });
  }
};

exports.approveDepartmentEnrollment = async (req, res) => {
  const staffEmail = normalize(req.headers['x-admin-email']).toLowerCase();
  const requestId = Number(req.params.requestId);

  if (!staffEmail) {
    return res.status(400).json({ error: 'Staff email header is required.' });
  }

  if (!requestId) {
    return res.status(400).json({ error: 'requestId is required.' });
  }

  const client = await pool.connect();
  try {
    const { requester, error, status } = await resolveDepartmentHead(staffEmail);
    if (!requester) {
      return res.status(status).json({ error });
    }

    await client.query('BEGIN');

    const reqResult = await client.query(
      `SELECT pr.request_id, pr.student_id, pr.status, s.department_id, s.enrollment_status
       FROM payment_requests pr
       JOIN students s ON s.student_id = pr.student_id
       WHERE pr.request_id = $1
       FOR UPDATE`,
      [requestId]
    );

    if (!reqResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment request not found.' });
    }

    const paymentRequest = reqResult.rows[0];

    if (paymentRequest.department_id !== requester.department_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only approve requests from your own department.' });
    }

    if (paymentRequest.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only pending requests can be approved for finance verification.' });
    }

    if (normalize(paymentRequest.enrollment_status).toUpperCase() !== 'ACTIVE') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Student is not in active enrollment status.' });
    }

    await client.query(
      `UPDATE payment_requests
       SET status = 'APPROVED', approved_by = $1, approval_date = NOW(), rejection_reason = NULL
       WHERE request_id = $2`,
      [requester.user_id, requestId]
    );

    await client.query('COMMIT');
    return res.json({ success: true, message: 'Academic eligibility approved and sent to Finance verification.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve department enrollment error:', error);
    return res.status(500).json({ error: 'Failed to approve enrollment', details: error.message });
  } finally {
    client.release();
  }
};

exports.rejectDepartmentEnrollment = async (req, res) => {
  const staffEmail = normalize(req.headers['x-admin-email']).toLowerCase();
  const requestId = Number(req.params.requestId);
  const reason = normalize(req.body?.reason) || 'Not academically eligible.';

  if (!staffEmail) {
    return res.status(400).json({ error: 'Staff email header is required.' });
  }

  if (!requestId) {
    return res.status(400).json({ error: 'requestId is required.' });
  }

  const client = await pool.connect();
  try {
    const { requester, error, status } = await resolveDepartmentHead(staffEmail);
    if (!requester) {
      return res.status(status).json({ error });
    }

    await client.query('BEGIN');

    const reqResult = await client.query(
      `SELECT pr.request_id, pr.status, s.department_id
       FROM payment_requests pr
       JOIN students s ON s.student_id = pr.student_id
       WHERE pr.request_id = $1
       FOR UPDATE`,
      [requestId]
    );

    if (!reqResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment request not found.' });
    }

    const paymentRequest = reqResult.rows[0];

    if (paymentRequest.department_id !== requester.department_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only reject requests from your own department.' });
    }

    if (paymentRequest.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only pending requests can be rejected.' });
    }

    await client.query(
      `UPDATE payment_requests
       SET status = 'REJECTED', approved_by = $1, approval_date = NOW(), rejection_reason = $2
       WHERE request_id = $3`,
      [requester.user_id, reason, requestId]
    );

    await client.query('COMMIT');
    return res.json({ success: true, message: 'Request rejected based on academic eligibility.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reject department enrollment error:', error);
    return res.status(500).json({ error: 'Failed to reject enrollment', details: error.message });
  } finally {
    client.release();
  }
};

exports.getReportSummary = async (req, res) => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const fromInput = req.query.from ? new Date(req.query.from) : defaultFrom;
    const toInput = req.query.to ? new Date(req.query.to) : now;

    if (Number.isNaN(fromInput.getTime()) || Number.isNaN(toInput.getTime())) {
      return res.status(400).json({ error: 'Invalid from/to date query parameters.' });
    }

    const fromDate = new Date(fromInput);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = new Date(toInput);
    toDate.setHours(23, 59, 59, 999);

    if (fromDate > toDate) {
      return res.status(400).json({ error: 'The from date must be before the to date.' });
    }

    const [
      summaryResult,
      methodBreakdownResult,
      departmentBreakdownResult,
      recentPaymentsResult,
      dashboardStats,
    ] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS successful_payments,
           COALESCE(SUM(amount), 0)::numeric AS total_collections,
           COALESCE(AVG(amount), 0)::numeric AS average_payment
         FROM payment_history
         WHERE status = 'SUCCESS'
           AND payment_date BETWEEN $1 AND $2`,
        [fromDate, toDate]
      ),
      pool.query(
        `SELECT
           COALESCE(payment_method, 'UNKNOWN') AS payment_method,
           COUNT(*)::int AS payment_count,
           COALESCE(SUM(amount), 0)::numeric AS total_amount
         FROM payment_history
         WHERE status = 'SUCCESS'
           AND payment_date BETWEEN $1 AND $2
         GROUP BY COALESCE(payment_method, 'UNKNOWN')
         ORDER BY total_amount DESC`,
        [fromDate, toDate]
      ),
      pool.query(
        `SELECT
           COALESCE(d.department_name, 'Unknown') AS department_name,
           COUNT(*)::int AS payment_count,
           COALESCE(SUM(ph.amount), 0)::numeric AS total_amount
         FROM payment_history ph
         JOIN debt_records dr ON dr.debt_id = ph.debt_id
         JOIN students s ON s.student_id = dr.student_id
         LEFT JOIN departments d ON d.department_id = s.department_id
         WHERE ph.status = 'SUCCESS'
           AND ph.payment_date BETWEEN $1 AND $2
         GROUP BY COALESCE(d.department_name, 'Unknown')
         ORDER BY total_amount DESC`,
        [fromDate, toDate]
      ),
      pool.query(
        `SELECT
           ph.payment_id,
           ph.amount,
           ph.payment_method,
           ph.transaction_ref,
           ph.status,
           ph.payment_date,
           u.full_name,
           s.student_number,
           COALESCE(d.department_name, 'Unknown') AS department_name
         FROM payment_history ph
         JOIN debt_records dr ON dr.debt_id = ph.debt_id
         JOIN students s ON s.student_id = dr.student_id
         JOIN users u ON u.user_id = s.user_id
         LEFT JOIN departments d ON d.department_id = s.department_id
         WHERE ph.status = 'SUCCESS'
           AND ph.payment_date BETWEEN $1 AND $2
         ORDER BY ph.payment_date DESC
         LIMIT 200`,
        [fromDate, toDate]
      ),
      fetchDashboardStats(),
    ]);

    const summary = summaryResult.rows[0] || {
      successful_payments: 0,
      total_collections: 0,
      average_payment: 0,
    };

    return res.json({
      success: true,
      range: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      summary: {
        successfulPayments: Number(summary.successful_payments || 0),
        totalCollections: Number(summary.total_collections || 0),
        averagePayment: Number(summary.average_payment || 0),
        outstandingDebt: Number(dashboardStats.outstandingDebt || 0),
        pendingApprovals: Number(dashboardStats.pendingApprovals || 0),
      },
      breakdown: {
        byMethod: methodBreakdownResult.rows.map((row) => ({
          paymentMethod: row.payment_method,
          paymentCount: Number(row.payment_count || 0),
          totalAmount: Number(row.total_amount || 0),
        })),
        byDepartment: departmentBreakdownResult.rows.map((row) => ({
          departmentName: row.department_name,
          paymentCount: Number(row.payment_count || 0),
          totalAmount: Number(row.total_amount || 0),
        })),
      },
      recentPayments: recentPaymentsResult.rows.map((row) => ({
        paymentId: Number(row.payment_id),
        studentName: row.full_name,
        studentNumber: row.student_number,
        departmentName: row.department_name,
        amount: Number(row.amount || 0),
        paymentMethod: row.payment_method,
        transactionRef: row.transaction_ref,
        paymentDate: row.payment_date,
        status: row.status,
      })),
    });
  } catch (error) {
    console.error('Report summary error:', error);
    return res.status(500).json({
      error: 'Failed to generate report summary',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.streamAdminDashboard = async (req, res) => {
  const adminEmail = req.query.email;
  const adminPassword = req.query.password;

  if (!isValidAdmin(adminEmail, adminPassword)) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendUpdate = async () => {
    try {
      const [stats, students, notifications] = await Promise.all([
        fetchDashboardStats(),
        fetchStudentDebtDetails(),
        fetchNotifications(),
      ]);
      res.write(
        `data: ${JSON.stringify({ stats, students, notifications })}\n\n`
      );
    } catch (error) {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: 'Failed to stream dashboard data' })}\n\n`);
    }
  };

  const intervalId = setInterval(sendUpdate, 5000);
  sendUpdate();

  req.on('close', () => {
    clearInterval(intervalId);
    res.end();
  });
};

exports.resetUserPassword = async (req, res) => {
  const userId = Number(req.params.userId);
  const newPassword = normalize(req.body.newPassword);

  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'User ID and new password are required.' });
  }

  try {
    const result = await pool.query(
      'SELECT firebase_uid, email, full_name FROM users WHERE user_id = $1 AND is_active = TRUE',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { firebase_uid: firebaseUid, email, full_name: fullName } = result.rows[0];
    let resolvedUid = firebaseUid;

    // Ensure Firebase user exists or create one first
    if (!resolvedUid) {
      try {
        const existing = await admin.auth().getUserByEmail(email);
        resolvedUid = existing.uid;
      } catch (lookupError) {
        try {
          const created = await createUserWithRetry({ email, password: newPassword, name: fullName });
          resolvedUid = created.uid;
        } catch (createError) {
          console.error('Reset user password - failed to ensure Firebase user:', createError);
          return res.status(500).json({ error: 'Failed to resolve or create Firebase user', details: createError.message });
        }
      }

      try {
        await pool.query('UPDATE users SET firebase_uid = $1 WHERE user_id = $2', [resolvedUid, userId]);
      } catch (dbErr) {
        console.error('Failed to persist firebase_uid during password reset:', dbErr);
      }
    }

    try {
      await admin.auth().updateUser(resolvedUid, { password: newPassword });
      return res.json({ success: true });
    } catch (firebaseError) {
      console.error('Reset user password Firebase error:', firebaseError);
      return res.status(500).json({ error: 'Failed to update Firebase password', details: firebaseError.message });
    }
  } catch (error) {
    console.error('Reset user password error:', error);
    return res.status(500).json({ error: 'Failed to reset password', details: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  const userId = Number(req.params.userId);

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      'SELECT user_id, firebase_uid, student_id FROM users WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found.' });
    }

    const { firebase_uid: firebaseUid, student_id: studentId } = result.rows[0];

    if (studentId) {
      // Prevent deletion if the student has outstanding debt or pending payments
      try {
        const pendingReq = await client.query(
          `SELECT COUNT(*) AS count FROM payment_requests WHERE student_id = $1 AND status IN ('PENDING','PROCESSING')`,
          [studentId]
        );
        const pendingCount = parseInt(pendingReq.rows[0].count, 10);

        const debtRecord = await client.query(
          `SELECT COALESCE(current_balance, 0) AS balance FROM debt_records WHERE student_id = $1 LIMIT 1`,
          [studentId]
        );
        const balance = debtRecord.rows.length ? parseFloat(debtRecord.rows[0].balance) : 0;

        const compReq = await client.query(
          `SELECT COUNT(*) AS count FROM debt_components WHERE student_id = $1 AND status IN ('UNPAID','PARTIALLY_PAID')`,
          [studentId]
        );
        const compCount = parseInt(compReq.rows[0].count, 10);

        if (pendingCount > 0 || balance > 0 || compCount > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Cannot delete user while they have outstanding debt or pending payments.' });
        }
      } catch (checkErr) {
        await client.query('ROLLBACK');
        console.error('Failed to verify student payment state before user delete:', checkErr);
        return res.status(500).json({ error: 'Failed to verify student payment state', details: checkErr.message });
      }

      await client.query('UPDATE users SET student_id = NULL WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM students WHERE student_id = $1', [studentId]);
    }

    await client.query('DELETE FROM users WHERE user_id = $1', [userId]);

    // Attempt to delete Firebase user before committing; if it fails, rollback.
    if (firebaseUid) {
      try {
        await admin.auth().deleteUser(firebaseUid);
      } catch (firebaseError) {
        await client.query('ROLLBACK');
        console.error('Failed to delete Firebase user:', firebaseError);
        return res.status(500).json({ error: 'Failed to delete Firebase user', details: firebaseError.message });
      }
    }

    await client.query('COMMIT');

    return res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete user error:', error);
    return res.status(500).json({ error: 'Failed to delete user', details: error.message });
  } finally {
    client.release();
  }
};

exports.updateUser = async (req, res) => {
  const userId = Number(req.params.userId);
  const fullName = normalize(req.body.fullName);
  const email = normalize(req.body.email).toLowerCase();
  const departmentName = normalize(req.body.department);
  const requestedStudentNumber = normalize(req.body.studentNumber);

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  if (!fullName || !email) {
    return res.status(400).json({ error: 'Full name and email are required.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT u.user_id, u.role, u.email, u.department_id, u.student_id
       FROM users u
       WHERE u.user_id = $1 AND u.is_active = TRUE`,
      [userId]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = existing.rows[0];
    const studentNumber = user.role === 'STUDENT' ? requestedStudentNumber : '';

    if (email && email !== user.email) {
      const emailCheck = await client.query(
        'SELECT user_id FROM users WHERE email = $1 AND user_id <> $2',
        [email, userId]
      );
      if (emailCheck.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Email already exists in the system.' });
      }
    }

    let departmentId = user.department_id || null;
    if (departmentName) {
      const departmentResult = await client.query(
        'SELECT department_id FROM departments WHERE LOWER(department_name) = LOWER($1) LIMIT 1',
        [departmentName]
      );

      if (departmentResult.rows.length) {
        departmentId = departmentResult.rows[0].department_id;
      } else {
        const insertDept = await client.query(
          'INSERT INTO departments (department_name) VALUES ($1) RETURNING department_id',
          [departmentName]
        );
        departmentId = insertDept.rows[0].department_id;
      }
    }

    if (user.role === 'STUDENT' && studentNumber) {
      const existingStudentNumber = await client.query(
        'SELECT student_id FROM students WHERE student_number = $1 AND student_id <> $2',
        [studentNumber, user.student_id]
      );
      if (existingStudentNumber.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Student number already exists.' });
      }
    }

    await client.query(
      `UPDATE users
       SET full_name = $1,
           email = $2,
           department_id = $3
       WHERE user_id = $4`,
      [fullName, email, departmentId, userId]
    );

    if (user.role === 'STUDENT' && user.student_id) {
      await client.query(
        `UPDATE students
         SET department_id = $1,
             student_number = COALESCE($2, student_number)
         WHERE student_id = $3`,
        [departmentId, studentNumber || null, user.student_id]
      );
    }

    // Sync with Firebase
    const firebaseUidResult = await client.query(
      'SELECT firebase_uid FROM users WHERE user_id = $1',
      [userId]
    );
    const firebaseUid = firebaseUidResult.rows.length ? firebaseUidResult.rows[0].firebase_uid : null;
    if (firebaseUid) {
      try {
        await admin.auth().updateUser(firebaseUid, {
          email,
          displayName: fullName,
        });
      } catch (firebaseError) {
        console.error('Firebase updateUser error:', firebaseError);
        // Optionally, return a warning in the response
        await client.query('COMMIT');
        return res.json({ success: true, warning: 'Local update succeeded, but Firebase update failed.' });
      }
    }

    await client.query('COMMIT');
    return res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update user error:', error);
    return res.status(500).json({ error: 'Failed to update user', details: error.message });
  } finally {
    client.release();
  }
};

exports.importSisData = async (req, res) => {
  const { fileName, records = [] } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'No SIS records provided.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let totalDebtImported = 0;
    const importedBy = req.user?.userId || null;

    for (const record of records) {
      const studentNumber = normalize(record.studentNumber);
      const fullName = normalize(record.fullName);
      const email = normalize(record.email).toLowerCase();
      const departmentName = normalize(record.department);
      const batch = normalize(record.batch);
      const programCode = normalize(record.programCode);
      const semesters = Number(record.semesters || 0);
      const tuitionBaseAnnual = Number(record.tuitionBaseAnnual || 0);
      const startYear = Number(record.startYear || new Date().getFullYear());
      const livingStipendChoice = Boolean(record.livingStipendChoice ?? true);

      if (!studentNumber || !fullName || !email || !departmentName || semesters <= 0) {
        throw new Error('Invalid SIS record data.');
      }

      const deptResult = await client.query(
        'SELECT department_id FROM departments WHERE LOWER(department_name) = LOWER($1) LIMIT 1',
        [departmentName]
      );
      const departmentId = deptResult.rows.length
        ? deptResult.rows[0].department_id
        : (
            await client.query(
              'INSERT INTO departments (department_name) VALUES ($1) RETURNING department_id',
              [departmentName]
            )
          ).rows[0].department_id;

      let userId = null;
      let studentId = null;
      const userResult = await client.query(
        'SELECT user_id, student_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [email]
      );
      if (userResult.rows.length) {
        userId = userResult.rows[0].user_id;
        studentId = userResult.rows[0].student_id;
      } else {
        const insertUser = await client.query(
          `INSERT INTO users (full_name, email, role, is_active, department_id)
           VALUES ($1, $2, 'STUDENT', TRUE, $3)
           RETURNING user_id`,
          [fullName, email, departmentId]
        );
        userId = insertUser.rows[0].user_id;
      }

      if (!studentId) {
        const insertStudent = await client.query(
          `INSERT INTO students (user_id, department_id, student_number, batch, enrollment_status)
           VALUES ($1, $2, $3, $4, 'ACTIVE')
           RETURNING student_id`,
          [userId, departmentId, studentNumber, batch || null]
        );
        studentId = insertStudent.rows[0].student_id;
        await client.query('UPDATE users SET student_id = $1 WHERE user_id = $2', [
          studentId,
          userId,
        ]);
      }

      await client.query(
        `INSERT INTO student_sis_data
         (student_id, sis_student_id, program_code, enrollment_date, expected_graduation, living_stipend_choice)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (student_id)
         DO UPDATE SET
           sis_student_id = EXCLUDED.sis_student_id,
           program_code = EXCLUDED.program_code,
           enrollment_date = EXCLUDED.enrollment_date,
           expected_graduation = EXCLUDED.expected_graduation,
           living_stipend_choice = EXCLUDED.living_stipend_choice,
           imported_at = CURRENT_TIMESTAMP`,
        [
          studentId,
          record.sisStudentId || null,
          programCode || null,
          record.enrollmentDate || null,
          record.expectedGraduation || null,
          livingStipendChoice,
        ]
      );

      const components = calculateSemesterComponents({
        studentId,
        semesters,
        startYear,
        tuitionBaseAnnual,
        livingStipendChoice,
      });

      let studentTotal = 0;
      for (const component of components) {
        await client.query(
          `INSERT INTO debt_components
           (student_id, semester, academic_year, component_type, amount, description, due_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (student_id, semester, component_type)
           DO UPDATE SET amount = EXCLUDED.amount, description = EXCLUDED.description`,
          [
            component.studentId,
            component.semester,
            component.academicYear,
            component.componentType,
            component.amount,
            component.description,
            component.dueDate,
          ]
        );
        studentTotal += component.amount;
      }

      const updateDebt = await client.query(
        `UPDATE debt_records
         SET initial_amount = $2, current_balance = $2
         WHERE student_id = $1`,
        [studentId, studentTotal]
      );

      if (updateDebt.rowCount === 0) {
        await client.query(
          `INSERT INTO debt_records (student_id, initial_amount, current_balance)
           VALUES ($1, $2, $2)`,
          [studentId, studentTotal]
        );
      }

      totalDebtImported += studentTotal;
    }

    const importResult = await client.query(
      `INSERT INTO sis_imports (imported_by, file_name, student_count, total_debt_imported)
       VALUES ($1, $2, $3, $4)
       RETURNING import_id`,
      [importedBy, fileName || null, records.length, totalDebtImported]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      importId: importResult.rows[0].import_id,
      studentCount: records.length,
      totalDebtImported: parseFloat(totalDebtImported.toFixed(2)),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('SIS import error:', error);
    return res.status(500).json({ error: 'Failed to import SIS data', details: error.message });
  } finally {
    client.release();
  }
};

exports.createUser = async (req, res) => {
  const fullName = normalize(req.body.fullName);
  const email = normalize(req.body.email).toLowerCase();
  const role = normalize(req.body.role);
  const departmentName = normalize(req.body.department);
  const requestedStudentNumber = normalize(req.body.studentNumber);
  const password = normalize(req.body.password);

  const allowedRoles = [
    'STUDENT',
    'DEPT_HEAD',
    'FINANCE_OFFICER',
    'REGISTRAR_ADMIN'
  ];

  if (!fullName || !email || !role || !password) {
    return res.status(400).json({ error: 'Full name, email, role and password are required.' });
  }

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role provided.' });
  }

  const studentNumber = role === 'STUDENT' ? requestedStudentNumber : '';

  if (role === 'STUDENT' && (!studentNumber || !departmentName)) {
    return res.status(400).json({ error: 'Student number and department are required for students.' });
  }

  if (role === 'DEPT_HEAD' && !departmentName) {
    return res.status(400).json({ error: 'Department is required for department heads.' });
  }

  const client = await pool.connect();
  let firebaseUser = null;
  let firebaseWarning = null;

  try {
    await client.query('BEGIN');

    const existingUser = await client.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );
    if (existingUser.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already exists in the system.' });
    }

    if (role === 'STUDENT') {
      const existingStudentNumber = await client.query(
        'SELECT student_id FROM students WHERE student_number = $1',
        [studentNumber]
      );
      if (existingStudentNumber.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Student number already exists.' });
      }
    }

    let departmentId = null;
    if (departmentName) {
      const departmentResult = await client.query(
        'SELECT department_id FROM departments WHERE LOWER(department_name) = LOWER($1) LIMIT 1',
        [departmentName]
      );

      if (departmentResult.rows.length) {
        departmentId = departmentResult.rows[0].department_id;
      } else {
        const insertDept = await client.query(
          'INSERT INTO departments (department_name) VALUES ($1) RETURNING department_id',
          [departmentName]
        );
        departmentId = insertDept.rows[0].department_id;
      }
    }

    try {
      firebaseUser = await createUserWithRetry({ email, password, name: fullName });
    } catch (firebaseError) {
      await client.query('ROLLBACK');
      console.error('Create user Firebase error:', firebaseError);
      return res.status(500).json({ error: 'Failed to create Firebase user', details: firebaseError.message });
    }

    const userResult = await client.query(
      `INSERT INTO users (full_name, email, role, is_active, firebase_uid, department_id)
       VALUES ($1, $2, $3, TRUE, $4, $5)
       RETURNING user_id`,
      [fullName, email, role, firebaseUser ? firebaseUser.uid : null, departmentId]
    );

    const userId = userResult.rows[0].user_id;
    let studentId = null;

    if (role === 'STUDENT') {
      const studentResult = await client.query(
        `INSERT INTO students (user_id, department_id, student_number, enrollment_status)
         VALUES ($1, $2, $3, 'ACTIVE')
         RETURNING student_id`,
        [userId, departmentId, studentNumber]
      );

      studentId = studentResult.rows[0].student_id;

      await client.query('UPDATE users SET student_id = $1 WHERE user_id = $2', [
        studentId,
        userId,
      ]);

      await client.query(
        `INSERT INTO debt_records (student_id, initial_amount, current_balance, updated_by)
         VALUES ($1, $2, $2, NULL)`,
        [studentId, DEFAULT_INITIAL_DEBT]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      warning: firebaseWarning,
      user: {
        userId,
        fullName,
        email,
        role,
        departmentId,
        departmentName: departmentName || null,
        studentId,
        studentNumber: studentNumber || null,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (firebaseUser) {
      try {
        await admin.auth().deleteUser(firebaseUser.uid);
      } catch (cleanupError) {
        console.error('Failed to cleanup Firebase user:', cleanupError);
      }
    }

    console.error('Create user error:', error);
    return res.status(500).json({ error: 'Failed to create user', details: error.message });
  } finally {
    client.release();
  }
};
