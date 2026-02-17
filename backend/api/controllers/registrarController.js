const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

exports.getEligibleClearance = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         s.student_id,
         s.student_number,
         u.full_name,
         u.email,
         d.department_name,
         COALESCE(SUM(CASE WHEN dc.status IN ('UNPAID', 'PARTIALLY_PAID') THEN dc.amount ELSE 0 END), dr.current_balance, 0) AS remaining_balance
       FROM students s
       JOIN users u ON u.user_id = s.user_id
       LEFT JOIN departments d ON d.department_id = s.department_id
       LEFT JOIN debt_components dc ON dc.student_id = s.student_id
       LEFT JOIN debt_records dr ON dr.student_id = s.student_id
       WHERE u.is_active = TRUE
       GROUP BY s.student_id, s.student_number, u.full_name, u.email, d.department_name, dr.current_balance
       ORDER BY u.full_name ASC`
    );

    const eligible = result.rows
      .filter((row) => parseFloat(row.remaining_balance) <= 0)
      .map((row) => ({
        ...row,
        clearances: {
          financial: 'VERIFIED',
          departmental: 'PENDING',
          library: 'PENDING',
          laboratory: 'PENDING',
        },
        status: 'READY_FOR_CLEARANCE',
      }));

    return res.json({ success: true, students: eligible });
  } catch (error) {
    console.error('Eligible clearance error:', error);
    return res.status(500).json({ error: 'Failed to fetch clearance list' });
  }
};

exports.issueClearance = async (req, res) => {
  const { studentId, notes } = req.body || {};
  const issuerId = req.user?.userId || null;

  if (!studentId) {
    return res.status(400).json({ error: 'studentId is required.' });
  }

  try {
    const balanceResult = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN dc.status IN ('UNPAID', 'PARTIALLY_PAID') THEN dc.amount ELSE 0 END), dr.current_balance, 0) AS remaining
       FROM students s
       LEFT JOIN debt_components dc ON dc.student_id = s.student_id
       LEFT JOIN debt_records dr ON dr.student_id = s.student_id
       WHERE s.student_id = $1
       GROUP BY dr.current_balance`,
      [studentId]
    );

    const remaining = parseFloat(balanceResult.rows[0]?.remaining || 0);
    if (remaining > 0) {
      return res.status(403).json({
        error: `Outstanding balance ETB ${remaining.toFixed(2)}. Clearance blocked.`,
      });
    }

    const debtResult = await pool.query(
      `SELECT debt_id FROM debt_records WHERE student_id = $1`,
      [studentId]
    );

    const debtId = debtResult.rows.length ? debtResult.rows[0].debt_id : null;

    const insertResult = await pool.query(
      `INSERT INTO clearance_letters (student_id, debt_id, issued_by, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING letter_id, issued_at`,
      [studentId, debtId, issuerId, notes || null]
    );

    return res.json({
      success: true,
      letterId: insertResult.rows[0].letter_id,
      issuedAt: insertResult.rows[0].issued_at,
      message: 'Clearance letter issued (simulation).',
    });
  } catch (error) {
    console.error('Issue clearance error:', error);
    return res.status(500).json({ error: 'Failed to issue clearance letter' });
  }
};

exports.getMyClearance = async (req, res) => {
  const studentId = req.user?.studentId;

  if (!studentId) {
    return res.status(403).json({ error: 'Student ID missing in session.' });
  }

  try {
    const result = await pool.query(
      `SELECT
         cl.letter_id,
         cl.issued_at,
         cl.file_url,
         cl.notes,
         cl.debt_id,
         COALESCE(cl.student_id, dr.student_id) AS student_id
       FROM clearance_letters cl
       LEFT JOIN debt_records dr ON dr.debt_id = cl.debt_id
       WHERE cl.student_id = $1 OR dr.student_id = $1
       ORDER BY cl.issued_at DESC
       LIMIT 1`,
      [studentId]
    );

    if (!result.rows.length) {
      return res.json({ success: true, letter: null });
    }

    return res.json({ success: true, letter: result.rows[0] });
  } catch (error) {
    console.error('Get clearance error:', error);
    return res.status(500).json({ error: 'Failed to fetch clearance letter' });
  }
};
