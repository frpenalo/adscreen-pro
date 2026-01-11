const express = require('express');
const router = express.Router();
const venueController = require('../controllers/venueController');
const { authMiddleware, requireRole } = require('../middleware/auth');

// All venue routes require venue role
router.use(authMiddleware);
router.use(requireRole('venue'));

// Dashboard & Stats
router.get('/dashboard', venueController.getDashboard);
router.get('/earnings', venueController.getEarnings);

// Payout Management
router.post('/payout/request', venueController.requestPayout);
router.get('/payout/history', venueController.getPayoutHistory);

// Profile
router.patch('/profile', venueController.updateProfile);

module.exports = router;
