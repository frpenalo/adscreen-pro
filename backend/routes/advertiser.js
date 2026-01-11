const express = require('express');
const router = express.Router();
const advertiserController = require('../controllers/advertiserController');
const { authMiddleware, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All advertiser routes require advertiser role
router.use(authMiddleware);
router.use(requireRole('advertiser'));

// Dashboard
router.get('/dashboard', advertiserController.getDashboard);

// Campaign Management
router.post('/campaigns', advertiserController.createCampaign);
router.get('/campaigns/:id/analytics', advertiserController.getCampaignAnalytics);
router.post('/campaigns/:campaignId/locations', advertiserController.addCampaignLocations);

// Ad Management
router.post('/ads/upload', upload.single('file'), advertiserController.uploadAd);
router.post('/ads/:id/enhance', advertiserController.enhanceAd);

// Locations
router.get('/locations', advertiserController.getAvailableLocations);

module.exports = router;
