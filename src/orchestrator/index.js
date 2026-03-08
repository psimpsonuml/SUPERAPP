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
    };

    // Store report
    await this.analytics.recordEngagement('daily-report', { report });

    // TODO: Send report via email and push to dashboard
    logger.info('Daily report compiled', {
      contentProduced: report.content.total,
      agentRuns: report.agentRuns.total,
      pendingApprovals: report.approvalQueue.pending,
    });

    return report;
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
