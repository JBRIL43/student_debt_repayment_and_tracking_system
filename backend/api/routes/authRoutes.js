const express = require('express');
const { login, protect, restrictTo } = require('../controllers/authController');

const router = express.Router();

// Public route
router.post('/login', login);

// Protected test route (for debugging)
router.get('/me', protect, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

// Role-restricted test route
router.get('/admin-only', protect, restrictTo('REGISTRAR_ADMIN'), (req, res) => {
  res.json({ message: 'Welcome admin!', user: req.user });
});

module.exports = router;
