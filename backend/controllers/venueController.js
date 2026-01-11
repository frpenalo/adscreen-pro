const db = require('../config/database');

class VenueController {
  // Get venue dashboard
  async getDashboard(req, res) {
    try {
      // Get venue info
      const venueResult = await db.query(`
        SELECT v.*, u.email, u.full_name
        FROM venues v
        JOIN users u ON v.user_id = u.id
        WHERE u.id = $1
      `, [req.user.id]);

      if (venueResult.rows.length === 0) {
        return res.status(404).json({ error: 'Venue not found' });
      }

      const venue = venueResult.rows[0];

      // Get screens
      const screensResult = await db.query(`
        SELECT * FROM screens WHERE venue_id = $1
      `, [venue.id]);

      // Get earnings stats
      const earningsStats = await db.query(`
        SELECT 
          COALESCE(SUM(amount), 0) as total_earned,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_earnings,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid_earnings
        FROM earnings
        WHERE venue_id = $1
      `, [venue.id]);

      // Get monthly earnings (last 6 months)
      const monthlyEarnings = await db.query(`
        SELECT 
          DATE_TRUNC('month', period_start) as month,
          SUM(amount) as earnings
        FROM earnings
        WHERE venue_id = $1
          AND period_start >= NOW() - INTERVAL '6 months'
        GROUP BY month
        ORDER BY month DESC
      `, [venue.id]);

      // Get active campaigns on screens
      const activeCampaigns = await db.query(`
        SELECT 
          c.campaign_name,
          a.business_name as advertiser,
          cl.weekly_cost,
          cl.impressions,
          s.screen_name
        FROM campaign_locations cl
        JOIN campaigns c ON cl.campaign_id = c.id
        JOIN advertisers a ON c.advertiser_id = a.id
        JOIN screens s ON cl.screen_id = s.id
        WHERE s.venue_id = $1 AND cl.status = 'active'
      `, [venue.id]);

      res.json({
        venue: venue,
        screens: screensResult.rows,
        earnings: {
          ...earningsStats.rows[0],
          currentBalance: venue.current_balance,
          monthlyEarnings: monthlyEarnings.rows
        },
        activeCampaigns: activeCampaigns.rows
      });
    } catch (error) {
      console.error('Venue dashboard error:', error);
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  }

  // Get earnings history
  async getEarnings(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // Get venue
      const venueResult = await db.query(
        'SELECT id FROM venues WHERE user_id = $1',
        [req.user.id]
      );

      if (venueResult.rows.length === 0) {
        return res.status(404).json({ error: 'Venue not found' });
      }

      const venueId = venueResult.rows[0].id;

      const result = await db.query(`
        SELECT 
          e.*,
          c.campaign_name,
          a.business_name as advertiser,
          s.screen_name
        FROM earnings e
        JOIN campaign_locations cl ON e.campaign_location_id = cl.id
        JOIN campaigns c ON cl.campaign_id = c.id
        JOIN advertisers a ON c.advertiser_id = a.id
        JOIN screens s ON cl.screen_id = s.id
        WHERE e.venue_id = $1
        ORDER BY e.created_at DESC
        LIMIT $2 OFFSET $3
      `, [venueId, limit, offset]);

      const countResult = await db.query(
        'SELECT COUNT(*) FROM earnings WHERE venue_id = $1',
        [venueId]
      );

      res.json({
        earnings: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      });
    } catch (error) {
      console.error('Get earnings error:', error);
      res.status(500).json({ error: 'Failed to get earnings' });
    }
  }

  // Request payout
  async requestPayout(req, res) {
    try {
      const { amount, payoutMethod, payoutDetails } = req.body;

      // Get venue
      const venueResult = await db.query(
        'SELECT * FROM venues WHERE user_id = $1',
        [req.user.id]
      );

      if (venueResult.rows.length === 0) {
        return res.status(404).json({ error: 'Venue not found' });
      }

      const venue = venueResult.rows[0];

      // Validate amount
      const minPayout = parseFloat(process.env.MINIMUM_PAYOUT) || 100;
      if (amount < minPayout) {
        return res.status(400).json({ 
          error: `Minimum payout amount is $${minPayout}` 
        });
      }

      if (amount > venue.current_balance) {
        return res.status(400).json({ 
          error: 'Insufficient balance' 
        });
      }

      // Create payout request
      const result = await db.query(`
        INSERT INTO payout_requests 
        (venue_id, amount, payout_method, payout_details)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [venue.id, amount, payoutMethod, JSON.stringify(payoutDetails)]);

      res.json({
        message: 'Payout request submitted successfully',
        payoutRequest: result.rows[0]
      });
    } catch (error) {
      console.error('Request payout error:', error);
      res.status(500).json({ error: 'Failed to request payout' });
    }
  }

  // Get payout history
  async getPayoutHistory(req, res) {
    try {
      const venueResult = await db.query(
        'SELECT id FROM venues WHERE user_id = $1',
        [req.user.id]
      );

      if (venueResult.rows.length === 0) {
        return res.status(404).json({ error: 'Venue not found' });
      }

      const result = await db.query(`
        SELECT * FROM payout_requests
        WHERE venue_id = $1
        ORDER BY created_at DESC
      `, [venueResult.rows[0].id]);

      res.json({ payouts: result.rows });
    } catch (error) {
      console.error('Get payout history error:', error);
      res.status(500).json({ error: 'Failed to get payout history' });
    }
  }

  // Update venue profile
  async updateProfile(req, res) {
    try {
      const {
        businessName,
        address,
        city,
        state,
        zipCode,
        payoutMethod,
        payoutEmail,
        payoutPhone
      } = req.body;

      const result = await db.query(`
        UPDATE venues 
        SET business_name = COALESCE($1, business_name),
            address = COALESCE($2, address),
            city = COALESCE($3, city),
            state = COALESCE($4, state),
            zip_code = COALESCE($5, zip_code),
            payout_method = COALESCE($6, payout_method),
            payout_email = COALESCE($7, payout_email),
            payout_phone = COALESCE($8, payout_phone)
        WHERE user_id = $9
        RETURNING *
      `, [
        businessName, address, city, state, zipCode,
        payoutMethod, payoutEmail, payoutPhone,
        req.user.id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Venue not found' });
      }

      res.json({
        message: 'Profile updated successfully',
        venue: result.rows[0]
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
}

module.exports = new VenueController();
