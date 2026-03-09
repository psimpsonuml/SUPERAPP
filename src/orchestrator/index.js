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

      newsletter: await this.compileNewsletterStats(),

      intelligence: await this.compileIntelligenceBriefing(),

      videoProduction: await this.compileVideoProductionStats(),

      productIntelligence: await this.compileProductIntelligenceStats(),
    };

    // Store report
    await this.analytics.recordEngagement('daily-report', { report });

    // TODO: Send report via email and push to dashboard
    logger.info('Daily report compiled', {
      contentProduced: report.content.total,
      agentRuns: report.agentRuns.total,
      pendingApprovals: report.approvalQueue.pending,
      newsletterStatus: report.newsletter.status,
      intelligenceFindings: report.intelligence.totalActive,
      videosProduced: report.videoProduction.todayCount,
      newRecommendations: report.productIntelligence.newToday,
    });

    return report;
  }

  async compileNewsletterStats() {
    try {
      const { getSupabase, isSupabaseConfigured } = require('../db/supabase');
      if (!isSupabaseConfigured()) return { status: 'no_data', today: null };

      const supabase = getSupabase();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: todayEdition } = await supabase
        .from('newsletter_editions')
        .select('subject_line, word_count, status, theme_type, publish_method, open_rate, published_at')
        .eq('account_id', this.accountId)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      // Yesterday's open rate
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const { data: yesterdayEdition } = await supabase
        .from('newsletter_editions')
        .select('subject_line, open_rate, subscriber_count')
        .eq('account_id', this.accountId)
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', todayStart.toISOString())
        .limit(1);

      const today = todayEdition?.[0] || null;
      const yesterday = yesterdayEdition?.[0] || null;

      return {
        status: today ? today.status : 'not_generated',
        today: today ? {
          subjectLine: today.subject_line,
          wordCount: today.word_count,
          themeType: today.theme_type,
          publishMethod: today.publish_method,
        } : null,
        yesterdayOpenRate: yesterday?.open_rate || null,
        yesterdaySubject: yesterday?.subject_line || null,
      };
    } catch (err) {
      logger.warn(`Newsletter stats compilation failed: ${err.message}`);
      return { status: 'error', today: null };
    }
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

  async compileVideoProductionStats() {
    try {
      const { getSupabase, isSupabaseConfigured } = require('../db/supabase');
      if (!isSupabaseConfigured()) return { todayCount: 0, byProduct: {}, byFormat: {} };

      const supabase = getSupabase();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: videos } = await supabase
        .from('video_assets')
        .select('product, format, status, duration_sec, file_size_bytes')
        .eq('account_id', this.accountId)
        .gte('created_at', todayStart.toISOString());

      if (!videos || videos.length === 0) {
        return { todayCount: 0, byProduct: {}, byFormat: { short: 0, long: 0 } };
      }

      const byProduct = {};
      const byFormat = { short: 0, long: 0 };
      let totalDuration = 0;

      for (const v of videos) {
        if (!byProduct[v.product]) byProduct[v.product] = { count: 0, pending: 0, approved: 0 };
        byProduct[v.product].count++;
        if (v.status === 'pending_approval') byProduct[v.product].pending++;
        if (v.status === 'approved' || v.status === 'published') byProduct[v.product].approved++;

        byFormat[v.format] = (byFormat[v.format] || 0) + 1;
        totalDuration += v.duration_sec || 0;
      }

      return {
        todayCount: videos.length,
        totalDurationSec: totalDuration,
        byProduct,
        byFormat,
      };
    } catch (err) {
      logger.warn(`Video production stats compilation failed: ${err.message}`);
      return { todayCount: 0, byProduct: {}, byFormat: {} };
    }
  }

  async compileProductIntelligenceStats() {
    try {
      const { getSupabase, isSupabaseConfigured } = require('../db/supabase');
      if (!isSupabaseConfigured()) return { newToday: 0, byProduct: {}, topRecommendations: [], snoozedExpiringThisWeek: 0, pricingAlerts: 0 };

      const supabase = getSupabase();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Today's new recommendations
      const { data: todayRecs } = await supabase
        .from('product_intelligence')
        .select('product, rec_type, title, impact_estimate')
        .eq('account_id', this.accountId)
        .eq('status', 'new')
        .gte('created_at', todayStart.toISOString());

      const newRecs = todayRecs || [];

      // By product
      const byProduct = {};
      for (const r of newRecs) {
        byProduct[r.product] = (byProduct[r.product] || 0) + 1;
      }

      // Top 3 highest-impact
      const impactOrder = { high: 3, medium: 2, low: 1 };
      const topRecommendations = [...newRecs]
        .sort((a, b) => (impactOrder[b.impact_estimate] || 0) - (impactOrder[a.impact_estimate] || 0))
        .slice(0, 3)
        .map(r => ({ product: r.product, title: r.title, impact: r.impact_estimate }));

      // Snoozed items expiring this week
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      const { data: expiring } = await supabase
        .from('product_intelligence')
        .select('id')
        .eq('account_id', this.accountId)
        .eq('status', 'snoozed')
        .lte('snoozed_until', weekFromNow.toISOString())
        .gte('snoozed_until', new Date().toISOString());

      // Pricing alerts
      const pricingAlerts = newRecs.filter(r => r.rec_type === 'pricing').length;

      return {
        newToday: newRecs.length,
        byProduct,
        topRecommendations,
        snoozedExpiringThisWeek: expiring?.length || 0,
        pricingAlerts,
      };
    } catch (err) {
      logger.warn(`Product intelligence stats compilation failed: ${err.message}`);
      return { newToday: 0, byProduct: {}, topRecommendations: [], snoozedExpiringThisWeek: 0, pricingAlerts: 0 };
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
