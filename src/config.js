require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    prices: {
      starter: process.env.STRIPE_PRICE_STARTER,
      pro: process.env.STRIPE_PRICE_PRO,
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
    },
  },
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  // Plan definitions
  plans: {
    free: {
      name: 'Free',
      requestsPerMonth: 1000,
      rateLimit: 10, // requests per minute
      price: 0,
    },
    starter: {
      name: 'Starter',
      requestsPerMonth: 25000,
      rateLimit: 60,
      price: 19,
    },
    pro: {
      name: 'Pro',
      requestsPerMonth: 100000,
      rateLimit: 200,
      price: 49,
    },
    enterprise: {
      name: 'Enterprise',
      requestsPerMonth: 1000000,
      rateLimit: 1000,
      price: 199,
    },
  },
};
