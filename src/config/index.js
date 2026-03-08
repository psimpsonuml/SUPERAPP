require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  env: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: '30d',
  },

  supabase: {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  llm: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
    openai: { apiKey: process.env.OPENAI_API_KEY },
    deepseek: { apiKey: process.env.DEEPSEEK_API_KEY },
  },

  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    voices: {
      chronostates: process.env.ELEVENLABS_VOICE_CHRONOSTATES,
      payroll_beacon: process.env.ELEVENLABS_VOICE_PAYROLL,
      budgeting_beacon: process.env.ELEVENLABS_VOICE_BUDGETING,
    },
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY,
    notificationEmail: process.env.NOTIFICATION_EMAIL,
  },

  leadDataProvider: process.env.LEAD_DATA_PROVIDER || 'apollo',

  imageGen: {
    apiKey: process.env.IMAGE_GEN_API_KEY,
    provider: process.env.IMAGE_GEN_PROVIDER || 'openai',
  },

  urls: {
    base: process.env.BASE_URL || 'http://localhost:3000',
    chronostates: process.env.CHRONOSTATES_URL || 'https://chronostates.io',
    payrollBeacon: process.env.PAYROLL_BEACON_URL || 'https://payrollbeacon.com',
    budgetingBeacon: process.env.BUDGETING_BEACON_URL || 'https://budgetingbeacon.com',
  },

  products: ['chronostates', 'payroll_beacon', 'budgeting_beacon'],

  approvalSlider: {
    default: 60,
    tiers: {
      maxOversight: { min: 0, max: 25 },
      cautious: { min: 26, max: 50 },
      balanced: { min: 51, max: 75 },
      aggressive: { min: 76, max: 100 },
    },
  },

  agents: {
    retryAttempts: 3,
    retryBackoffMs: [1000, 2000, 4000],
    dailyReportHour: 10,
    timezone: 'America/New_York',
  },

  // Legacy compatibility (QuickAPI Hub routes)
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  plans: {
    free: { name: 'Free', requestsPerMonth: 1000, rateLimit: 10, price: 0 },
    starter: { name: 'Starter', requestsPerMonth: 25000, rateLimit: 60, price: 19 },
    pro: { name: 'Pro', requestsPerMonth: 100000, rateLimit: 200, price: 49 },
    enterprise: { name: 'Enterprise', requestsPerMonth: 1000000, rateLimit: 1000, price: 199 },
  },
};

module.exports = config;
