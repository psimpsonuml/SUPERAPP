const express = require('express');
const { createAgent, registry } = require('../../agents/registry');
const logger = require('../../shared/logger');

const router = express.Router();

const DEFAULT_ACCOUNT_ID = process.env.DEFAULT_ACCOUNT_ID || '00000000-0000-0000-0000-000000000001';

// Verify Vercel Cron secret to prevent unauthorized invocations
function verifyCronSecret(req, res, next) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.warn('CRON_SECRET not set — cron endpoints are unprotected');
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${cronSecret}`) {
    logger.warn('Cron request rejected — invalid or missing authorization', {
      path: req.path,
      ip: req.ip,
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

router.use(verifyCronSecret);

// GET /api/cron/batch/run — run multiple agents sequentially (must be before /:agentId)
// Usage: /api/cron/batch/run?agents=intelligence-analyst,product-intelligence
router.get('/batch/run', async (req, res) => {
  const agentIds = (req.query.agents || '').split(',').filter(Boolean);
  const accountId = req.query.accountId || DEFAULT_ACCOUNT_ID;

  if (agentIds.length === 0) {
    return res.status(400).json({ error: 'No agents specified. Use ?agents=agent1,agent2' });
  }

  const results = [];

  for (const agentId of agentIds) {
    if (!registry[agentId]) {
      results.push({ agentId, ok: false, error: `Unknown agent: ${agentId}` });
      continue;
    }

    try {
      logger.info(`Cron batch triggered: ${agentId}`, { agentId, accountId });
      const agent = createAgent(agentId, accountId);
      const result = await agent.execute();
      results.push({ agentId, ok: true, status: result.status });
    } catch (error) {
      logger.error(`Cron batch failed: ${agentId}: ${error.message}`, { agentId });
      results.push({ agentId, ok: false, error: error.message });
    }
  }

  const allOk = results.every(r => r.ok);
  return res.status(allOk ? 200 : 207).json({ ok: allOk, results });
});

// GET /api/cron/:agentId — run a single agent on its cron schedule
router.get('/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const accountId = req.query.accountId || DEFAULT_ACCOUNT_ID;

  if (!registry[agentId]) {
    return res.status(404).json({ error: `Unknown agent: ${agentId}` });
  }

  logger.info(`Cron triggered: ${agentId}`, { agentId, accountId });

  try {
    const agent = createAgent(agentId, accountId);
    const result = await agent.execute();

    logger.info(`Cron completed: ${agentId}`, {
      agentId,
      status: result.status,
      itemsProduced: result.itemsProduced,
    });

    return res.json({
      ok: true,
      agentId,
      status: result.status,
      itemsProduced: result.itemsProduced,
    });
  } catch (error) {
    logger.error(`Cron failed: ${agentId}: ${error.message}`, {
      agentId,
      error: error.message,
    });

    return res.status(500).json({
      ok: false,
      agentId,
      error: error.message,
    });
  }
});

module.exports = router;
