const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database');

class PaymentController {
  // Create payment intent for advertiser
  async createPaymentIntent(req, res) {
    try {
      const { amount } = req.body;

      if (!amount || amount < 10) {
        return res.status(400).json({ error: 'Minimum amount is $10' });
      }

      // Get advertiser
      const advertiserResult = await db.query(
        'SELECT * FROM advertisers WHERE user_id = $1',
        [req.user.id]
      );

      if (advertiserResult.rows.length === 0) {
        return res.status(404).json({ error: 'Advertiser not found' });
      }

      const advertiser = advertiserResult.rows[0];

      // Create or get Stripe customer
      let customerId = advertiser.stripe_customer_id;

      if (!customerId) {
        const userResult = await db.query(
          'SELECT email, full_name FROM users WHERE id = $1',
          [req.user.id]
        );

        const customer = await stripe.customers.create({
          email: userResult.rows[0].email,
          name: userResult.rows[0].full_name,
          metadata: {
            advertiserId: advertiser.id
          }
        });

        customerId = customer.id;

        await db.query(
          'UPDATE advertisers SET stripe_customer_id = $1 WHERE id = $2',
          [customerId, advertiser.id]
        );
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        customer: customerId,
        metadata: {
          advertiserId: advertiser.id,
          userId: req.user.id
        }
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });
    } catch (error) {
      console.error('Create payment intent error:', error);
      res.status(500).json({ error: 'Failed to create payment intent' });
    }
  }

  // Handle successful payment (webhook)
  async handlePaymentSuccess(req, res) {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      
      try {
        const advertiserId = paymentIntent.metadata.advertiserId;
        const amount = paymentIntent.amount / 100; // Convert from cents

        const client = await db.pool.connect();
        
        try {
          await client.query('BEGIN');

          // Record transaction
          await client.query(`
            INSERT INTO payment_transactions 
            (advertiser_id, amount, transaction_type, stripe_payment_intent_id, status)
            VALUES ($1, $2, 'deposit', $3, 'succeeded')
          `, [advertiserId, amount, paymentIntent.id]);

          // Update advertiser balance
          await client.query(`
            UPDATE advertisers 
            SET account_balance = account_balance + $1,
                total_spent = total_spent + $1
            WHERE id = $2
          `, [amount, advertiserId]);

          await client.query('COMMIT');

          console.log(`✅ Payment processed: $${amount} for advertiser ${advertiserId}`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        console.error('Payment processing error:', error);
      }
    }

    res.json({ received: true });
  }

  // Get payment history
  async getPaymentHistory(req, res) {
    try {
      const advertiserResult = await db.query(
        'SELECT id FROM advertisers WHERE user_id = $1',
        [req.user.id]
      );

      if (advertiserResult.rows.length === 0) {
        return res.status(404).json({ error: 'Advertiser not found' });
      }

      const result = await db.query(`
        SELECT * FROM payment_transactions
        WHERE advertiser_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `, [advertiserResult.rows[0].id]);

      res.json({ transactions: result.rows });
    } catch (error) {
      console.error('Get payment history error:', error);
      res.status(500).json({ error: 'Failed to get payment history' });
    }
  }

  // Get advertiser balance
  async getBalance(req, res) {
    try {
      const result = await db.query(`
        SELECT account_balance, total_spent
        FROM advertisers
        WHERE user_id = $1
      `, [req.user.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Advertiser not found' });
      }

      res.json({ balance: result.rows[0] });
    } catch (error) {
      console.error('Get balance error:', error);
      res.status(500).json({ error: 'Failed to get balance' });
    }
  }
}

module.exports = new PaymentController();
