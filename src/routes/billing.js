const express = require('express');
const config = require('../config');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function getStripe() {
  if (!config.stripe.secretKey) return null;
  return require('stripe')(config.stripe.secretKey);
}

// GET /billing/plans
router.get('/plans', (_req, res) => {
  const plans = Object.entries(config.plans).map(([key, plan]) => ({
    id: key,
    ...plan,
  }));
  res.json({ plans });
});

// POST /billing/create-checkout
router.post('/create-checkout', authenticateToken, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }

  const { plan } = req.body;

  if (!['starter', 'pro', 'enterprise'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan selected' });
  }

  const priceId = config.stripe.prices[plan];
  if (!priceId) {
    return res.status(500).json({ error: 'Price not configured for this plan' });
  }

  try {
    // Create or retrieve Stripe customer
    let customerId = req.user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: { user_id: req.user.id.toString() },
      });
      customerId = customer.id;
      db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(
        customerId,
        req.user.id
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${config.baseUrl}/dashboard?upgraded=true`,
      cancel_url: `${config.baseUrl}/dashboard#pricing`,
      metadata: { user_id: req.user.id.toString(), plan },
    });

    res.json({ checkout_url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /billing/webhook (Stripe webhook)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).send();

  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send();
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata.user_id;
      const plan = session.metadata.plan;
      db.prepare(
        'UPDATE users SET plan = ?, stripe_subscription_id = ? WHERE id = ?'
      ).run(plan, session.subscription, userId);
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const user = db
        .prepare('SELECT id FROM users WHERE stripe_subscription_id = ?')
        .get(subscription.id);
      if (user) {
        db.prepare(
          'UPDATE users SET plan = ?, stripe_subscription_id = NULL WHERE id = ?'
        ).run('free', user.id);
      }
      break;
    }
  }

  res.json({ received: true });
});

// GET /billing/usage
router.get('/usage', authenticateToken, (req, res) => {
  const plan = config.plans[req.user.plan];

  // Get daily usage for the last 30 days
  const dailyUsage = db
    .prepare(
      `SELECT date(created_at) as date, COUNT(*) as count
       FROM api_logs
       WHERE user_id = ? AND created_at >= datetime('now', '-30 days')
       GROUP BY date(created_at)
       ORDER BY date ASC`
    )
    .all(req.user.id);

  // Get top endpoints
  const topEndpoints = db
    .prepare(
      `SELECT endpoint, COUNT(*) as count, AVG(response_time_ms) as avg_response_time
       FROM api_logs
       WHERE user_id = ? AND created_at >= datetime('now', '-30 days')
       GROUP BY endpoint
       ORDER BY count DESC
       LIMIT 10`
    )
    .all(req.user.id);

  res.json({
    plan: req.user.plan,
    requests_this_month: req.user.requests_this_month,
    monthly_limit: plan.requestsPerMonth,
    percentage_used: Math.round((req.user.requests_this_month / plan.requestsPerMonth) * 100),
    daily_usage: dailyUsage,
    top_endpoints: topEndpoints,
  });
});

module.exports = router;
