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

// Get campaigns
router.get('/campaigns', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'advertiser') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const advertiserResult = await db.query(
            'SELECT id FROM advertisers WHERE user_id = $1',
            [req.user.id]
        );

        if (advertiserResult.rows.length === 0) {
            return res.status(404).json({ error: 'Advertiser not found' });
        }

        const campaigns = await db.query(
            'SELECT * FROM campaigns WHERE advertiser_id = $1 ORDER BY created_at DESC',
            [advertiserResult.rows[0].id]
        );

        res.json({ campaigns: campaigns.rows });

    } catch (error) {
        console.error('Campaigns error:', error);
        res.status(500).json({ error: 'Failed to load campaigns' });
    }
});

// Get available locations
router.get('/locations', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'advertiser') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const locations = await db.query(
            `SELECT v.*, 
                    (SELECT COUNT(*) FROM screens WHERE venue_id = v.id) as screen_count
             FROM venues v 
             WHERE v.is_active = true 
             ORDER BY v.business_name`
        );

        res.json({ locations: locations.rows });

    } catch (error) {
        console.error('Locations error:', error);
        res.status(500).json({ error: 'Failed to load locations' });
    }
});

// Get transactions
router.get('/transactions', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'advertiser') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const advertiserResult = await db.query(
            'SELECT id FROM advertisers WHERE user_id = $1',
            [req.user.id]
        );

        if (advertiserResult.rows.length === 0) {
            return res.json({ transactions: [] });
        }

        const transactions = await db.query(
            'SELECT * FROM payment_transactions WHERE advertiser_id = $1 ORDER BY created_at DESC LIMIT 20',
            [advertiserResult.rows[0].id]
        );

        res.json({ transactions: transactions.rows });

    } catch (error) {
        console.error('Transactions error:', error);
        res.status(500).json({ error: 'Failed to load transactions' });
    }
});

module.exports = router;
