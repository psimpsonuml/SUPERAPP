require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const logger = require('./shared/logger');

// Dashboard API routes
const approvalRoutes = require('./dashboard/routes/approval');
const agentRoutes = require('./dashboard/routes/agents');
const settingsRoutes = require('./dashboard/routes/settings');
const reportRoutes = require('./dashboard/routes/reports');
const personalRoutes = require('./dashboard/routes/personal');
const tmdbRoutes = require('./dashboard/routes/tmdb');
const quizRoutes = require('./dashboard/routes/quiz');
const lifeManagerRoutes = require('./dashboard/routes/life-manager');
const releasesRoutes = require('./dashboard/routes/releases');
const infrastructureRoutes = require('./dashboard/routes/infrastructure');
const calendarRoutes = require('./dashboard/routes/calendar');
const onboardingRoutes = require('./dashboard/routes/onboarding');
const revenueRoutes = require('./dashboard/routes/revenue');
const knowledgeBaseRoutes = require('./dashboard/routes/knowledge-base');
const testimonialRoutes = require('./dashboard/routes/testimonials');
const partnerRoutes = require('./dashboard/routes/partners');
const journalRoutes = require('./dashboard/routes/journal');
const goalRoutes = require('./dashboard/routes/goals');
const nostalgiaRoutes = require('./dashboard/routes/nostalgia');
const recommendationRoutes = require('./dashboard/routes/recommendations');
const wrestlingRoutes = require('./dashboard/routes/wrestling');
const petRoutes = require('./dashboard/routes/pets');
const liveEventRoutes = require('./dashboard/routes/live-events');
const storeRoutes = require('./dashboard/routes/stores');
const podcastRoutes = require('./dashboard/routes/podcasts');
const prRoutes = require('./dashboard/routes/pr');
const designRoutes = require('./dashboard/routes/design');
const podcastProducerRoutes = require('./dashboard/routes/podcast-producer');
const beaconbotRoutes = require('./dashboard/routes/beaconbot');
const bookPublishingRoutes = require('./dashboard/routes/book-publishing');
const featureVisibilityRoutes = require('./dashboard/routes/feature-visibility');
const legalRoutes = require('./dashboard/routes/legal');
const faqRoutes = require('./dashboard/routes/faq');
const cronRoutes = require('./dashboard/routes/cron');
const dailyReportCronRoute = require('./dashboard/routes/daily-report');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());

// Root route
app.get('/', (_req, res) => {
  res.json({
    service: 'BeaconOps',
    version: '2.0.0',
    description: 'Autonomous Marketing, Content & Operations Engine',
    products: ['ChronoStates.io', 'Payroll Beacon', 'Budgeting Beacon'],
    endpoints: {
      health: '/health',
      api: '/api',
      approval: '/api/approval',
      agents: '/api/agents',
      settings: '/api/settings',
      reports: '/api/reports',
    },
  });
});

