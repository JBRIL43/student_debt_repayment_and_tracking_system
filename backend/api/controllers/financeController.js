const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const mapRequestRow = (row) => ({
  requestId: row.request_id,
  studentId: row.student_id,
  fullName: row.full_name,
  studentNumber: row.student_number,
  departmentName: row.department_name,
  requestedAmount: parseFloat(row.requested_amount || row.amount),
  paymentMethod: row.payment_method,
  status: row.status,
  semester: row.semester,
  academicYear: row.academic_year,
  componentType: row.component_type,
  requestedAt: row.requested_at || row.requested_date,
  transactionRef: row.transaction_ref,
  receiptUrl: row.receipt_url,
});

exports.listPaymentRequests = async (req, res) => {
  const status = (req.query.status || 'PENDING').toString().toUpperCase();

  try {
    const result = await pool.query(
      `SELECT
         pr.request_id,
         pr.student_id,
         pr.requested_amount,
         pr.amount,
         pr.payment_method,
         pr.status,
         pr.semester,
         pr.academic_year,
         pr.component_type,
         pr.requested_at,
         pr.requested_date,
         pr.transaction_ref,
         pr.receipt_url,
         u.full_name,
         s.student_number,
         d.department_name
       FROM payment_requests pr
       JOIN students s ON s.student_id = pr.student_id
       JOIN users u ON u.user_id = s.user_id
       LEFT JOIN departments d ON d.department_id = s.department_id
       WHERE pr.status = $1
       ORDER BY pr.requested_at DESC NULLS LAST, pr.requested_date DESC
       LIMIT 200`,
      [status]
    );

    return res.json({
      success: true,
      requests: result.rows.map(mapRequestRow),
    });
  } catch (error) {
    console.error('List payment requests error:', error);
    return res.status(500).json({ error: 'Failed to fetch payment requests' });
  }
};

