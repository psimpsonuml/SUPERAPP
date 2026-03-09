const { getSupabase, isSupabaseConfigured } = require('../db/supabase');
const config = require('../config');
const logger = require('./logger');

class ApprovalQueueService {
  constructor(accountId) {
    this.accountId = accountId;
  }

  async getSliderPosition() {
    if (!isSupabaseConfigured()) return config.approvalSlider.default;
    const supabase = getSupabase();
    const { data } = await supabase
      .from('accounts')
      .select('slider_position')
      .eq('id', this.accountId)
      .single();

    return data?.slider_position ?? config.approvalSlider.default;
  }

  async isReducedOps() {
    if (!isSupabaseConfigured()) return false;
    const supabase = getSupabase();
    const { data } = await supabase
      .from('accounts')
      .select('reduced_ops')
      .eq('id', this.accountId)
      .single();

    return data?.reduced_ops ?? false;
  }

  shouldAutoApprove(tier, sliderPosition) {
    // Tier 1: Auto-approve at slider >= 26
    // Tier 2: Auto-approve at slider >= 51
    // Tier 3: Auto-approve at slider >= 76
    const thresholds = { 1: 26, 2: 51, 3: 76 };
    return sliderPosition >= (thresholds[tier] || 100);
  }

  async submit(item) {
    if (!isSupabaseConfigured()) throw new Error('Database not configured');
    const supabase = getSupabase();
    const sliderPosition = await this.getSliderPosition();
    const autoApprove = this.shouldAutoApprove(item.tier || 2, sliderPosition);

    const record = {
      account_id: this.accountId,
      agent_id: item.agentId,
      item_type: item.itemType,
      content_preview: item.contentPreview,
      full_content: item.fullContent || {},
      tier: item.tier || 2,
      status: autoApprove ? 'auto_approved' : 'pending',
      auto_approve_eligible: autoApprove,
    };

    const { data, error } = await supabase
      .from('approval_queue')
      .insert(record)
      .select('id, status')
      .single();

    if (error) throw new Error(`Failed to submit to approval queue: ${error.message}`);

    if (autoApprove) {
      logger.info(`Auto-approved item from ${item.agentId}: ${item.itemType}`, {
        accountId: this.accountId,
        queueItemId: data.id,
      });
    }

    return { id: data.id, status: data.status, autoApproved: autoApprove };
  }

  async approve(itemId, reviewerNotes) {
    if (!isSupabaseConfigured()) throw new Error('Database not configured');
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('approval_queue')
      .update({
        status: 'approved',
        reviewer_notes: reviewerNotes || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('account_id', this.accountId)
      .select()
      .single();

    if (error) throw new Error(`Failed to approve item: ${error.message}`);
    return data;
  }

  async reject(itemId, reviewerNotes) {
    if (!isSupabaseConfigured()) throw new Error('Database not configured');
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('approval_queue')
      .update({
        status: 'rejected',
        reviewer_notes: reviewerNotes || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('account_id', this.accountId)
      .select()
      .single();

    if (error) throw new Error(`Failed to reject item: ${error.message}`);
    return data;
  }

  async getPending(filters = {}) {
    if (!isSupabaseConfigured()) return [];
    const supabase = getSupabase();
    let query = supabase
      .from('approval_queue')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (filters.agentId) query = query.eq('agent_id', filters.agentId);
    if (filters.tier) query = query.eq('tier', filters.tier);
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get pending items: ${error.message}`);
    return data || [];
  }

  async getOverdue(escalationWindowMinutes = 120) {
    if (!isSupabaseConfigured()) return [];
    const supabase = getSupabase();
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - escalationWindowMinutes);

    const { data } = await supabase
      .from('approval_queue')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('status', 'pending')
      .lt('created_at', cutoff.toISOString());

    return data || [];
  }

  async getStats() {
    if (!isSupabaseConfigured()) {
      return { pending: 0, approvedToday: 0, autoApprovedToday: 0, sliderPosition: config.approvalSlider.default };
    }
    const supabase = getSupabase();
    const today = new Date().toISOString().slice(0, 10);

    const { data: pending } = await supabase
      .from('approval_queue')
      .select('id', { count: 'exact' })
      .eq('account_id', this.accountId)
      .eq('status', 'pending');

    const { data: todayApproved } = await supabase
      .from('approval_queue')
      .select('id', { count: 'exact' })
      .eq('account_id', this.accountId)
      .in('status', ['approved', 'auto_approved'])
      .gte('reviewed_at', today);

    const { data: todayAutoApproved } = await supabase
      .from('approval_queue')
      .select('id', { count: 'exact' })
      .eq('account_id', this.accountId)
      .eq('status', 'auto_approved')
      .gte('created_at', today);

    return {
      pending: pending?.length || 0,
      approvedToday: todayApproved?.length || 0,
      autoApprovedToday: todayAutoApproved?.length || 0,
      sliderPosition: await this.getSliderPosition(),
    };
  }
}

module.exports = ApprovalQueueService;
