const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../config/database');
const auth = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/ads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb('Error: Images and videos only!');
        }
    }
});

// Get advertiser dashboard
router.get('/dashboard', auth, async (req, res) => {
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

        // Get campaigns count
        const campaignsResult = await db.query(
            'SELECT COUNT(*) as count FROM campaigns WHERE advertiser_id = $1 AND status = $2',
            [advertiser.id, 'active']
        );

        // Get total impressions (mock for now)
        const impressions = 0;

        res.json({
            businessName: advertiser.business_name,
            accountBalance: parseFloat(advertiser.account_balance),
            activeCampaigns: parseInt(campaignsResult.rows[0].count),
            totalSpent: parseFloat(advertiser.total_spent),
            totalImpressions: impressions,
            recentActivity: []
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
});

// Get campaigns
router.get('/campaigns', auth, async (req, res) => {
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
router.get('/locations', auth, async (req, res) => {
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

// Upload ad
router.post('/ads', auth, upload.single('file'), async (req, res) => {
    try {
        if (req.user.role !== 'advertiser') {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { title, description } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        // Get advertiser ID
        const advertiserResult = await db.query(
            'SELECT id FROM advertisers WHERE user_id = $1',
            [req.user.id]
        );

        if (advertiserResult.rows.length === 0) {
            return res.status(404).json({ error: 'Advertiser profile not found' });
        }

        const advertiserId = advertiserResult.rows[0].id;

        // Determine ad type
        const adType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';

        // Insert ad into database
        const result = await db.query(
            `INSERT INTO ads (advertiser_id, ad_type, file_path, title, description, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [advertiserId, adType, req.file.path, title, description || '', 'pending']
        );

        console.log('✅ Ad uploaded:', result.rows[0]);

        res.status(201).json({
            message: 'Ad submitted for approval',
            ad: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({ error: 'Failed to upload ad' });
    }
});

// Get transactions
router.get('/transactions', auth, async (req, res) => {
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
