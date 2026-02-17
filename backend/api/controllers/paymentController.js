const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

exports.createPaymentRequest = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { semester, academicYear, componentType, amount, paymentMethod, transactionRef, receiptUrl } = req.body;
    const studentId = req.user.studentId;

    if (!semester || !academicYear || !componentType || amount === undefined) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error:
          'Missing required fields: semester, academicYear, componentType, amount',
      });
    }

    const typeUpper = componentType.toString().toUpperCase();
    const validComponents = ['TUITION', 'LIVING_STIPEND', 'MEDICAL'];
    if (!validComponents.includes(typeUpper)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Invalid component type. Must be one of: ${validComponents.join(', ')}`,
      });
    }

    const componentResult = await client.query(
      `SELECT component_id, amount, status
       FROM debt_components
       WHERE student_id = $1
         AND semester = $2
         AND academic_year = $3
         AND component_type = $4
         AND status IN ('UNPAID', 'PARTIALLY_PAID')
       FOR UPDATE`,
      [studentId, semester.toString().toUpperCase(), academicYear, typeUpper]
    );

    if (componentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: `No unpaid ${typeUpper} debt found for ${semester} ${academicYear}.`,
      });
    }

    const unpaidAmount = parseFloat(componentResult.rows[0].amount);
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0 || amountNum > unpaidAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Requested amount (ETB ${amountNum.toFixed(
          2
        )}) exceeds unpaid balance (ETB ${unpaidAmount.toFixed(2)}).`,
      });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const requestResult = await client.query(
      `INSERT INTO payment_requests (
        student_id,
        amount,
        requested_amount,
        semester,
        academic_year,
        due_date,
        status,
        requested_date,
        requested_at,
        payment_method,
        component_type,
        transaction_ref,
        receipt_url
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW(), NOW(), $7, $8, $9, $10)
      RETURNING request_id, requested_amount, semester, academic_year, due_date, status`,
      [
        studentId,
        amountNum,
        amountNum,
        semester.toString().toUpperCase(),
        academicYear,
        dueDate,
        paymentMethod || 'RECEIPT',
        typeUpper,
        transactionRef || null,
        receiptUrl || null,
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Payment request submitted successfully. Awaiting approval.',
      data: {
        requestId: requestResult.rows[0].request_id,
        amount: parseFloat(requestResult.rows[0].requested_amount),
        semester: requestResult.rows[0].semester,
        academicYear: requestResult.rows[0].academic_year,
        componentType: typeUpper,
        dueDate: requestResult.rows[0].due_date,
        status: requestResult.rows[0].status,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Payment request error:', error);
    res.status(500).json({
      error: 'Failed to create payment request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
};

exports.getMyPaymentRequests = async (req, res) => {
  try {
    const studentId = req.user.studentId;
    const result = await pool.query(
      `SELECT request_id, requested_amount, amount, payment_method, status,
              semester, academic_year, component_type, requested_at, requested_date,
              approval_date, rejection_reason, transaction_ref
       FROM payment_requests
       WHERE student_id = $1
       ORDER BY requested_at DESC NULLS LAST, requested_date DESC
       LIMIT 20`,
      [studentId]
    );

    return res.json({ success: true, requests: result.rows });
  } catch (error) {
    console.error('Get payment requests error:', error);
    return res.status(500).json({ error: 'Failed to load payment requests' });
  }
};
