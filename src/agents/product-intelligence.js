const BaseAgent = require('./base-agent');
const products = require('../config/products');

class ProductIntelligenceAgent extends BaseAgent {
  static agentId = 'product-intelligence';
  static agentName = 'Product Intelligence Agent';

  constructor(accountId) {
    super(accountId, {
      agentId: 'product-intelligence',
      agentName: 'Product Intelligence Agent',
      cycle: 'daily',
      defaultTier: 2,
    });
    this.snoozeDays = 30;
  }

  async run() {
    const results = { recommendations: 0, byProduct: {}, snoozedResurfaced: 0 };

    // Resurface snoozed items past their snooze period
    const resurfaced = await this.resurfaceSnoozed();
    results.snoozedResurfaced = resurfaced;

    for (const productId of Object.keys(products)) {
      results.byProduct[productId] = 0;

      // Aggregate signals from multiple sources
      const signals = await this.aggregateSignals(productId);
      const recommendations = await this.generateRecommendations(productId, signals);

      for (const rec of recommendations) {
        // Check if similar recommendation already exists and is snoozed
        const existing = await this.findExistingRecommendation(productId, rec.title);
        if (existing?.snoozed_until && new Date(existing.snoozed_until) > new Date()) {
          continue;
        }

        await this.supabase.from('product_intelligence').insert({
          account_id: this.accountId,
          product: productId,
          rec_type: rec.type,
          title: rec.title,
          rationale: rec.rationale,
          estimated_effort: rec.effort,
          expected_impact: rec.impact,
          source_signals: rec.sourceSignals,
          status: 'new',
        });

        results.recommendations++;
        results.byProduct[productId]++;
      }
    }

    return results;
  }

  async aggregateSignals(productId) {
    const [painPoints, communityChatter, supportPatterns] = await Promise.all([
      this.supabase
        .from('pain_points')
        .select('text, category, urgency')
        .eq('account_id', this.accountId)
        .eq('product_relevance', productId)
        .order('date_found', { ascending: false })
        .limit(20),
      this.supabase
        .from('community_profiles')
        .select('name, platform')
        .eq('account_id', this.accountId)
        .contains('products_relevant', [productId]),
      this.supabase
        .from('approval_queue')
        .select('full_content')
        .eq('account_id', this.accountId)
        .eq('agent_id', 'inbox-monitor')
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    ]);

    return {
      painPoints: painPoints.data || [],
      communityChatter: communityChatter.data || [],
      supportPatterns: supportPatterns.data || [],
    };
  }

  async generateRecommendations(productId, signals) {
    // TODO: LLM integration for recommendation generation
    return [];
  }

  async findExistingRecommendation(productId, title) {
    const { data } = await this.supabase
      .from('product_intelligence')
      .select('id, snoozed_until')
      .eq('account_id', this.accountId)
      .eq('product', productId)
      .eq('title', title)
      .limit(1);

    return data?.[0] || null;
  }

  async resurfaceSnoozed() {
    const { data, error } = await this.supabase
      .from('product_intelligence')
      .update({ status: 'new', snoozed_until: null })
      .eq('account_id', this.accountId)
      .eq('status', 'stays')
      .lt('snoozed_until', new Date().toISOString())
      .select('id');

    return data?.length || 0;
  }

  async snoozeRecommendation(recId) {
    const snoozeUntil = new Date();
    snoozeUntil.setDate(snoozeUntil.getDate() + this.snoozeDays);

    await this.supabase
      .from('product_intelligence')
      .update({ status: 'stays', snoozed_until: snoozeUntil.toISOString() })
      .eq('id', recId)
      .eq('account_id', this.accountId);
  }
}

module.exports = ProductIntelligenceAgent;