exports.verifyPaymentRequest = async (req, res) => {
  const { requestId } = req.params;
  const verifierId = req.user?.userId || null;

  if (!requestId) {
    return res.status(400).json({ error: 'Request id is required.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const requestResult = await client.query(
      `SELECT *
       FROM payment_requests
       WHERE request_id = $1
       FOR UPDATE`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment request not found.' });
    }

    const request = requestResult.rows[0];

    if (request.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Request is not pending.' });
    }

    const amount = parseFloat(request.requested_amount || request.amount);
    if (!amount || amount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid payment amount.' });
    }

    const hasSpecificComponent =
      request.semester && request.academic_year && request.component_type;

    let allocations = [];

    if (hasSpecificComponent) {
      const componentResult = await client.query(
        `SELECT component_id, amount, status
         FROM debt_components
         WHERE student_id = $1
           AND semester = $2
           AND academic_year = $3
           AND component_type = $4
           AND status IN ('UNPAID', 'PARTIALLY_PAID')
         FOR UPDATE`,
        [request.student_id, request.semester, request.academic_year, request.component_type]
      );

      if (componentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Matching debt component not found.' });
      }

      const component = componentResult.rows[0];
      const componentAmount = parseFloat(component.amount);

      if (amount > componentAmount) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Payment amount exceeds outstanding component balance.',
        });
      }

      allocations = [{ component, allocated: amount }];
    } else {
      const componentsResult = await client.query(
        `SELECT component_id, component_type, amount, status, due_date
         FROM debt_components
         WHERE student_id = $1
           AND status IN ('UNPAID', 'PARTIALLY_PAID')
         ORDER BY due_date ASC
         FOR UPDATE`,
        [request.student_id]
      );

      if (componentsResult.rows.length === 0) {
        const legacyDebt = await client.query(
          `SELECT debt_id, current_balance
           FROM debt_records
           WHERE student_id = $1
           FOR UPDATE`,
          [request.student_id]
        );

        if (!legacyDebt.rows.length) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Debt record not found.' });
        }

        const currentBalance = parseFloat(legacyDebt.rows[0].current_balance);
        if (amount > currentBalance) {
          await client.query('ROLLBACK');
          return res
            .status(400)
            .json({ error: 'Payment exceeds current balance.' });
        }

        const transactionRef = request.transaction_ref || `REQ-${request.request_id}`;
        await client.query(
          `INSERT INTO payment_history
            (debt_id, amount, payment_method, transaction_ref, status, payment_date, notes)
           VALUES ($1, $2, $3, $4, 'SUCCESS', NOW(), 'Verified by finance officer')`,
          [legacyDebt.rows[0].debt_id, amount, request.payment_method || 'RECEIPT', transactionRef]
        );

        const newBalance = parseFloat((currentBalance - amount).toFixed(2));
        await client.query(
          `UPDATE debt_records
           SET current_balance = $1, last_updated = NOW(), updated_by = $2
           WHERE student_id = $3`,
          [newBalance, verifierId, request.student_id]
        );

        await client.query(
          `UPDATE payment_requests
           SET status = 'VERIFIED', approved_by = $1, approval_date = NOW(), verified_by = $1, verified_at = NOW()
           WHERE request_id = $2`,
          [verifierId, request.request_id]
        );

        await client.query('COMMIT');

        return res.json({
          success: true,
          message: 'Payment verified and balance updated (legacy debt).',
        });
      }

      const priority = {
        LIVING_STIPEND: 1,
        MEDICAL: 2,
        TUITION: 3,
        OTHER: 4,
      };

      const sortedComponents = componentsResult.rows.sort((a, b) => {
        const aPriority = priority[a.component_type] || 99;
        const bPriority = priority[b.component_type] || 99;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return new Date(a.due_date) - new Date(b.due_date);
      });

      let remainingPayment = amount;
      for (const component of sortedComponents) {
        if (remainingPayment <= 0) break;
        const componentAmount = parseFloat(component.amount);
        const allocated = Math.min(componentAmount, remainingPayment);
        allocations.push({ component, allocated });
        remainingPayment = parseFloat((remainingPayment - allocated).toFixed(2));
      }
    }

    const debtRecord = await client.query(
      `SELECT debt_id
       FROM debt_records
       WHERE student_id = $1
       FOR UPDATE`,
      [request.student_id]
    );

    if (debtRecord.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Debt record not found.' });
    }

    const transactionRef = request.transaction_ref || `REQ-${request.request_id}`;
    const paymentResult = await client.query(
      `INSERT INTO payment_history
        (debt_id, amount, payment_method, transaction_ref, status, payment_date, notes)
       VALUES ($1, $2, $3, $4, 'SUCCESS', NOW(), 'Verified by finance officer')
       RETURNING payment_id`,
      [debtRecord.rows[0].debt_id, amount, request.payment_method || 'RECEIPT', transactionRef]
    );

    for (const allocation of allocations) {
      const component = allocation.component;
      const allocated = allocation.allocated;
      const componentAmount = parseFloat(component.amount);
      const remainingComponent = parseFloat(
        (componentAmount - allocated).toFixed(2)
      );
      if (remainingComponent <= 0) {
        await client.query(
          `UPDATE debt_components
           SET status = 'PAID'
           WHERE component_id = $1`,
          [component.component_id]
        );
      } else {
        await client.query(
          `UPDATE debt_components
           SET amount = $2, status = 'PARTIALLY_PAID'
           WHERE component_id = $1`,
          [component.component_id, remainingComponent]
        );
      }

      await client.query(
        `INSERT INTO payment_allocations (payment_id, component_id, allocated_amount)
         VALUES ($1, $2, $3)`,
        [paymentResult.rows[0].payment_id, component.component_id, allocated]
      );
    }

    const remainingSum = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS remaining
       FROM debt_components
       WHERE student_id = $1
         AND status IN ('UNPAID', 'PARTIALLY_PAID')`,
      [request.student_id]
    );

    await client.query(
      `UPDATE debt_records
       SET current_balance = $1, last_updated = NOW(), updated_by = $2
       WHERE student_id = $3`,
      [remainingSum.rows[0].remaining, verifierId, request.student_id]
    );

    await client.query(
      `UPDATE payment_requests
       SET status = 'VERIFIED', approved_by = $1, approval_date = NOW(), verified_by = $1, verified_at = NOW()
       WHERE request_id = $2`,
      [verifierId, request.request_id]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Payment verified and balance updated.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Verify payment request error:', error);
    return res.status(500).json({ error: 'Failed to verify payment request' });
  } finally {
    client.release();
  }
};

exports.rejectPaymentRequest = async (req, res) => {
  const { requestId } = req.params;
  const { reason } = req.body || {};
  const verifierId = req.user?.userId || null;

  if (!requestId) {
    return res.status(400).json({ error: 'Request id is required.' });
  }

  try {
    const result = await pool.query(
      `UPDATE payment_requests
       SET status = 'REJECTED', approved_by = $1, approval_date = NOW(), rejection_reason = $2
       WHERE request_id = $3
         AND status = 'PENDING'
       RETURNING request_id`,
      [verifierId, reason || null, requestId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Pending request not found.' });
    }

    return res.json({ success: true, message: 'Payment request rejected.' });
  } catch (error) {
    console.error('Reject payment request error:', error);
    return res.status(500).json({ error: 'Failed to reject payment request' });
  }
};
