const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware, requireRole } = require('../middleware/auth');

// All admin routes require admin role
router.use(authMiddleware);
router.use(requireRole('admin'));

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Ad Moderation
router.get('/ads/pending', adminController.getPendingAds);
router.post('/ads/:id/approve', adminController.approveAd);
router.post('/ads/:id/reject', adminController.rejectAd);

// Venue Management
router.get('/venues', adminController.getVenues);
router.patch('/venues/:id/commission', adminController.updateVenueCommission);

// Payout Management
router.get('/payouts', adminController.getPayoutRequests);
router.post('/payouts/:id/process', adminController.processPayout);

// Financial Reports
router.get('/reports/financial', adminController.getFinancialReport);

module.exports = router;
