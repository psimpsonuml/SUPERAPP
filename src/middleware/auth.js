const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

// Authenticate via JWT token (for dashboard)
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Authenticate via API key (for API usage)
function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Provide your API key via the x-api-key header or api_key query parameter',
    });
  }

  const user = db.prepare('SELECT * FROM users WHERE api_key = ?').get(apiKey);
  if (!user) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Check monthly quota
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (user.month_reset !== currentMonth) {
    db.prepare('UPDATE users SET requests_this_month = 0, month_reset = ? WHERE id = ?').run(
      currentMonth,
      user.id
    );
    user.requests_this_month = 0;
  }

  const plan = config.plans[user.plan];
  if (user.requests_this_month >= plan.requestsPerMonth) {
    return res.status(429).json({
      error: 'Monthly quota exceeded',
      limit: plan.requestsPerMonth,
      used: user.requests_this_month,
      upgrade_url: `${config.baseUrl}/dashboard#pricing`,
    });
  }

  req.user = user;
  next();
}

module.exports = { authenticateToken, authenticateApiKey };
