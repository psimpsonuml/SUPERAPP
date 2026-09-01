// ══════════════════════════════════════════════════════════════════
// Growth Analytics (spec §15, §16)
//
// Two disciplines run through this file:
//
//   Ratios return null, never 0, when the denominator is zero. A
//   0% reply rate and "no emails sent yet" are different facts and
//   must not render identically.
//
//   Verdicts are withheld below the §16 sample size. At 20 contacted
//   prospects one reply is a 5% reply rate, which is noise, not a
//   signal. The thresholds are internal heuristics for THIS campaign —
//   they are not industry benchmarks and are labelled as such.
// ══════════════════════════════════════════════════════════════════

const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');
const GrowthCostService = require('./cost');
const logger = require('../logger');

// Spec §16 — review after every 200 contacted prospects.
const REVIEW_COHORT_SIZE = 200;

// Below this, a reply rate is arithmetic rather than evidence.
const MIN_SAMPLE_FOR_VERDICT = 50;

const REPLY_RATE_BANDS = [
  { max: 0.02, verdict: 'likely_targeting_or_message_problem', label: 'Likely targeting/message problem' },
  { max: 0.05, verdict: 'potentially_viable', label: 'Potentially viable. Continue testing.' },
  { max: Infinity, verdict: 'strong_enough_to_scale', label: 'Strong enough to investigate scaling' },
];

/**
 * Divide, or return null when there is nothing to divide by.
 * Never returns 0 for an empty denominator.
 */
function ratio(numerator, denominator, { asPercent = true, decimals = 1 } = {}) {
  if (!denominator || denominator <= 0) return null;
  const value = numerator / denominator;
  return asPercent ? +(value * 100).toFixed(decimals) : +value.toFixed(decimals + 2);
}

class GrowthAnalyticsService {
  constructor(accountId) {
    this.accountId = accountId;
    this.cost = new GrowthCostService(accountId);
  }

  get db() {
    if (!isSupabaseConfigured()) throw new Error('Database not configured');
    return getSupabase();
  }

  since(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }

  // ── Content funnel (spec §15) ───────────────────────────

  async contentFunnel({ days = 30 } = {}) {
    const since = this.since(days);

    const { data: content } = await this.db
      .from('growth_content')
      .select('id, status, platform, published_at, created_at')
      .eq('account_id', this.accountId)
      .gte('created_at', since);

    const rows = content || [];
    const generated = rows.length;
    const approved = rows.filter(r => ['approved', 'scheduled', 'published'].includes(r.status)).length;
    const published = rows.filter(r => r.status === 'published').length;
    const rejected = rows.filter(r => r.status === 'rejected').length;
    const failed = rows.filter(r => r.status === 'failed').length;

    // Attribution supplies everything downstream of publish
    const { data: attribution } = await this.db
      .from('growth_attribution_events')
      .select('event_type, utm_source, content_id')
      .eq('account_id', this.accountId)
      .gte('created_at', since);

    const attrRows = attribution || [];
    const countType = t => attrRows.filter(a => a.event_type === t).length;

    const clicks = countType('click');
    const visits = countType('visit');
    const registrations = countType('registration') + countType('signup');
    const conversions = countType('conversion');

    return {
      period_days: days,
      generated,
      approved,
      published,
      rejected,
      failed,
      // We do not have platform impression APIs wired, so this is
      // explicitly unavailable rather than reported as zero.
      impressions: null,
      impressions_note: 'Platform impression APIs are not connected',
      clicks,
      visits,
      registrations,
      conversions,
      by_platform: this.countBy(rows, 'platform'),
      rates: {
        approval_rate: ratio(approved, generated),
        publish_rate: ratio(published, approved),
        rejection_rate: ratio(rejected, generated),
        click_to_registration: ratio(registrations, clicks),
      },
    };
  }

  // ── Outbound funnel (spec §15) ──────────────────────────

