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
  });
}

module.exports = app;
