const db = require('../config/database');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class AdvertiserController {
  // Get advertiser dashboard
  async getDashboard(req, res) {
    try {
      // Get advertiser info
      const advertiserResult = await db.query(`
        SELECT a.*, u.email, u.full_name
        FROM advertisers a
        JOIN users u ON a.user_id = u.id
        WHERE u.id = $1
      `, [req.user.id]);

      if (advertiserResult.rows.length === 0) {
        return res.status(404).json({ error: 'Advertiser not found' });
      }

      const advertiser = advertiserResult.rows[0];

      // Get campaign stats
      const campaignStats = await db.query(`
        SELECT 
          COUNT(*) as total_campaigns,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_campaigns,
          COALESCE(SUM(spent), 0) as total_spent,
          COALESCE(SUM(budget - spent), 0) as remaining_budget
        FROM campaigns
        WHERE advertiser_id = $1
      `, [advertiser.id]);

      // Get ad stats
      const adStats = await db.query(`
        SELECT 
          COUNT(*) as total_ads,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_ads,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_ads,
          COALESCE(SUM(total_impressions), 0) as total_impressions
        FROM ads
        WHERE advertiser_id = $1
      `, [advertiser.id]);

      // Get recent campaigns
      const recentCampaigns = await db.query(`
        SELECT c.*,
          (SELECT COUNT(*) FROM ads WHERE campaign_id = c.id) as ad_count,
          (SELECT COUNT(*) FROM campaign_locations WHERE campaign_id = c.id) as location_count
        FROM campaigns c
        WHERE c.advertiser_id = $1
        ORDER BY c.created_at DESC
        LIMIT 5
      `, [advertiser.id]);

      res.json({
        advertiser: advertiser,
        campaignStats: campaignStats.rows[0],
        adStats: adStats.rows[0],
        recentCampaigns: recentCampaigns.rows
      });
    } catch (error) {
      console.error('Advertiser dashboard error:', error);
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  }

  // Create new campaign
  async createCampaign(req, res) {
    try {
      const { campaignName, budget, startDate, endDate } = req.body;

      if (!campaignName || !budget) {
        return res.status(400).json({ error: 'Campaign name and budget required' });
      }

      // Get advertiser
      const advertiserResult = await db.query(
        'SELECT id FROM advertisers WHERE user_id = $1',
        [req.user.id]
      );

      if (advertiserResult.rows.length === 0) {
        return res.status(404).json({ error: 'Advertiser not found' });
      }

      const advertiserId = advertiserResult.rows[0].id;

      const result = await db.query(`
        INSERT INTO campaigns (advertiser_id, campaign_name, budget, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [advertiserId, campaignName, budget, startDate, endDate]);

      res.status(201).json({
        message: 'Campaign created successfully',
        campaign: result.rows[0]
      });
    } catch (error) {
      console.error('Create campaign error:', error);
      res.status(500).json({ error: 'Failed to create campaign' });
    }
  }

  // Upload and enhance ad (image)
  async uploadAd(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { campaignId, title, description, duration } = req.body;

      if (!campaignId) {
        return res.status(400).json({ error: 'Campaign ID required' });
      }

      // Get advertiser
      const advertiserResult = await db.query(
        'SELECT id FROM advertisers WHERE user_id = $1',
        [req.user.id]
      );

      if (advertiserResult.rows.length === 0) {
        return res.status(404).json({ error: 'Advertiser not found' });
      }

      const advertiserId = advertiserResult.rows[0].id;

      // Determine ad type
      const adType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

      // Create ad record
      const result = await db.query(`
        INSERT INTO ads 
        (campaign_id, advertiser_id, ad_type, file_path, title, description, duration)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        campaignId,
        advertiserId,
        adType,
        req.file.path,
        title,
        description,
        duration || 10
      ]);

      res.status(201).json({
        message: 'Ad uploaded successfully',
        ad: result.rows[0]
      });
    } catch (error) {
      console.error('Upload ad error:', error);
      res.status(500).json({ error: 'Failed to upload ad' });
    }
  }

  // Enhance ad with Gemini AI
  async enhanceAd(req, res) {
    try {
      const { id } = req.params;
      const { prompt, textOverlay } = req.body;

      // Get ad
      const adResult = await db.query(
        'SELECT * FROM ads WHERE id = $1',
        [id]
      );

      if (adResult.rows.length === 0) {
        return res.status(404).json({ error: 'Ad not found' });
      }

      const ad = adResult.rows[0];

      if (ad.ad_type !== 'image') {
        return res.status(400).json({ error: 'Only images can be enhanced' });
      }

      // Read the image file
      const imageBuffer = await fs.readFile(ad.file_path);
      const base64Image = imageBuffer.toString('base64');

      // Call Gemini API for enhancement
      const geminiResponse = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [
              {
                text: prompt || "Enhance this food image to make it look more appetizing. Improve brightness, contrast, and color saturation to make it look professional and delicious."
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Image
                }
              }
            ]
          }]
        }
      );

      // Note: Gemini doesn't actually return enhanced images yet
      // This is a placeholder for when that functionality is available
      // For now, we'll mark it as enhanced and could use other services

      // Update ad with enhancement note
      const updateResult = await db.query(`
        UPDATE ads 
        SET enhanced_file_path = $1
        WHERE id = $2
        RETURNING *
      `, [ad.file_path, id]); // For now, same file

      res.json({
        message: 'Ad enhancement request processed',
        ad: updateResult.rows[0],
        geminiResponse: geminiResponse.data
      });
    } catch (error) {
      console.error('Enhance ad error:', error);
      res.status(500).json({ error: 'Failed to enhance ad' });
    }
  }

  // Get available locations for campaign
  async getAvailableLocations(req, res) {
    try {
      const { zipCode, radius } = req.query;

      let query = `
        SELECT 
          v.id as venue_id,
          v.business_name,
          v.address,
          v.city,
          v.state,
          v.zip_code,
          v.latitude,
          v.longitude,
          s.id as screen_id,
          s.screen_name,
          s.estimated_daily_views,
          35.00 as weekly_cost
        FROM venues v
        JOIN screens s ON v.id = s.venue_id
        WHERE v.is_active = true AND s.status = 'active'
      `;

      const params = [];

      if (zipCode) {
        params.push(zipCode);
        query += ` AND v.zip_code = $${params.length}`;
      }

      query += ' ORDER BY v.city, v.business_name';

      const result = await db.query(query, params);

      res.json({ locations: result.rows });
    } catch (error) {
      console.error('Get locations error:', error);
      res.status(500).json({ error: 'Failed to get locations' });
    }
  }

  // Add locations to campaign
  async addCampaignLocations(req, res) {
    try {
      const { campaignId } = req.params;
      const { screenIds, startDate, endDate } = req.body;

      if (!screenIds || screenIds.length === 0) {
        return res.status(400).json({ error: 'At least one screen required' });
      }

      const weeklyCost = 35.00; // Default cost per screen per week

      const client = await db.pool.connect();
      
      try {
        await client.query('BEGIN');

        const locations = [];

        for (const screenId of screenIds) {
          const result = await client.query(`
            INSERT INTO campaign_locations 
            (campaign_id, screen_id, weekly_cost, start_date, end_date)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (campaign_id, screen_id) DO NOTHING
            RETURNING *
          `, [campaignId, screenId, weeklyCost, startDate, endDate]);

          if (result.rows.length > 0) {
            locations.push(result.rows[0]);
          }
        }

        await client.query('COMMIT');

        res.json({
          message: 'Locations added to campaign',
          locations: locations
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Add campaign locations error:', error);
      res.status(500).json({ error: 'Failed to add locations' });
    }
  }

  // Get campaign analytics
  async getCampaignAnalytics(req, res) {
    try {
      const { id } = req.params;

      const campaign = await db.query(`
        SELECT c.*,
          (SELECT COUNT(*) FROM ads WHERE campaign_id = c.id) as total_ads,
          (SELECT COUNT(*) FROM campaign_locations WHERE campaign_id = c.id) as total_locations,
          (SELECT COALESCE(SUM(impressions), 0) FROM campaign_locations WHERE campaign_id = c.id) as total_impressions
        FROM campaigns c
        WHERE c.id = $1
      `, [id]);

      if (campaign.rows.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Get impressions by day (last 30 days)
      const impressionsByDay = await db.query(`
        SELECT 
          DATE(i.displayed_at) as date,
          COUNT(*) as impressions
        FROM impressions i
        JOIN ads a ON i.ad_id = a.id
        WHERE a.campaign_id = $1
          AND i.displayed_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(i.displayed_at)
        ORDER BY date DESC
      `, [id]);

      // Get performance by location
      const locationPerformance = await db.query(`
        SELECT 
          v.business_name,
          v.city,
          s.screen_name,
          cl.impressions,
          cl.weekly_cost,
          CASE WHEN cl.impressions > 0 
            THEN (cl.weekly_cost / cl.impressions) 
            ELSE 0 
          END as cost_per_impression
        FROM campaign_locations cl
        JOIN screens s ON cl.screen_id = s.id
        JOIN venues v ON s.venue_id = v.id
        WHERE cl.campaign_id = $1
        ORDER BY cl.impressions DESC
      `, [id]);

      res.json({
        campaign: campaign.rows[0],
        impressionsByDay: impressionsByDay.rows,
        locationPerformance: locationPerformance.rows
      });
    } catch (error) {
      console.error('Get campaign analytics error:', error);
      res.status(500).json({ error: 'Failed to get analytics' });
    }
  }
}

module.exports = new AdvertiserController();
