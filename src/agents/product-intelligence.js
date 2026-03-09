const BaseAgent = require('./base-agent');
const products = require('../config/products');
const config = require('../config');

// ── Pricing comparisons per product ───────────────────────
const PRICING_BENCHMARKS = {
  chronostates: {
    category: 'AI gaming/narrative platforms',
    competitors: ['AI Dungeon', 'NovelAI', 'Character.ai', 'Ludo.ai'],
    priceRange: '$0-30/mo',
    freeTrialNorm: '7-14 days',
  },
  payroll_beacon: {
    category: 'Payroll compliance SaaS',
    competitors: ['Gusto', 'ADP Run', 'Paychex Flex', 'Rippling', 'Paylocity', 'OnPay', 'JustWorks'],
    priceRange: '$40-150/mo base + per employee',
    freeTrialNorm: '30 days',
  },
  budgeting_beacon: {
    category: 'Personal finance/budgeting',
    competitors: ['YNAB', 'Monarch Money', 'Copilot', 'EveryDollar', 'Goodbudget', 'PocketGuard'],
    priceRange: '$0-15/mo',
    freeTrialNorm: '14-34 days',
  },
};

// ── Web search queries per product for review mining ──────
const REVIEW_QUERIES = {
  chronostates: [
    'alternate history game reviews 2025 2026',
    'AI narrative platform user complaints',
    'AI storytelling game missing features',
  ],
  payroll_beacon: [
    'payroll software reviews G2 Capterra 2025 2026',
    'small business payroll complaints reddit',
    'multi-state payroll software missing features',
  ],
  budgeting_beacon: [
    'budgeting app reviews 2025 2026 YNAB Monarch',
    'personal finance app complaints reddit',
    'budgeting app features users want',
  ],
};

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
    const results = { recommendations: 0, byProduct: {}, snoozedResurfaced: 0, pricingAlerts: [] };

    // Step 1: Resurface snoozed items past their snooze period
    const resurfaced = await this.resurfaceSnoozed();
    results.snoozedResurfaced = resurfaced;

    // Step 2: For each product, aggregate signals and generate recommendations
    for (const productId of Object.keys(products)) {
      results.byProduct[productId] = { new: 0, types: {} };

      const signals = await this.aggregateSignals(productId);
      const recommendations = await this.generateRecommendations(productId, signals);

      for (const rec of recommendations) {
        // Dedup: skip if similar recommendation exists and is snoozed
        const existing = await this.findExistingRecommendation(productId, rec.title);
        if (existing) {
          if (existing.snoozed_until && new Date(existing.snoozed_until) > new Date()) continue;
          if (existing.status === 'rejected') continue;
          // Update existing if it's still 'new' or resurfaced
          if (existing.status === 'new') {
            await this.supabase
              .from('product_intelligence')
              .update({
                rationale: rec.rationale,
                source_signals: rec.sourceSignals,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id)
              .eq('account_id', this.accountId);
            continue;
          }
        }

        await this.supabase.from('product_intelligence').insert({
          account_id: this.accountId,
          product: productId,
          rec_type: rec.type,
          title: rec.title,
          description: rec.description,
          rationale: rec.rationale,
          effort_estimate: rec.effort,
          impact_estimate: rec.impact,
          source_signals: rec.sourceSignals,
          status: 'new',
        });

        results.recommendations++;
        results.byProduct[productId].new++;
        results.byProduct[productId].types[rec.type] = (results.byProduct[productId].types[rec.type] || 0) + 1;

        // Track pricing alerts
        if (rec.type === 'pricing') {
          results.pricingAlerts.push({ product: productId, title: rec.title });
        }
      }
    }

    this.itemsProduced = results.recommendations;
    return results;
  }

  // ── Signal Aggregation ──────────────────────────────────────
  async aggregateSignals(productId) {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    // 1. Pain Point Hunter signals
    const { data: painPoints } = await this.supabase
      .from('pain_points')
      .select('signal_text, category, source, score, date_found')
      .eq('account_id', this.accountId)
      .or(`product.eq.${productId},product_relevance.eq.${productId}`)
      .gte('date_found', monthAgo)
      .order('score', { ascending: false })
      .limit(20);

    // 2. Community discussions (Community Scout)
    const { data: communityPosts } = await this.supabase
      .from('community_posts')
      .select('title, body, platform, community_name, engagement_score, posted_at')
      .eq('account_id', this.accountId)
      .gte('posted_at', weekAgo)
      .order('engagement_score', { ascending: false })
      .limit(15);

    // 3. Builder community intel
    const { data: builderIntel } = await this.supabase
      .from('engagement_log')
      .select('event_data')
      .eq('account_id', this.accountId)
      .eq('event_type', 'builder_community_intel')
      .gte('created_at', weekAgo)
      .limit(10);

    // 4. Inbox Monitor patterns (support emails)
    const { data: supportEmails } = await this.supabase
      .from('approval_queue')
      .select('content_preview, full_content, created_at')
      .eq('account_id', this.accountId)
      .eq('agent_id', 'inbox-monitor')
      .gte('created_at', weekAgo)
      .limit(20);

    // 5. Intelligence Analyst (competitor data — Payroll Beacon only)
    let competitorIntel = [];
    if (products[productId].competitorTracking) {
      const { data } = await this.supabase
        .from('intelligence_log')
        .select('name, category, notes, relevance_score, platform, url')
        .eq('account_id', this.accountId)
        .eq('category', 'competitor')
        .gte('date_found', weekAgo)
        .order('relevance_score', { ascending: false })
        .limit(15);
      competitorIntel = data || [];
    }

    // 6. User Lifecycle data (churn signals, feature adoption)
    const { data: lifecycleData } = await this.supabase
      .from('engagement_log')
      .select('event_type, event_data')
      .eq('account_id', this.accountId)
      .in('event_type', ['user_churned', 'user_downgraded', 'feature_adoption', 'onboarding_drop'])
      .gte('created_at', monthAgo)
      .limit(30);

    return {
      painPoints: painPoints || [],
      communityPosts: communityPosts || [],
      builderIntel: (builderIntel || []).map(e => e.event_data),
      supportEmails: (supportEmails || []).map(e => ({
        preview: e.content_preview,
        content: typeof e.full_content === 'string' ? e.full_content : JSON.stringify(e.full_content),
      })),
      competitorIntel,
      lifecycleData: (lifecycleData || []).map(e => ({ type: e.event_type, data: e.event_data })),
      benchmark: PRICING_BENCHMARKS[productId],
    };
  }

  // ── Recommendation Generation via Claude ────────────────────
  async generateRecommendations(productId, signals) {
    const product = products[productId];
    const signalSummary = this.buildSignalSummary(productId, signals);

    if (!signalSummary.trim()) {
      return [];
    }

    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        system: `You are a product strategist analyzing market signals for ${product.name} (${product.description}). Generate actionable, specific product recommendations. Be concise and data-driven.`,
        messages: [{
          role: 'user',
          content: `Analyze these signals for ${product.name} and generate product recommendations.

${signalSummary}

PRICING BENCHMARK:
Category: ${signals.benchmark.category}
Competitors: ${signals.benchmark.competitors.join(', ')}
Market price range: ${signals.benchmark.priceRange}
Free trial norm: ${signals.benchmark.freeTrialNorm}

Generate recommendations across 5 categories. Return JSON array:
[
  {
    "type": "add|change|remove|pricing|ux",
    "title": "short descriptive title (under 80 chars)",
    "description": "what specifically to do (1-2 sentences)",
    "rationale": "why, citing specific signals (2-3 sentences)",
    "effort": "small|medium|large",
    "impact": "low|medium|high",
    "sourceSignals": ["signal source 1", "signal source 2"]
  }
]

Requirements:
- 3-8 recommendations total
- At least 1 pricing recommendation
- At least 1 UX recommendation
- Each must cite specific signals from the data
- Be specific, not generic — "add dark mode" not "improve UI"
- effort: small=<1 week, medium=1-4 weeks, large=1+ months
- impact: based on expected effect on retention or acquisition`,
        }],
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.filter(r => r.type && r.title).map(r => ({
          type: r.type,
          title: r.title.slice(0, 200),
          description: r.description || '',
          rationale: r.rationale || '',
          effort: ['small', 'medium', 'large'].includes(r.effort) ? r.effort : 'medium',
          impact: ['low', 'medium', 'high'].includes(r.impact) ? r.impact : 'medium',
          sourceSignals: Array.isArray(r.sourceSignals) ? r.sourceSignals : [],
        }));
      }
    } catch (error) {
      this.logger.warn(`Claude recommendation generation failed for ${productId}: ${error.message}`, {
        agentId: this.agentId,
      });
    }

    // Fallback: generate basic recommendations from pain points
    return this.generateFallbackRecommendations(productId, signals);
  }

  buildSignalSummary(productId, signals) {
    const parts = [];

    if (signals.painPoints.length > 0) {
      parts.push('PAIN POINTS (user complaints/requests):');
      for (const pp of signals.painPoints.slice(0, 10)) {
        parts.push(`- [score: ${pp.score}] ${pp.signal_text} (source: ${pp.source})`);
      }
    }

    if (signals.communityPosts.length > 0) {
      parts.push('\nCOMMUNITY DISCUSSIONS:');
      for (const cp of signals.communityPosts.slice(0, 8)) {
        parts.push(`- [${cp.platform}/${cp.community_name}] ${cp.title} (engagement: ${cp.engagement_score})`);
      }
    }

    if (signals.builderIntel.length > 0) {
      parts.push('\nBUILDER COMMUNITY INTEL:');
      for (const bi of signals.builderIntel.slice(0, 5)) {
        const summary = typeof bi === 'object' ? JSON.stringify(bi).slice(0, 200) : String(bi).slice(0, 200);
        parts.push(`- ${summary}`);
      }
    }

    if (signals.supportEmails.length > 0) {
      parts.push('\nSUPPORT EMAIL PATTERNS:');
      for (const se of signals.supportEmails.slice(0, 8)) {
        parts.push(`- ${se.preview}`);
      }
    }

    if (signals.competitorIntel.length > 0) {
      parts.push('\nCOMPETITOR INTELLIGENCE:');
      for (const ci of signals.competitorIntel.slice(0, 8)) {
        parts.push(`- ${ci.name}: ${ci.notes || 'No details'} (relevance: ${ci.relevance_score}/10)`);
      }
    }

    if (signals.lifecycleData.length > 0) {
      parts.push('\nUSER LIFECYCLE SIGNALS:');
      const typeCounts = {};
      for (const ld of signals.lifecycleData) {
        typeCounts[ld.type] = (typeCounts[ld.type] || 0) + 1;
      }
      for (const [type, count] of Object.entries(typeCounts)) {
        parts.push(`- ${type}: ${count} events in last 30 days`);
      }
    }

    return parts.join('\n');
  }

  generateFallbackRecommendations(productId, signals) {
    const recs = [];

    // Generate from top pain points
    for (const pp of signals.painPoints.slice(0, 2)) {
      recs.push({
        type: 'add',
        title: `Address: ${pp.signal_text.slice(0, 70)}`,
        description: `Users are requesting this based on ${pp.source} signals.`,
        rationale: `Pain point score ${pp.score}. Found on ${pp.date_found}.`,
        effort: 'medium',
        impact: pp.score > 7 ? 'high' : 'medium',
        sourceSignals: [`Pain Point Hunter: ${pp.signal_text.slice(0, 100)}`],
      });
    }

    // Pricing recommendation
    const benchmark = signals.benchmark;
    recs.push({
      type: 'pricing',
      title: `Review pricing against ${benchmark.category} market`,
      description: `Compare current pricing to ${benchmark.competitors.slice(0, 3).join(', ')} (range: ${benchmark.priceRange}).`,
      rationale: `Market norm: ${benchmark.priceRange}, free trial norm: ${benchmark.freeTrialNorm}. Review if aligned.`,
      effort: 'small',
      impact: 'medium',
      sourceSignals: [`Pricing benchmark: ${benchmark.category}`],
    });

    // UX recommendation from support patterns
    if (signals.supportEmails.length >= 3) {
      recs.push({
        type: 'ux',
        title: 'Improve self-service based on support email patterns',
        description: `${signals.supportEmails.length} support emails this week suggest documentation or UX gaps.`,
        rationale: 'Recurring support requests indicate areas where self-service could reduce support load.',
        effort: 'small',
        impact: 'medium',
        sourceSignals: signals.supportEmails.slice(0, 3).map(e => `Support: ${e.preview.slice(0, 80)}`),
      });
    }

    return recs;
  }

  // ── Dedup & Snooze Management ───────────────────────────────
  async findExistingRecommendation(productId, title) {
    // Check for exact title match or very similar
    const { data } = await this.supabase
      .from('product_intelligence')
      .select('id, status, snoozed_until')
      .eq('account_id', this.accountId)
      .eq('product', productId)
      .eq('title', title)
      .limit(1);

    return data?.[0] || null;
  }

  async resurfaceSnoozed() {
    const { data } = await this.supabase
      .from('product_intelligence')
      .update({ status: 'new', snoozed_until: null, updated_at: new Date().toISOString() })
      .eq('account_id', this.accountId)
      .eq('status', 'snoozed')
      .lt('snoozed_until', new Date().toISOString())
      .select('id');

    return data?.length || 0;
  }
}

module.exports = ProductIntelligenceAgent;
