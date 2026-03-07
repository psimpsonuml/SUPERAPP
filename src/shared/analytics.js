const { getSupabase } = require('../db/supabase');

class AnalyticsPipeline {
  constructor(accountId) {
    this.accountId = accountId;
  }

  async recordEngagement(contentId, metrics) {
    const supabase = getSupabase();

    // Update engagement score on content
    const score = this.computeEngagementScore(metrics);

    await supabase
      .from('content_memory')
      .update({
        engagement_score: score,
        metadata: supabase.rpc ? metrics : metrics,
      })
      .eq('id', contentId)
      .eq('account_id', this.accountId);

    return score;
  }

  computeEngagementScore(metrics) {
    const weights = {
      likes: 1,
      shares: 3,
      comments: 2,
      clicks: 1.5,
      impressions: 0.01,
    };

    let score = 0;
    for (const [metric, value] of Object.entries(metrics)) {
      score += (value || 0) * (weights[metric] || 0.5);
    }
    return Math.round(score * 100) / 100;
  }

  async getContentPerformance(product, days = 30) {
    const supabase = getSupabase();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data } = await supabase
      .from('content_memory')
      .select('id, title, platform, content_type, engagement_score, published_at')
      .eq('account_id', this.accountId)
      .eq('product', product)
      .eq('status', 'published')
      .gte('published_at', since.toISOString())
      .order('engagement_score', { ascending: false });

    return data || [];
  }

  async getAccountHealth() {
    const supabase = getSupabase();
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);

    const { data: alerts } = await supabase
      .from('infra_alerts')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    const { data: recentRuns } = await supabase
      .from('agent_runs')
      .select('agent_id, status')
      .eq('account_id', this.accountId)
      .gte('created_at', last24h.toISOString());

    const agentHealth = {};
    for (const run of recentRuns || []) {
      if (!agentHealth[run.agent_id]) {
        agentHealth[run.agent_id] = { total: 0, failed: 0 };
      }
      agentHealth[run.agent_id].total++;
      if (run.status === 'failed') agentHealth[run.agent_id].failed++;
    }

    return {
      unresolvedAlerts: alerts || [],
      agentHealth,
      criticalAlerts: (alerts || []).filter(a => a.severity === 'critical').length,
    };
  }

  async getDailyReportData() {
    const supabase = getSupabase();
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const [contentProduced, queueStats, agentRuns, painPoints, qaResults, lifecycleStats] =
      await Promise.all([
        supabase
          .from('content_memory')
          .select('product, platform, content_type, status, title')
          .eq('account_id', this.accountId)
          .gte('created_at', today),
        supabase
          .from('approval_queue')
          .select('agent_id, status, tier')
          .eq('account_id', this.accountId)
          .gte('created_at', today),
        supabase
          .from('agent_runs')
          .select('agent_id, status, duration_ms, items_produced, errors')
          .eq('account_id', this.accountId)
          .gte('created_at', today),
        supabase
          .from('pain_points')
          .select('product_relevance, urgency, text, source')
          .eq('account_id', this.accountId)
          .gte('created_at', today),
        supabase
          .from('qa_results')
          .select('pass_fail, bugs, latency_stats')
          .eq('account_id', this.accountId)
          .eq('test_date', today),
        supabase
          .from('user_lifecycle')
          .select('product, drip_stage, churned')
          .eq('account_id', this.accountId)
          .gte('updated_at', today),
      ]);

    return {
      date: today,
      contentProduced: contentProduced.data || [],
      queueStats: queueStats.data || [],
      agentRuns: agentRuns.data || [],
      painPoints: painPoints.data || [],
      qaResults: qaResults.data || [],
      lifecycleStats: lifecycleStats.data || [],
    };
  }
}

module.exports = AnalyticsPipeline;
