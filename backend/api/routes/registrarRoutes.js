const express = require('express');
const { protect, restrictTo } = require('../controllers/authController');
const { getMyClearance } = require('../controllers/registrarController');

const router = express.Router();

router.get('/clearance', protect, restrictTo('STUDENT'), getMyClearance);

module.exports = router;
