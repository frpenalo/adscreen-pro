const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Create payment intent (advertiser only)
router.post(
  '/create-intent',
  authMiddleware,
  requireRole('advertiser'),
  paymentController.createPaymentIntent
);

// Get balance (advertiser only)
router.get(
  '/balance',
  authMiddleware,
  requireRole('advertiser'),
  paymentController.getBalance
);

// Get payment history (advertiser only)
router.get(
  '/history',
  authMiddleware,
  requireRole('advertiser'),
  paymentController.getPaymentHistory
);

// Stripe webhook (public endpoint)
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.handlePaymentSuccess
);

module.exports = router;