  async outboundFunnel({ days = 30 } = {}) {
    const since = this.since(days);

    const { data: prospects } = await this.db
      .from('growth_prospects')
      .select('id, status, fit_band, payroll_fit_score, email, last_contacted_at, created_at')
      .eq('account_id', this.accountId);

    const all = prospects || [];
    const found = all.filter(p => p.created_at >= since).length;

    // "Qualified" = anything above the ignore band
    const qualified = all.filter(p => ['priority', 'good', 'maybe'].includes(p.fit_band)).length;
    const priority = all.filter(p => p.fit_band === 'priority').length;

    const contacted = all.filter(p => p.last_contacted_at).length;
    const replied = all.filter(p => ['replied', 'positive', 'negative', 'meeting', 'registered', 'converted'].includes(p.status)).length;
    const positive = all.filter(p => ['positive', 'meeting', 'registered', 'converted'].includes(p.status)).length;
    const negative = all.filter(p => p.status === 'negative').length;
    const meetings = all.filter(p => ['meeting', 'registered', 'converted'].includes(p.status)).length;
    const registrations = all.filter(p => ['registered', 'converted'].includes(p.status)).length;
    const customers = all.filter(p => p.status === 'converted').length;

    // Emails actually sent, from the outreach log
    const { data: sends } = await this.db
      .from('growth_outreach')
      .select('id, channel, status, sent_at')
      .eq('account_id', this.accountId)
      .eq('channel', 'email')
      .eq('status', 'sent');

    const emailsSent = (sends || []).length;

    // Contactability — the number that explains a stalled funnel
    const priorityNoEmail = all.filter(p => p.fit_band === 'priority' && !p.email).length;

    return {
      period_days: days,
      prospects_found: found,
      prospects_total: all.length,
      qualified,
      priority,
      priority_without_email: priorityNoEmail,
      emails_sent: emailsSent,
      contacted,
      replies: replied,
      positive_replies: positive,
      negative_replies: negative,
      meetings,
      registrations,
      customers,
      by_status: this.countBy(all, 'status'),
      by_band: this.countBy(all, 'fit_band'),
    };
  }

  // ── The six ratios (spec §15) ───────────────────────────

  async ratios({ days = 30 } = {}) {
    const [outbound, costs] = await Promise.all([
      this.outboundFunnel({ days }),
      this.cost.summary({ days }),
    ]);

    // We record sends, not deliveries — there is no bounce webhook yet,
    // so these are rates over SENT and are labelled that way.
    const denominator = outbound.emails_sent;

    return {
      period_days: days,
      qualification_rate: ratio(outbound.qualified, outbound.prospects_total),
      reply_rate: ratio(outbound.replies, denominator),
      positive_reply_rate: ratio(outbound.positive_replies, denominator),
      registration_rate: ratio(outbound.registrations, denominator),
      lead_to_customer_rate: ratio(outbound.customers, outbound.contacted),
      cost_per_registration: outbound.registrations > 0
        ? +(costs.total / outbound.registrations).toFixed(2) : null,
      cac: outbound.customers > 0
        ? +(costs.total / outbound.customers).toFixed(2) : null,
      denominators: {
        emails_sent: denominator,
        prospects_total: outbound.prospects_total,
        contacted: outbound.contacted,
        growth_cost: costs.total,
      },
      basis_note: 'Reply/registration rates are over emails SENT. Delivery '
        + 'confirmation requires a bounce webhook, which is not wired.',
    };
  }

  // ── Cohort diagnostics (spec §16) ───────────────────────

