const rateLimit = require('express-rate-limit');
const config = require('../config');

// Dynamic rate limiting based on user plan
function createApiRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: (req) => {
      if (!req.user) return 10;
      const plan = config.plans[req.user.plan];
      return plan ? plan.rateLimit : 10;
    },
    message: (req) => {
      const plan = req.user ? config.plans[req.user.plan] : config.plans.free;
      return {
        error: 'Rate limit exceeded',
        limit: plan.rateLimit,
        window: '1 minute',
        upgrade_url: `${config.baseUrl}/dashboard#pricing`,
      };
    },
    keyGenerator: (req) => {
      return req.user ? `user_${req.user.id}` : req.ip;
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

// General rate limiter for auth endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { createApiRateLimiter, authRateLimiter };
