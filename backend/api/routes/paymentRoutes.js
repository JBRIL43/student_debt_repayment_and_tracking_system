const express = require('express');
const { protect, restrictTo } = require('../controllers/authController');
const { createPaymentRequest, getMyPaymentRequests } = require('../controllers/paymentController');
const { enforceLivingBeforeTuition } = require('../middleware/paymentPolicy');

const router = express.Router();

router.post(
	'/request',
	protect,
	restrictTo('STUDENT'),
	enforceLivingBeforeTuition,
	createPaymentRequest
);
router.get('/requests', protect, restrictTo('STUDENT'), getMyPaymentRequests);

module.exports = router;