  /**
   * The §16 read on the current campaign.
   * Withholds a verdict below MIN_SAMPLE_FOR_VERDICT — at small n a
   * reply rate is arithmetic, not evidence.
   */
  async cohortDiagnostic({ days = 90 } = {}) {
    const outbound = await this.outboundFunnel({ days });
    const contacted = outbound.contacted;
    const replyRate = ratio(outbound.replies, outbound.emails_sent, { asPercent: false });

    const cohortsComplete = Math.floor(contacted / REVIEW_COHORT_SIZE);
    const untilNextReview = REVIEW_COHORT_SIZE - (contacted % REVIEW_COHORT_SIZE);

    const base = {
      contacted,
      emails_sent: outbound.emails_sent,
      replies: outbound.replies,
      reply_rate_pct: ratio(outbound.replies, outbound.emails_sent),
      cohort_size: REVIEW_COHORT_SIZE,
      cohorts_complete: cohortsComplete,
      until_next_review: untilNextReview,
      // Spec §16 is explicit about this framing.
      disclaimer: 'These are internal heuristics for this campaign, not industry benchmarks.',
    };

    if (outbound.emails_sent === 0) {
      return {
        ...base,
        verdict: null,
        verdict_label: 'No emails sent yet',
        sample_sufficient: false,
        guidance: 'Nothing to evaluate. Send outreach first.',
      };
    }

    if (contacted < MIN_SAMPLE_FOR_VERDICT) {
      return {
        ...base,
        verdict: null,
        verdict_label: 'Sample too small to judge',
        sample_sufficient: false,
        guidance: `At ${contacted} contacted, a single reply moves the rate by `
          + `${(100 / Math.max(contacted, 1)).toFixed(1)} points. Wait for at least `
          + `${MIN_SAMPLE_FOR_VERDICT} before drawing any conclusion.`,
      };
    }

    const band = REPLY_RATE_BANDS.find(b => replyRate < b.max) || REPLY_RATE_BANDS[REPLY_RATE_BANDS.length - 1];

    return {
      ...base,
      verdict: band.verdict,
      verdict_label: band.label,
      sample_sufficient: true,
      guidance: contacted < REVIEW_COHORT_SIZE
        ? `Below the ${REVIEW_COHORT_SIZE}-prospect review point — treat this as provisional.`
        : `${cohortsComplete} full cohort(s) of ${REVIEW_COHORT_SIZE} contacted.`,
    };
  }

  // ── What is working (spec §20, Worker 6) ────────────────

  /** Which content topics actually produced clicks and registrations. */
  async topPerformingContent({ days = 90, limit = 10 } = {}) {
    const since = this.since(days);

    const { data: attribution } = await this.db
      .from('growth_attribution_events')
      .select('content_id, event_type, utm_content')
      .eq('account_id', this.accountId)
      .gte('created_at', since)
      .not('content_id', 'is', null);

    const byContent = {};
    for (const row of attribution || []) {
      const id = row.content_id;
      byContent[id] = byContent[id] || { content_id: id, clicks: 0, registrations: 0, conversions: 0 };
      if (row.event_type === 'click') byContent[id].clicks++;
      if (['registration', 'signup'].includes(row.event_type)) byContent[id].registrations++;
      if (row.event_type === 'conversion') byContent[id].conversions++;
    }

    const ids = Object.keys(byContent);
    if (ids.length === 0) return [];

    const { data: content } = await this.db
      .from('growth_content')
      .select('id, title, platform, source_id')
      .eq('account_id', this.accountId)
      .in('id', ids);

    const meta = Object.fromEntries((content || []).map(c => [c.id, c]));

    return Object.values(byContent)
      .map(row => ({ ...row, ...(meta[row.content_id] || {}) }))
      .sort((a, b) => (b.registrations - a.registrations) || (b.clicks - a.clicks))
      .slice(0, limit);
  }

