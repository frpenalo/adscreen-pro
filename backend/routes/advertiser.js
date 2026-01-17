const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

// Get advertiser dashboard
router.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'advertiser') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const advertiserResult = await db.query(
            'SELECT * FROM advertisers WHERE user_id = $1',
            [req.user.id]
        );

        if (advertiserResult.rows.length === 0) {
            return res.status(404).json({ error: 'Advertiser profile not found' });
        }

        const advertiser = advertiserResult.rows[0];

        res.json({
            businessName: advertiser.business_name,
            accountBalance: parseFloat(advertiser.account_balance || 0),
            activeCampaigns: 0,
            totalSpent: parseFloat(advertiser.total_spent || 0),
            totalImpressions: 0,
            recentActivity: []
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
});

module.exports = router;
