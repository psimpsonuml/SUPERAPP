const { Queue, Worker, QueueScheduler } = require('bullmq');
const IORedis = require('ioredis');
const config = require('../config');
const schedule = require('../config/schedule');
const { createAgent, registry } = require('../agents/registry');
const AnalyticsPipeline = require('../shared/analytics');
const ApprovalQueueService = require('../shared/approval-queue');
const logger = require('../shared/logger');

class Orchestrator {
  constructor(accountId) {
    this.accountId = accountId;
    this.connection = new IORedis(config.redis.url, { maxRetriesPerRequest: null });
    this.queues = {};
    this.workers = {};
    this.analytics = new AnalyticsPipeline(accountId);
    this.approvalQueue = new ApprovalQueueService(accountId);
  }

  async start() {
    logger.info('Starting BeaconOps Orchestrator', { accountId: this.accountId });

    // Create task queue
    this.taskQueue = new Queue('beaconops-tasks', {
      connection: this.connection,
      defaultJobOptions: {
        attempts: config.agents.retryAttempts,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      },
    });

    // Create worker to process agent tasks
    this.worker = new Worker('beaconops-tasks', async (job) => {
      return this.processAgentJob(job);
    }, {
      connection: this.connection,
      concurrency: 3,
    });

    this.worker.on('completed', (job, result) => {
      logger.info(`Job completed: ${job.name}`, {
        agentId: job.data.agentId,
        result: result?.status,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error(`Job failed: ${job.name}: ${error.message}`, {
        agentId: job?.data?.agentId,
        attempt: job?.attemptsMade,
      });

      // Check if this is a critical agent
      const agentEntry = registry[job?.data?.agentId];
      if (agentEntry?.criticalOnFailure && job?.attemptsMade >= config.agents.retryAttempts) {
        this.sendCriticalAlert(job.data.agentId, error.message);
      }
    });

    // Schedule all agents
    await this.scheduleAgents();

    logger.info('BeaconOps Orchestrator started successfully', {
      scheduledAgents: Object.keys(registry).length,
    });
  }

  async scheduleAgents() {
    // Schedule continuous agents
    for (const agent of schedule.continuous) {
      await this.taskQueue.add(agent.agentId, {
        agentId: agent.agentId,
        accountId: this.accountId,
      }, {
        repeat: { pattern: agent.interval },
        jobId: `${agent.agentId}-repeat`,
      });
      logger.info(`Scheduled continuous agent: ${agent.agentId}`, { pattern: agent.interval });
    }

    // Schedule daily agents
    for (const agent of schedule.daily) {
      await this.taskQueue.add(agent.agentId, {
        agentId: agent.agentId,
        accountId: this.accountId,
      }, {
        repeat: { pattern: agent.cron, tz: config.agents.timezone },
        jobId: `${agent.agentId}-daily`,
      });
      logger.info(`Scheduled daily agent: ${agent.agentId}`, { cron: agent.cron });
    }

    // Schedule weekly agents
    for (const agent of schedule.weekly) {
      await this.taskQueue.add(agent.agentId, {
        agentId: agent.agentId,
        accountId: this.accountId,
      }, {
        repeat: { pattern: agent.cron, tz: config.agents.timezone },
        jobId: `${agent.agentId}-weekly`,
      });
      logger.info(`Scheduled weekly agent: ${agent.agentId}`, { cron: agent.cron });
    }

    // Schedule daily report
    await this.taskQueue.add('daily-report', {
      agentId: 'daily-report',
      accountId: this.accountId,
    }, {
      repeat: { pattern: schedule.dailyReport.cron, tz: config.agents.timezone },
      jobId: 'daily-report-repeat',
    });
    logger.info('Scheduled daily report', { cron: schedule.dailyReport.cron });
  }

  async processAgentJob(job) {
    const { agentId, accountId } = job.data;

    if (agentId === 'daily-report') {
      return this.compileDailyReport();
    }

    try {
      const agent = createAgent(agentId, accountId);
      const result = await agent.execute();
      return result;
    } catch (error) {
      logger.error(`Agent execution failed: ${agentId}`, {
        error: error.message,
        attempt: job.attemptsMade,
      });
      throw error;
    }
  }

  async runAgent(agentId) {
    logger.info(`Manual trigger: ${agentId}`, { accountId: this.accountId });
    return this.taskQueue.add(agentId, {
      agentId,
      accountId: this.accountId,
    }, {
      priority: 1,
    });
  }

  async compileDailyReport() {
    logger.info('Compiling daily report', { accountId: this.accountId });

    const reportData = await this.analytics.getDailyReportData();
    const queueStats = await this.approvalQueue.getStats();
    const health = await this.analytics.getAccountHealth();

    const report = {
      date: reportData.date,
      generatedAt: new Date().toISOString(),
      accountId: this.accountId,

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

      qa: {
        results: reportData.qaResults,
        passRate: reportData.qaResults.length > 0
          ? reportData.qaResults.filter(r => r.pass_fail === 'pass').length / reportData.qaResults.length
          : null,
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

      lifecycle: {
        updates: reportData.lifecycleStats.length,
      },

      social: {
        postsScheduled: reportData.contentProduced.filter(c => c.content_type === 'social_post' && c.status === 'draft').length,
        postsPublished: reportData.contentProduced.filter(c => c.content_type === 'social_post' && c.status === 'published').length,
      },

      intelligence: await this.compileIntelligenceBriefing(),
    };

    // Store report
    await this.analytics.recordEngagement('daily-report', { report });

    // TODO: Send report via email and push to dashboard
    logger.info('Daily report compiled', {
      contentProduced: report.content.total,
      agentRuns: report.agentRuns.total,
      pendingApprovals: report.approvalQueue.pending,
      intelligenceFindings: report.intelligence.totalActive,
    });

    return report;
  }

  async compileIntelligenceBriefing() {
    try {
      const { getSupabase, isSupabaseConfigured } = require('../db/supabase');
      if (!isSupabaseConfigured()) return { totalActive: 0, topOpportunities: [], byCategory: {} };

      const supabase = getSupabase();

      // Get all active (not completed/passed) intelligence entries
      const { data: active } = await supabase
        .from('intelligence_log')
        .select('*')
        .eq('account_id', this.accountId)
        .in('status', ['discovered', 'new', 'contacted', 'in_progress'])
        .order('date_found', { ascending: false })
        .limit(200);

      if (!active || active.length === 0) {
        return { totalActive: 0, topOpportunities: [], byCategory: {} };
      }

      // ROI-rank top 10
      const scored = active.map(entry => {
        const reach = entry.potential_reach || 1;
        const relevance = entry.relevance_score || 5;
        const cost = Math.max(entry.estimated_cost || 1, 1);
        return { ...entry, roiScore: (reach * relevance) / cost };
      }).sort((a, b) => b.roiScore - a.roiScore);

      const topOpportunities = scored.slice(0, 10).map(e => ({
        name: e.name,
        category: e.category,
        product: e.product,
        platform: e.platform,
        relevanceScore: e.relevance_score,
        potentialReach: e.potential_reach,
        costEstimate: e.cost_estimate,
        roiScore: Math.round(e.roiScore * 100) / 100,
        status: e.status,
      }));

      // By category counts
      const byCategory = {};
      for (const entry of active) {
        const cat = entry.category || 'unknown';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
      }

      return {
        totalActive: active.length,
        topOpportunities,
        byCategory,
      };
    } catch (err) {
      logger.warn(`Intelligence briefing compilation failed: ${err.message}`);
      return { totalActive: 0, topOpportunities: [], byCategory: {} };
    }
  }

  async sendCriticalAlert(agentId, errorMessage) {
    logger.error(`CRITICAL: Agent ${agentId} failed after all retries`, {
      agentId,
      error: errorMessage,
    });
    // TODO: Push notification integration
  }

  async stop() {
    logger.info('Stopping BeaconOps Orchestrator');
    if (this.worker) await this.worker.close();
    if (this.taskQueue) await this.taskQueue.close();
    if (this.connection) await this.connection.quit();
    logger.info('Orchestrator stopped');
  }
}

module.exports = Orchestrator;
