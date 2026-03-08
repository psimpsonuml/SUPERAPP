const express = require('express');
const ApprovalQueueService = require('../../shared/approval-queue');

const router = express.Router();

// GET /api/approval — alias for /pending (most common dashboard request)
router.get('/', async (req, res) => {
  try {
    const queue = new ApprovalQueueService(req.accountId);
    const items = await queue.getPending({
      agentId: req.query.agent,
      tier: req.query.tier ? parseInt(req.query.tier, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
    });
    res.json({ items, count: items.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/approval/pending
router.get('/pending', async (req, res) => {
  try {
    const queue = new ApprovalQueueService(req.accountId);
    const items = await queue.getPending({
      agentId: req.query.agent,
      tier: req.query.tier ? parseInt(req.query.tier, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
    });
    res.json({ items, count: items.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/approval/stats
router.get('/stats', async (req, res) => {
  try {
    const queue = new ApprovalQueueService(req.accountId);
    const stats = await queue.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/approval/overdue
router.get('/overdue', async (req, res) => {
  try {
    const queue = new ApprovalQueueService(req.accountId);
    const items = await queue.getOverdue();
    res.json({ items, count: items.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/approval/:id/approve
router.post('/:id/approve', async (req, res) => {
  try {
    const queue = new ApprovalQueueService(req.accountId);
    const item = await queue.approve(req.params.id, req.body.notes);
    res.json({ status: 'approved', item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/approval/:id/reject
router.post('/:id/reject', async (req, res) => {
  try {
    const queue = new ApprovalQueueService(req.accountId);
    const item = await queue.reject(req.params.id, req.body.notes);
    res.json({ status: 'rejected', item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/approval/batch
router.post('/batch', async (req, res) => {
  try {
    const queue = new ApprovalQueueService(req.accountId);
    const { action, ids, notes } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approve or reject' });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }

    const results = [];
    for (const id of ids) {
      const result = action === 'approve'
        ? await queue.approve(id, notes)
        : await queue.reject(id, notes);
      results.push(result);
    }

    res.json({ action, processed: results.length, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
