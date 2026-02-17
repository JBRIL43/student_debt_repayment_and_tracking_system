const { Pool } = require('pg');
const { protect, restrictTo } = require('./authController');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

exports.getDebtBalance = async (req, res) => {
  try {
    const studentId = req.user.studentId;

    if (!studentId) {
      return res.status(403).json({
        error: 'Student ID not found in session. Are you logged in as a student?',
      });
    }

    const debtRecordResult = await pool.query(
      `SELECT
        dr.debt_id,
        dr.initial_amount,
        dr.current_balance,
        dr.last_updated,
        u.full_name as updated_by_name
       FROM debt_records dr
       LEFT JOIN users u ON dr.updated_by = u.user_id
       WHERE dr.student_id = $1`,
      [studentId]
    );

    const componentsResult = await pool.query(
      `SELECT
        component_id,
        semester,
        academic_year,
        component_type,
        amount,
        description,
        accrued_at,
        due_date,
        status
       FROM debt_components
       WHERE student_id = $1
       ORDER BY due_date ASC, semester ASC`,
      [studentId]
    );

    const hasComponents = componentsResult.rows.length > 0;
    const components = componentsResult.rows;

    let initialAmount = 0;
    let currentBalance = 0;
    let totalPaid = 0;
    let lastUpdated = null;
    let updatedBy = null;
    let debtId = null;

    if (hasComponents) {
      const debtInitial = debtRecordResult.rows.length
        ? parseFloat(debtRecordResult.rows[0].initial_amount)
        : 0;
      initialAmount = debtInitial || components.reduce(
        (sum, c) => sum + parseFloat(c.amount),
        0
      );
      currentBalance = components
        .filter((c) => ['UNPAID', 'PARTIALLY_PAID'].includes(c.status))
        .reduce((sum, c) => sum + parseFloat(c.amount), 0);
      totalPaid = Math.max(0, initialAmount - currentBalance);
    }

    if (debtRecordResult.rows.length > 0) {
      const debt = debtRecordResult.rows[0];
      debtId = debt.debt_id;
      lastUpdated = debt.last_updated;
      updatedBy = debt.updated_by_name;
      if (!hasComponents) {
        initialAmount = parseFloat(debt.initial_amount);
        currentBalance = parseFloat(debt.current_balance);
        totalPaid = parseFloat(debt.initial_amount) - parseFloat(debt.current_balance);
      }
    }

    if (!hasComponents && debtRecordResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No debt record found for this student. Contact registrar office.',
      });
    }

    const paymentHistory = debtId
      ? (
          await pool.query(
            `SELECT json_agg(json_build_object(
              'payment_id', ph.payment_id,
              'amount', ph.amount,
              'payment_method', ph.payment_method,
              'transaction_ref', ph.transaction_ref,
              'status', ph.status,
              'payment_date', ph.payment_date,
              'verified_by', vu.full_name
            ) ORDER BY ph.payment_date DESC) as history
            FROM payment_history ph
            LEFT JOIN users vu ON ph.verified_by = vu.user_id
            WHERE ph.debt_id = $1`,
            [debtId]
          )
        ).rows[0].history || []
      : [];

    const pendingRequests = (
      await pool.query(
        `SELECT request_id, requested_amount, amount, payment_method, status,
                semester, academic_year, component_type, requested_at, requested_date,
                approval_date, rejection_reason
         FROM payment_requests
         WHERE student_id = $1
         ORDER BY requested_at DESC NULLS LAST, requested_date DESC
         LIMIT 10`,
        [studentId]
      )
    ).rows;

    const paymentCount = paymentHistory.length;
    const lastPayment = paymentHistory.length > 0 ? paymentHistory[0] : null;

    const livingTotal = components
      .filter((c) => c.component_type === 'LIVING_STIPEND')
      .reduce((sum, c) => sum + parseFloat(c.amount), 0);
    const tuitionTotal = components
      .filter((c) => c.component_type === 'TUITION')
      .reduce((sum, c) => sum + parseFloat(c.amount), 0);
    const nextDueDate = components.length > 0 ? components[0].due_date : null;
    const unpaidComponents = components.filter((c) =>
      ['UNPAID', 'PARTIALLY_PAID'].includes(c.status)
    );

    res.json({
      success: true,
      data: {
        debt_id: debtId,
        initial_amount: parseFloat(initialAmount.toFixed(2)),
        current_balance: parseFloat(currentBalance.toFixed(2)),
        total_paid: parseFloat(totalPaid.toFixed(2)),
        payment_count: paymentCount,
        last_payment: lastPayment,
        payment_history: paymentHistory,
        pending_requests: pendingRequests,
        last_updated: lastUpdated,
        updated_by: updatedBy,
        living_stipend_total: parseFloat(livingTotal.toFixed(2)),
        tuition_total: parseFloat(tuitionTotal.toFixed(2)),
        total_debt: parseFloat(initialAmount.toFixed(2)),
        components: components,
        unpaid_components: unpaidComponents,
        next_due_date: nextDueDate,
      },
    });
  } catch (error) {
    console.error('Debt balance error:', error);
    res.status(500).json({
      error: 'Failed to fetch debt balance',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.protect = protect;
exports.restrictTo = restrictTo;

exports.getUnpaidComponents = async (req, res) => {
  try {
    const studentId = req.user.studentId;
    const componentType = (req.query.componentType || '').toString().toUpperCase();

    if (!studentId) {
      return res.status(403).json({
        error: 'Student ID not found in session. Are you logged in as a student?',
      });
    }

    const params = [studentId];
    let filter = '';
    if (componentType) {
      filter = 'AND component_type = $2';
      params.push(componentType);
    }

    const result = await pool.query(
      `SELECT
        component_id,
        semester,
        academic_year,
        component_type,
        amount,
        description,
        due_date,
        status
       FROM debt_components
       WHERE student_id = $1
         AND status IN ('UNPAID', 'PARTIALLY_PAID')
         ${filter}
       ORDER BY due_date ASC`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Unpaid components error:', error);
    res.status(500).json({
      error: 'Failed to fetch unpaid components',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.mockPay = async (req, res) => {
  const client = await pool.connect();

  try {
    const studentId = req.user.studentId;
    const amountRaw = req.body.amount;
    const paymentMethod = req.body.paymentMethod || 'RECEIPT';
    const transactionRef = req.body.transactionRef || null;
    const amount = parseFloat(amountRaw);

    if (!studentId) {
      return res.status(403).json({
        error: 'Student ID not found in session. Are you logged in as a student?',
      });
    }

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount.' });
    }

    await client.query('BEGIN');

    const debtResult = await client.query(
      `SELECT debt_id, current_balance, initial_amount
       FROM debt_records
       WHERE student_id = $1
       FOR UPDATE`,
      [studentId]
    );

    if (debtResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'No debt record found for this student.',
      });
    }

    const debt = debtResult.rows[0];
    const currentBalance = parseFloat(debt.current_balance);

    if (amount > currentBalance) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Payment amount exceeds current balance.',
      });
    }

    const requestResult = await client.query(
      `INSERT INTO payment_requests (
        student_id,
        amount,
        requested_amount,
        status,
        requested_date,
        requested_at,
        payment_method,
        transaction_ref
      ) VALUES ($1, $2, $3, 'PENDING', NOW(), NOW(), $4, $5)
      RETURNING request_id`,
      [studentId, amount, amount, paymentMethod, transactionRef]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        request_id: requestResult.rows[0].request_id,
        status: 'PENDING',
        amount,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Mock payment error:', error);
    res.status(500).json({
      error: 'Failed to process mock payment',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
};
