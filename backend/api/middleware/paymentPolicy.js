const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const enforceLivingBeforeTuition = async (req, res, next) => {
  const componentType = req.body?.componentType;
  const typeUpper = componentType?.toString().toUpperCase();
  const studentId = req.user?.studentId;

  if (!studentId || typeUpper !== 'TUITION') {
    return next();
  }

  try {
    const unpaidLiving = await pool.query(
      `SELECT COUNT(*) as count
       FROM debt_components
       WHERE student_id = $1
         AND component_type = 'LIVING_STIPEND'
         AND status IN ('UNPAID', 'PARTIALLY_PAID')`,
      [studentId]
    );

    if (parseInt(unpaidLiving.rows[0].count, 10) > 0) {
      return res.status(403).json({
        error:
          'Living stipend debt must be fully paid before tuition payments are accepted.',
        unpaidLivingComponents: parseInt(unpaidLiving.rows[0].count, 10),
      });
    }

    return next();
  } catch (error) {
    console.error('Policy enforcement error:', error);
    return res.status(500).json({
      error: 'Failed to enforce payment policy',
    });
  }
};

module.exports = {
  enforceLivingBeforeTuition,
};
