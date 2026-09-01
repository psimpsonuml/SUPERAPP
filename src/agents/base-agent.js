const { getSupabase } = require('../db/supabase');
const BrandVoiceService = require('../shared/brand-voice');
const ContentMemoryService = require('../shared/content-memory');
const ApprovalQueueService = require('../shared/approval-queue');
const logger = require('../shared/logger');

class BaseAgent {
  constructor(accountId, options = {}) {
    this.accountId = accountId;
    this.agentId = options.agentId || this.constructor.agentId || 'unknown-agent';
    this.agentName = options.agentName || this.constructor.agentName || 'Unknown Agent';
    this.cycle = options.cycle || 'daily';
    this.defaultTier = options.defaultTier || 2;

    // Shared services
    this.brandVoice = new BrandVoiceService(accountId);
    this.contentMemory = new ContentMemoryService(accountId);
    this.approvalQueue = new ApprovalQueueService(accountId);
    this.supabase = getSupabase();
    this.logger = logger;

    this.runId = null;
    this.itemsProduced = 0;
    this.errors = [];
  }

  async execute() {
    const startTime = Date.now();
    this.runId = await this.startRun();

    try {
      // Check reduced ops mode
      const reducedOps = await this.approvalQueue.isReducedOps();
      if (reducedOps && !this.isEssentialAgent()) {
        this.logger.info(`Skipping ${this.agentId} — reduced ops mode active`, {
          agentId: this.agentId,
        });
        await this.completeRun('skipped', startTime);
        return { status: 'skipped', reason: 'reduced_ops' };
      }

      this.logger.info(`Starting ${this.agentName}`, { agentId: this.agentId });
      const result = await this.run();
      await this.completeRun('completed', startTime);

      this.logger.info(`Completed ${this.agentName}`, {
        agentId: this.agentId,
        itemsProduced: this.itemsProduced,
        durationMs: Date.now() - startTime,
      });

      return { status: 'completed', ...result };
    } catch (error) {
      this.errors.push({ message: error.message, stack: error.stack });
      this.logger.error(`Failed ${this.agentName}: ${error.message}`, {
        agentId: this.agentId,
        error: error.stack,
      });
      await this.completeRun('failed', startTime);
      throw error;
    }
  }

  // Override in subclasses
  async run() {
    throw new Error(`${this.agentId}: run() must be implemented`);
  }

  // Agents that run even in reduced ops mode
  isEssentialAgent() {
    const essentialAgents = ['inbox-monitor', 'user-lifecycle', 'infrastructure-monitor', 'publish-dispatcher'];
    return essentialAgents.includes(this.agentId);
  }

  async startRun() {
    const { data } = await this.supabase
      .from('agent_runs')
      .insert({
        account_id: this.accountId,
        agent_id: this.agentId,
        status: 'running',
        inputs_summary: `Scheduled ${this.cycle} run`,
      })
      .select('id')
      .single();

    return data?.id;
  }

  async completeRun(status, startTime) {
    if (!this.runId) return;

    await this.supabase
      .from('agent_runs')
      .update({
        status,
        run_finished_at: new Date().toISOString(),
        items_produced: this.itemsProduced,
        outputs_summary: `${status}: ${this.itemsProduced} items produced`,
        errors: this.errors,
        duration_ms: Date.now() - startTime,
      })
      .eq('id', this.runId);
  }

  async submitForApproval(item) {
    const result = await this.approvalQueue.submit({
      agentId: this.agentId,
      tier: item.tier || this.defaultTier,
      itemType: item.itemType,
      contentPreview: item.contentPreview,
      fullContent: item.fullContent,
    });

    this.itemsProduced++;
    return result;
  }

  async storeContent(content) {
    return this.contentMemory.store({
      ...content,
      product: content.product,
    });
  }

  async checkDuplicate(text, product) {
    return this.contentMemory.checkDuplicate(text, product);
  }

  async alert(severity, service, message, details = {}) {
    await this.supabase.from('infra_alerts').insert({
      account_id: this.accountId,
      alert_type: `${this.agentId}_alert`,
      severity,
      service,
      message,
      details,
    });
  }
}

module.exports = BaseAgent;
