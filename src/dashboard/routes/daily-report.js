const express = require('express');
const AnalyticsPipeline = require('../../shared/analytics');
const ApprovalQueueService = require('../../shared/approval-queue');
const logger = require('../../shared/logger');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

const DEFAULT_ACCOUNT_ID = process.env.DEFAULT_ACCOUNT_ID || '00000000-0000-0000-0000-000000000001';

// Verify Vercel Cron secret
function verifyCronSecret(req, res, next) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return next();
  }
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(verifyCronSecret);

// GET /api/cron/daily-report — compile and store daily report
router.get('/', async (req, res) => {
  const accountId = req.query.accountId || DEFAULT_ACCOUNT_ID;

  logger.info('Cron triggered: daily-report', { accountId });

  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const analytics = new AnalyticsPipeline(accountId);
    const approvalQueue = new ApprovalQueueService(accountId);
    const supabase = getSupabase();

    const reportData = await analytics.getDailyReportData();
    const queueStats = await approvalQueue.getStats();
    const health = await analytics.getAccountHealth();

    const report = {
      date: reportData.date,
      generatedAt: new Date().toISOString(),
      accountId,

      inbox: {
        emailsProcessed: reportData.contentProduced.filter(c => c.content_type === 'email_response').length,
      },

      content: {
        blogPosts: reportData.contentProduced.filter(c => c.content_type === 'blog_post').length,
        newsletters: reportData.contentProduced.filter(c => c.content_type === 'newsletter').length,
        socialPosts: reportData.contentProduced.filter(c => c.content_type === 'social_post').length,
        videos: reportData.contentProduced.filter(c => c.content_type === 'short_form_video').length,
        total: reportData.contentProduced.length,
      },

      painPoints: {
        detected: reportData.painPoints.length,
        topSignals: reportData.painPoints.slice(0, 5),
      },

      agentRuns: {
        total: reportData.agentRuns.length,
        completed: reportData.agentRuns.filter(r => r.status === 'completed').length,
        failed: reportData.agentRuns.filter(r => r.status === 'failed').length,
        skipped: reportData.agentRuns.filter(r => r.status === 'skipped').length,
      },

      approvalQueue: queueStats,

      infrastructure: {
        unresolvedAlerts: health.unresolvedAlerts.length,
        criticalAlerts: health.criticalAlerts,
        agentHealth: health.agentHealth,
      },
    };

    // Store report
    await analytics.recordEngagement('daily-report', { report });

    logger.info('Daily report compiled', {
      contentProduced: report.content.total,
      agentRuns: report.agentRuns.total,
      pendingApprovals: report.approvalQueue.pending,
    });

    return res.json({ ok: true, report });
  } catch (error) {
    logger.error(`Daily report failed: ${error.message}`, { error: error.message });
    return res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
