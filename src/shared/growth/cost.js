// ══════════════════════════════════════════════════════════════════
// Growth Cost Tracking (spec §17)
//
// Records estimated spend per generated item so the dashboard can show
// net cost against the $285/month avoided content-creator cost.
//
// Prices are per million tokens, USD, and WILL drift — they are a
// local estimate for budgeting, not billing truth.
// ══════════════════════════════════════════════════════════════════

const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');
const logger = require('../logger');

const MODEL_PRICING = {
  'claude-opus-4-6': { in: 15.00, out: 75.00 },
  'claude-sonnet-4-6': { in: 3.00, out: 15.00 },
  'claude-sonnet-4-5-20250514': { in: 3.00, out: 15.00 },
  'claude-haiku-4-5-20251001': { in: 1.00, out: 5.00 },
  'gpt-4o': { in: 2.50, out: 10.00 },
};

// Flat per-unit costs (USD)
const UNIT_PRICING = {
  'dalle-3-1024': 0.040,
  'dalle-3-1792': 0.080,
  'elevenlabs-char': 0.00003,
  'apollo-credit': 0.020,
  'resend-email': 0.0004,
  'brave-search': 0.005,
  'serper-search': 0.001,
};

function estimateLlmCost(model, tokensIn = 0, tokensOut = 0) {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return ((tokensIn / 1_000_000) * pricing.in) + ((tokensOut / 1_000_000) * pricing.out);
}

function estimateUnitCost(unitKey, units = 1) {
  const price = UNIT_PRICING[unitKey];
  if (!price) return 0;
  return price * units;
}

class GrowthCostService {
  constructor(accountId) {
    this.accountId = accountId;
  }

  /**
   * Record a cost event. Never throws — cost accounting must not break
   * the operation it is measuring.
   */
  async record({
    service, model, operation, tokensIn, tokensOut, units, unitKey,
    estimatedCost, contentId, prospectId, campaignId, metadata,
  }) {
    if (!isSupabaseConfigured()) return null;

    let cost = estimatedCost;
    if (cost === undefined || cost === null) {
      cost = model ? estimateLlmCost(model, tokensIn, tokensOut)
        : unitKey ? estimateUnitCost(unitKey, units)
        : 0;
    }

    try {
      const { data } = await getSupabase()
        .from('growth_cost_events')
        .insert({
          account_id: this.accountId,
          service,
          model: model || null,
          operation: operation || null,
          content_id: contentId || null,
          prospect_id: prospectId || null,
          campaign_id: campaignId || null,
          tokens_in: tokensIn ?? null,
          tokens_out: tokensOut ?? null,
          units: units ?? null,
          estimated_cost: Number(cost.toFixed(6)),
          metadata: metadata || {},
        })
        .select('id')
        .single();
      return data?.id || null;
    } catch (err) {
      logger.warn(`Failed to record cost event: ${err.message}`, { accountId: this.accountId });
      return null;
    }
  }

  /** Convenience wrapper: record an Anthropic call from its usage block. */
  async recordLlm({ model, usage, operation, contentId, prospectId }) {
    return this.record({
      service: 'anthropic',
      model,
      operation,
      tokensIn: usage?.input_tokens ?? 0,
      tokensOut: usage?.output_tokens ?? 0,
      contentId,
      prospectId,
    });
  }

  async summary({ days = 30 } = {}) {
    if (!isSupabaseConfigured()) {
      return { total: 0, byService: {}, byDay: {}, periodDays: days };
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data } = await getSupabase()
      .from('growth_cost_events')
      .select('service, model, estimated_cost, created_at')
      .eq('account_id', this.accountId)
      .gte('created_at', since.toISOString());

    const rows = data || [];
    const byService = {};
    const byDay = {};
    let total = 0;

    for (const row of rows) {
      const cost = Number(row.estimated_cost) || 0;
      total += cost;
      byService[row.service] = +( (byService[row.service] || 0) + cost ).toFixed(6);
      const day = row.created_at.slice(0, 10);
      byDay[day] = +((byDay[day] || 0) + cost).toFixed(6);
    }

    return {
      total: +total.toFixed(4),
      byService,
      byDay,
      eventCount: rows.length,
      periodDays: days,
    };
  }

  /** Today / week / month rollup for the dashboard cost card. */
  async periods() {
    const [today, week, month] = await Promise.all([
      this.summary({ days: 1 }),
      this.summary({ days: 7 }),
      this.summary({ days: 30 }),
    ]);
    return {
      today: today.total,
      week: week.total,
      month: month.total,
      byServiceMonth: month.byService,
    };
  }

  /** Cost per converted customer, for CAC. */
  async costPerConversion({ days = 30 } = {}) {
    if (!isSupabaseConfigured()) return { cost: 0, conversions: 0, cac: null };

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { total } = await this.summary({ days });

    const { data: converted } = await getSupabase()
      .from('growth_prospects')
      .select('id')
      .eq('account_id', this.accountId)
      .eq('status', 'converted')
      .gte('updated_at', since.toISOString());

    const conversions = (converted || []).length;
    return {
      cost: total,
      conversions,
      cac: conversions > 0 ? +(total / conversions).toFixed(2) : null,
    };
  }
}

module.exports = GrowthCostService;
module.exports.MODEL_PRICING = MODEL_PRICING;
module.exports.UNIT_PRICING = UNIT_PRICING;
module.exports.estimateLlmCost = estimateLlmCost;
module.exports.estimateUnitCost = estimateUnitCost;
