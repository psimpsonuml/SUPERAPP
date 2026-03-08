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
  res.json({
    status: 'ok',
    service: 'beaconops',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Parse JSON for all routes except Stripe webhook (needs raw body)
app.use('/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Account context middleware — sets accountId for multi-tenant isolation
// In production, this would extract from JWT/session; for personal use, uses default account
app.use('/api', (req, _res, next) => {
  req.accountId = req.headers['x-account-id'] || process.env.DEFAULT_ACCOUNT_ID || 'default';
  next();
});

// BeaconOps Dashboard API
app.use('/api/approval', approvalRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportRoutes);

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
}

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist. See / for available endpoints.',
  });
});

// Start server
const port = config.port;
app.listen(port, () => {
  logger.info(`BeaconOps dashboard server running on port ${port}`);
});

module.exports = app;
