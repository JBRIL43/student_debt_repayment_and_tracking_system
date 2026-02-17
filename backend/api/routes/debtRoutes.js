const express = require('express');
const {
  protect,
  restrictTo,
  getDebtBalance,
  getUnpaidComponents,
  mockPay,
} = require('../controllers/debtController');

const router = express.Router();

// Student can view their own debt balance
router.get('/balance', protect, restrictTo('STUDENT'), getDebtBalance);

// Student can view unpaid components by type
router.get('/components', protect, restrictTo('STUDENT'), getUnpaidComponents);

// Showcase mock payment (deducts balance)
router.post('/mock-pay', protect, restrictTo('STUDENT'), mockPay);

// Placeholder for admin view (future step)
router.get('/balance/:studentId', protect, restrictTo('FINANCE_OFFICER', 'REGISTRAR_ADMIN'), (req, res) => {
  res.json({ message: 'Admin debt view - coming in Step 4' });
});

module.exports = router;