// Health check
app.get('/health', (_req, res) => {
  const { isSupabaseConfigured } = require('./db/supabase');
  res.json({
    status: 'ok',
    service: 'beaconops',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: config.env,
    vercel: !!process.env.VERCEL,
    scheduler: {
      mode: 'railway-bullmq',
      upstashConfigured: !!(process.env.UPSTASH_REDIS_URL),
      cronFallback: !!process.env.CRON_SECRET,
    },
    dependencies: {
      supabase: isSupabaseConfigured() ? 'connected' : 'not configured',
      supabaseEnv: {
        url: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
        serviceKey: !!(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
        anonKey: !!(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      },
    },
  });
});

// Parse JSON for all routes except Stripe webhook (needs raw body)
app.use('/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Account context middleware — sets accountId for multi-tenant isolation
// In production, this would extract from JWT/session; for personal use, uses default account
const DEFAULT_ACCOUNT_UUID = '00000000-0000-0000-0000-000000000001';
app.use('/api', (req, _res, next) => {
  req.accountId = req.headers['x-account-id'] || process.env.DEFAULT_ACCOUNT_ID || DEFAULT_ACCOUNT_UUID;
  next();
});

// Supabase availability guard — returns 503 instead of crashing with 500
const { isSupabaseConfigured } = require('./db/supabase');
const supabaseConfigured = isSupabaseConfigured();
if (!supabaseConfigured) {
  logger.warn('Supabase not configured — dashboard API routes will return mock/empty data. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
}

function requireSupabase(req, res, next) {
  if (!supabaseConfigured) {
    return res.status(503).json({
      error: 'Database not configured',
      message: 'Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env to enable this endpoint.',
      docs: 'Copy .env.example to .env and fill in your Supabase credentials.',
    });
  }
  next();
}

// BeaconOps Dashboard API
app.use('/api/approval', requireSupabase, approvalRoutes);
app.use('/api/agents', agentRoutes); // agents has its own graceful fallback
app.use('/api/settings', requireSupabase, settingsRoutes);
app.use('/api/reports', requireSupabase, reportRoutes);
app.use('/api/personal', personalRoutes); // personal module has its own graceful fallback
app.use('/api/tmdb', tmdbRoutes); // TMDB browse/rate with cascade scoring
app.use('/api/quiz', quizRoutes); // Profile quiz with 200+ questions
app.use('/api/life', lifeManagerRoutes); // Life Manager: routines, family log, streaks
app.use('/api/releases', releasesRoutes); // Releases: weekly TMDB digest with personalization
app.use('/api/infrastructure', infrastructureRoutes); // Infrastructure: status, uptime, alerts
app.use('/api/calendar', requireSupabase, calendarRoutes); // Content calendar: weekly schedule
app.use('/api/onboarding', requireSupabase, onboardingRoutes); // Onboarding: platform asset generation + setup checklists
app.use('/api/revenue', requireSupabase, revenueRoutes); // Revenue Dashboard: Stripe metrics, MRR, churn
app.use('/api/kb', requireSupabase, knowledgeBaseRoutes); // Knowledge Base: support articles, FAQ, gap detection
app.use('/api/testimonials', requireSupabase, testimonialRoutes); // Testimonials: social proof library
app.use('/api/partners', requireSupabase, partnerRoutes); // Affiliate/Partner Manager: referrals, commissions
app.use('/api/journal', requireSupabase, journalRoutes); // Journal: daily reflection, sentiment tracking
app.use('/api/goals', requireSupabase, goalRoutes); // Goals: long-term aspirations, milestones
app.use('/api/nostalgia', requireSupabase, nostalgiaRoutes); // Nostalgia Engine: on-this-day memories
app.use('/api/recommendations', requireSupabase, recommendationRoutes); // Recommendations: curated lists, watch parties
app.use('/api/wrestling', requireSupabase, wrestlingRoutes); // Wrestling Tracker: scraped results, ratings, cascade
app.use('/api/pets', requireSupabase, petRoutes); // Pets: health records, milestones, expenses
app.use('/api/events', requireSupabase, liveEventRoutes); // Live Events: concerts, shows, map
app.use('/api/stores', requireSupabase, storeRoutes); // Stores: seller dashboard, tracker, wishlist
app.use('/api/podcasts', requireSupabase, podcastRoutes); // Podcasts: subscriptions, ratings, cascade
app.use('/api/pr', requireSupabase, prRoutes); // PR: media contacts, press releases, mentions
app.use('/api/design', requireSupabase, designRoutes); // Design Studio: asset generation, templates
app.use('/api/podcast-producer', requireSupabase, podcastProducerRoutes); // Podcast Producer: AI episodes
app.use('/api/beaconbot', requireSupabase, beaconbotRoutes); // BeaconBot: AI chatbot
app.use('/api/book-publishing', requireSupabase, bookPublishingRoutes); // Book Publishing: manuscripts, queries, sales
app.use('/api/features', requireSupabase, featureVisibilityRoutes); // Feature Visibility: control feature access per plan
app.use('/api/legal', requireSupabase, legalRoutes); // Legal: privacy policy, terms of service
app.use('/api/faq', faqRoutes); // FAQ: auto-generated feature documentation

// Vercel Cron endpoints — secured by CRON_SECRET, no Supabase guard (agents handle own DB)
app.use('/api/cron/daily-report', dailyReportCronRoute); // Daily report (must be before /api/cron/:agentId)
app.use('/api/cron', cronRoutes); // Agent cron triggers

// API info
app.get('/api', (_req, res) => {
  res.json({
    service: 'BeaconOps API',
    version: '2.0.0',
    endpoints: {
      approval: '/api/approval',
      agents: '/api/agents',
      settings: '/api/settings',
      reports: '/api/reports',
    },
  });
});

// Legacy routes (QuickAPI Hub) — loaded conditionally since they depend on better-sqlite3
try {
  const authRoutes = require('./routes/auth');
  const billingRoutes = require('./routes/billing');
  app.use('/auth', authRoutes);
  app.use('/billing', billingRoutes);
  logger.info('Legacy QuickAPI Hub routes loaded');
} catch (err) {
  logger.warn(`Legacy routes not loaded (${err.message}). This is expected if better-sqlite3 is not installed.`);
  // Serve stubs so callers get a clear error instead of 404
  const unavailable = (_req, res) => {
    res.status(503).json({
      error: 'Service unavailable',
      message: 'Legacy QuickAPI Hub routes require better-sqlite3. Install it or use the BeaconOps API at /api.',
    });
  };
  app.use('/auth', unavailable);
  app.use('/billing', unavailable);
}

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist. See / for available endpoints.',
  });
});

// Start server (only when run directly, not on Vercel)
if (!process.env.VERCEL) {
  const port = config.port;
  app.listen(port, () => {
    logger.info(`BeaconOps dashboard server running on port ${port}`);
    // Run database health check after server is listening (non-blocking)
    const { autoMigrate } = require('./db/auto-migrate');
    autoMigrate().catch(err => logger.warn(`Auto-migrate check failed: ${err.message}`));
  });
}

module.exports = app;
