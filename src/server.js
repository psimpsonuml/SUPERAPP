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

// Legacy routes (from QuickAPI Hub — retained for backward compatibility)
const authRoutes = require('./routes/auth');
const billingRoutes = require('./routes/billing');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Account context middleware — sets accountId for multi-tenant isolation
// In production, this would extract from JWT/session; for personal use, uses default account
app.use('/api', (req, res, next) => {
  req.accountId = req.headers['x-account-id'] || process.env.DEFAULT_ACCOUNT_ID || 'default';
  next();
});

// BeaconOps Dashboard API
app.use('/api/approval', approvalRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportRoutes);

// Legacy routes
app.use('/auth', authRoutes);
app.use('/billing', billingRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'beaconops',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

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

// Start server
const port = config.port;
app.listen(port, () => {
  logger.info(`BeaconOps dashboard server running on port ${port}`);
});

module.exports = app;