  /** Which ICP slices actually reply. */
  async segmentPerformance({ minSample = 5 } = {}) {
    const { data: prospects } = await this.db
      .from('growth_prospects')
      .select('industry, company_size, fit_band, status, last_contacted_at')
      .eq('account_id', this.accountId)
      .not('last_contacted_at', 'is', null);

    const contacted = prospects || [];
    const positiveStatuses = ['positive', 'meeting', 'registered', 'converted'];

    const buckets = {};
    const add = (dimension, key, prospect) => {
      const id = `${dimension}::${key}`;
      buckets[id] = buckets[id] || { dimension, segment: key, contacted: 0, positive: 0 };
      buckets[id].contacted++;
      if (positiveStatuses.includes(prospect.status)) buckets[id].positive++;
    };

    for (const p of contacted) {
      if (p.industry) add('industry', p.industry, p);
      if (p.fit_band) add('fit_band', p.fit_band, p);
      const size = p.company_size;
      if (size) {
        const bucket = size < 500 ? '200-499'
          : size < 1000 ? '500-999'
          : size < 2500 ? '1000-2499'
          : size < 5000 ? '2500-4999' : '5000+';
        add('company_size', bucket, p);
      }
    }

    // Segments below minSample are returned but flagged — a 100% rate
    // on 2 prospects is not a finding.
    return Object.values(buckets)
      .map(b => ({
        ...b,
        positive_rate: ratio(b.positive, b.contacted),
        sufficient_sample: b.contacted >= minSample,
      }))
      .sort((a, b) => b.contacted - a.contacted);
  }

  /** Which Payroll Beacon resource correlates with replies. */
  async assetPerformance() {
    const { data: outreach } = await this.db
      .from('growth_outreach')
      .select('recommended_asset, prospect_id, status')
      .eq('account_id', this.accountId)
      .eq('status', 'sent');

    const sent = outreach || [];
    if (sent.length === 0) return [];

    const ids = [...new Set(sent.map(o => o.prospect_id))];
    const { data: prospects } = await this.db
      .from('growth_prospects')
      .select('id, status')
      .eq('account_id', this.accountId)
      .in('id', ids);

    const statusById = Object.fromEntries((prospects || []).map(p => [p.id, p.status]));
    const positiveStatuses = ['positive', 'meeting', 'registered', 'converted'];

    const byAsset = {};
    for (const row of sent) {
      const key = row.recommended_asset || 'none';
      byAsset[key] = byAsset[key] || { asset: key, sent: 0, positive: 0 };
      byAsset[key].sent++;
      if (positiveStatuses.includes(statusById[row.prospect_id])) byAsset[key].positive++;
    }

    return Object.values(byAsset)
      .map(a => ({ ...a, positive_rate: ratio(a.positive, a.sent), sufficient_sample: a.sent >= 5 }))
      .sort((a, b) => b.sent - a.sent);
  }

  // ── Full report ─────────────────────────────────────────

  async fullReport({ days = 30 } = {}) {
    const settled = await Promise.allSettled([
      this.contentFunnel({ days }),
      this.outboundFunnel({ days }),
      this.ratios({ days }),
      this.cohortDiagnostic({ days: 90 }),
      this.cost.summary({ days }),
      this.topPerformingContent({ days: 90 }),
      this.segmentPerformance(),
      this.assetPerformance(),
    ]);

    const val = (i, fallback) => settled[i].status === 'fulfilled' ? settled[i].value : fallback;
    const failures = settled
      .map((s, i) => s.status === 'rejected' ? { section: i, error: s.reason?.message } : null)
      .filter(Boolean);

    return {
      period_days: days,
      generated_at: new Date().toISOString(),
      content: val(0, null),
      outbound: val(1, null),
      ratios: val(2, null),
      diagnostic: val(3, null),
      cost: val(4, null),
      top_content: val(5, []),
      segments: val(6, []),
      assets: val(7, []),
      degraded: failures.length > 0 ? failures : undefined,
    };
  }

  countBy(rows, field) {
    const out = {};
    for (const row of rows) {
      const key = row[field];
      if (key) out[key] = (out[key] || 0) + 1;
    }
    return out;
  }
}

module.exports = GrowthAnalyticsService;
module.exports.ratio = ratio;
module.exports.REVIEW_COHORT_SIZE = REVIEW_COHORT_SIZE;
module.exports.MIN_SAMPLE_FOR_VERDICT = MIN_SAMPLE_FOR_VERDICT;
module.exports.REPLY_RATE_BANDS = REPLY_RATE_BANDS;
