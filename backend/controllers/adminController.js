const db = require('../config/database');

class AdminController {
  // Get dashboard stats
  async getDashboard(req, res) {
    try {
      const stats = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM venues WHERE is_active = true) as active_venues,
          (SELECT COUNT(*) FROM screens WHERE status = 'active') as active_screens,
          (SELECT COUNT(*) FROM advertisers WHERE is_active = true) as active_advertisers,
          (SELECT COUNT(*) FROM campaigns WHERE status = 'active') as active_campaigns,
          (SELECT COUNT(*) FROM ads WHERE status = 'pending') as pending_ads,
          (SELECT COALESCE(SUM(total_spent), 0) FROM advertisers) as total_revenue,
          (SELECT COALESCE(SUM(current_balance), 0) FROM venues) as total_owed_to_venues,
          (SELECT COUNT(*) FROM impressions WHERE DATE(displayed_at) = CURRENT_DATE) as today_impressions
      `);

      // Get recent activity
      const recentAds = await db.query(`
        SELECT a.*, adv.business_name, c.campaign_name
        FROM ads a
        JOIN advertisers adv ON a.advertiser_id = adv.id
        JOIN campaigns c ON a.campaign_id = c.id
        WHERE a.status = 'pending'
        ORDER BY a.created_at DESC
        LIMIT 10
      `);

      // Revenue by month (last 6 months)
      const revenueData = await db.query(`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          SUM(amount) as revenue
        FROM payment_transactions
        WHERE transaction_type = 'deposit' 
          AND status = 'succeeded'
          AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY month
        ORDER BY month DESC
      `);

      res.json({
        stats: stats.rows[0],
        pendingAds: recentAds.rows,
        revenueData: revenueData.rows
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  }

  // Get pending ads for approval
  async getPendingAds(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const result = await db.query(`
        SELECT 
          a.*,
          adv.business_name as advertiser_name,
          c.campaign_name,
          u.email as advertiser_email
        FROM ads a
        JOIN advertisers adv ON a.advertiser_id = adv.id
        JOIN campaigns c ON a.campaign_id = c.id
        JOIN users u ON adv.user_id = u.id
        WHERE a.status = 'pending'
        ORDER BY a.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      const countResult = await db.query(
        `SELECT COUNT(*) FROM ads WHERE status = 'pending'`
      );

      res.json({
        ads: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      });
    } catch (error) {
      console.error('Get pending ads error:', error);
      res.status(500).json({ error: 'Failed to get pending ads' });
    }
  }

  // Approve ad
  async approveAd(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(`
        UPDATE ads 
        SET status = 'approved', 
            approved_by = $1, 
            approved_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [req.user.id, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ad not found' });
      }

      // TODO: Push to Yodeck playlist
      // await yodeckService.addAdToPlaylist(result.rows[0]);

      res.json({ 
        message: 'Ad approved successfully',
        ad: result.rows[0]
      });
    } catch (error) {
      console.error('Approve ad error:', error);
      res.status(500).json({ error: 'Failed to approve ad' });
    }
  }

  // Reject ad
  async rejectAd(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: 'Rejection reason required' });
      }

      const result = await db.query(`
        UPDATE ads 
        SET status = 'rejected', 
            rejection_reason = $1,
            approved_by = $2,
            approved_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [reason, req.user.id, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ad not found' });
      }

      res.json({ 
        message: 'Ad rejected',
        ad: result.rows[0]
      });
    } catch (error) {
      console.error('Reject ad error:', error);
      res.status(500).json({ error: 'Failed to reject ad' });
    }
  }

  // Get all venues
  async getVenues(req, res) {
    try {
      const result = await db.query(`
        SELECT 
          v.*,
          u.email,
          u.full_name,
          u.phone,
          (SELECT COUNT(*) FROM screens WHERE venue_id = v.id AND status = 'active') as screen_count
        FROM venues v
        JOIN users u ON v.user_id = u.id
        ORDER BY v.created_at DESC
      `);

      res.json({ venues: result.rows });
    } catch (error) {
      console.error('Get venues error:', error);
      res.status(500).json({ error: 'Failed to get venues' });
    }
  }

  // Update venue commission rate
  async updateVenueCommission(req, res) {
    try {
      const { id } = req.params;
      const { commissionRate } = req.body;

      if (!commissionRate || commissionRate < 0 || commissionRate > 100) {
        return res.status(400).json({ error: 'Invalid commission rate' });
      }

      const result = await db.query(`
        UPDATE venues 
        SET commission_rate = $1
        WHERE id = $2
        RETURNING *
      `, [commissionRate, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Venue not found' });
      }

      res.json({ 
        message: 'Commission rate updated',
        venue: result.rows[0]
      });
    } catch (error) {
      console.error('Update commission error:', error);
      res.status(500).json({ error: 'Failed to update commission' });
    }
  }

  // Get payout requests
  async getPayoutRequests(req, res) {
    try {
      const { status = 'pending' } = req.query;

      const result = await db.query(`
        SELECT 
          pr.*,
          v.business_name,
          u.email,
          u.phone
        FROM payout_requests pr
        JOIN venues v ON pr.venue_id = v.id
        JOIN users u ON v.user_id = u.id
        WHERE pr.status = $1
        ORDER BY pr.created_at DESC
      `, [status]);

      res.json({ payoutRequests: result.rows });
    } catch (error) {
      console.error('Get payout requests error:', error);
      res.status(500).json({ error: 'Failed to get payout requests' });
    }
  }

  // Process payout
  async processPayout(req, res) {
    try {
      const { id } = req.params;
      const { transactionId, notes } = req.body;

      // Start transaction
      const client = await db.pool.connect();
      
      try {
        await client.query('BEGIN');

        // Update payout request
        const payoutResult = await client.query(`
          UPDATE payout_requests 
          SET status = 'completed',
              transaction_id = $1,
              notes = $2,
              processed_by = $3,
              processed_at = CURRENT_TIMESTAMP
          WHERE id = $4
          RETURNING *
        `, [transactionId, notes, req.user.id, id]);

        if (payoutResult.rows.length === 0) {
          throw new Error('Payout request not found');
        }

        const payout = payoutResult.rows[0];

        // Update venue balance
        await client.query(`
          UPDATE venues 
          SET current_balance = current_balance - $1
          WHERE id = $2
        `, [payout.amount, payout.venue_id]);

        await client.query('COMMIT');

        res.json({ 
          message: 'Payout processed successfully',
          payout: payout
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Process payout error:', error);
      res.status(500).json({ error: 'Failed to process payout' });
    }
  }

  // Get financial reports
  async getFinancialReport(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const report = await db.query(`
        SELECT 
          DATE(pt.created_at) as date,
          SUM(CASE WHEN pt.transaction_type = 'deposit' THEN pt.amount ELSE 0 END) as revenue,
          COUNT(DISTINCT pt.advertiser_id) as advertisers,
          SUM(CASE WHEN e.status = 'paid' THEN e.amount ELSE 0 END) as venue_payouts
        FROM payment_transactions pt
        LEFT JOIN earnings e ON DATE(pt.created_at) = e.period_start
        WHERE pt.created_at >= $1 AND pt.created_at <= $2
        GROUP BY DATE(pt.created_at)
        ORDER BY date DESC
      `, [startDate || '2024-01-01', endDate || new Date().toISOString()]);

      res.json({ report: report.rows });
    } catch (error) {
      console.error('Financial report error:', error);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  }
}

module.exports = new AdminController();
