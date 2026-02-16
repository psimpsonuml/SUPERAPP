const db = require('../db');

// Track API usage for analytics and billing
function trackUsage(req, res, next) {
  const startTime = Date.now();

  // Override res.json to capture status and log after response
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const responseTime = Date.now() - startTime;

    if (req.user) {
      // Increment usage counter
      db.prepare('UPDATE users SET requests_this_month = requests_this_month + 1 WHERE id = ?').run(
        req.user.id
      );

      // Log the request
      db.prepare(
        'INSERT INTO api_logs (user_id, endpoint, method, status_code, response_time_ms) VALUES (?, ?, ?, ?, ?)'
      ).run(req.user.id, req.originalUrl, req.method, res.statusCode, responseTime);
    }

    return originalJson(body);
  };

  next();
}

module.exports = { trackUsage };
