const BaseAgent = require('./base-agent');
const GrowthAnalyticsService = require('../shared/growth/analytics');
const { MIN_SAMPLE_FOR_VERDICT, REVIEW_COHORT_SIZE } = require('../shared/growth/analytics');

// ══════════════════════════════════════════════════════════════════
// Worker 6 — Growth Analyst (spec §20)
//
// Aggregates results and recommends experiments. It changes NOTHING —
// spec §20: "Do not automatically change campaigns." Every finding is
// a suggestion for the operator.
//
// Recommendations are only emitted when the sample supports them. A
// segment with 3 contacts and a 100% reply rate is not a finding, and
// this agent will not present it as one.
// ══════════════════════════════════════════════════════════════════

class GrowthAnalystAgent extends BaseAgent {
  static agentId = 'growth-analyst';
  static agentName = 'Growth Analyst';

  constructor(accountId) {
    super(accountId, {
      agentId: 'growth-analyst',
      agentName: 'Growth Analyst',
      cycle: 'weekly',
      defaultTier: 3,
    });

    this.analytics = new GrowthAnalyticsService(accountId);
  }

  async run(options = {}) {
    const days = options.days || 30;
    const report = await this.analytics.fullReport({ days });

    const recommendations = this.buildRecommendations(report);

    // Tier 3 — a briefing for the operator to read, never auto-applied.
    if (recommendations.length > 0) {
      await this.submitForApproval({
        itemType: 'growth_briefing',
        tier: 3,
        contentPreview: `${recommendations.length} growth observation(s) — ${report.diagnostic?.verdict_label || 'no verdict yet'}`,
        fullContent: { report, recommendations },
      });
    }

    this.itemsProduced = recommendations.length;

    return {
      period_days: days,
      recommendations,
      diagnostic: report.diagnostic,
      ratios: report.ratios,
      degraded: report.degraded,
    };
  }

  /**
   * Turn the report into observations worth acting on.
   * Every item states its evidence, so the operator can judge it.
   */
  buildRecommendations(report) {
    const out = [];
    const { outbound, content, ratios, diagnostic, segments, assets } = report;

    // ── Blockers first: things stopping the funnel entirely ──

    if (outbound?.priority_without_email > 0) {
      out.push({
        type: 'blocker',
        title: `${outbound.priority_without_email} priority prospects have no email address`,
        detail: 'These cannot be contacted by email regardless of fit score. '
          + 'Run enrichment to reveal addresses, or reach them on LinkedIn.',
        evidence: { priority_without_email: outbound.priority_without_email, priority_total: outbound.priority },
      });
    }

    if (outbound?.priority > 0 && outbound?.emails_sent === 0) {
      out.push({
        type: 'blocker',
        title: 'Priority prospects exist but no email has been sent',
        detail: 'Outreach is queued or blocked. Check the outreach queue and the dispatch log.',
        evidence: { priority: outbound.priority, emails_sent: 0 },
      });
    }

    if (content?.approved > 0 && content?.published === 0) {
      out.push({
        type: 'blocker',
        title: 'Approved content is not reaching publication',
        detail: 'Content is approved but nothing has published. Manual-posting platforms '
          + 'need you to post and mark them; automated ones need the dispatcher.',
        evidence: { approved: content.approved, published: 0 },
      });
    }

    if (content?.failed > 0) {
      out.push({
        type: 'attention',
        title: `${content.failed} content item(s) failed`,
        detail: 'Failed generation or publication. Review the failure reasons.',
        evidence: { failed: content.failed },
      });
    }

    // ── Campaign read — only when the sample supports it ──

    if (diagnostic?.sample_sufficient) {
      out.push({
        type: 'diagnostic',
        title: diagnostic.verdict_label,
        detail: `${diagnostic.reply_rate_pct}% reply rate across ${diagnostic.emails_sent} emails. `
          + diagnostic.disclaimer,
        evidence: {
          reply_rate_pct: diagnostic.reply_rate_pct,
          contacted: diagnostic.contacted,
          verdict: diagnostic.verdict,
        },
      });
    } else if (diagnostic && diagnostic.contacted > 0) {
      out.push({
        type: 'info',
        title: 'Not enough data to judge the campaign yet',
        detail: diagnostic.guidance,
        evidence: { contacted: diagnostic.contacted, needed: MIN_SAMPLE_FOR_VERDICT },
      });
    }

    // ── Segment findings, sample-gated ──

    const strongSegments = (segments || [])
      .filter(s => s.sufficient_sample && s.positive_rate !== null)
      .sort((a, b) => b.positive_rate - a.positive_rate);

    if (strongSegments.length >= 2) {
      const best = strongSegments[0];
      const worst = strongSegments[strongSegments.length - 1];
      if (best.positive_rate > worst.positive_rate * 2 && best.positive_rate > 0) {
        out.push({
          type: 'experiment',
          title: `${best.dimension} "${best.segment}" outperforms "${worst.segment}"`,
          detail: `${best.positive_rate}% positive on ${best.contacted} contacted, versus `
            + `${worst.positive_rate}% on ${worst.contacted}. Consider weighting the ICP toward ${best.segment}.`,
          evidence: { best, worst },
        });
      }
    }

    const thinSegments = (segments || []).filter(s => !s.sufficient_sample).length;
    if (thinSegments > 0 && strongSegments.length === 0) {
      out.push({
        type: 'info',
        title: 'Segment data is too thin to compare',
        detail: `${thinSegments} segment(s) have fewer than 5 contacted prospects. `
          + 'Rates at that size are noise.',
        evidence: { thin_segments: thinSegments },
      });
    }

    // ── Asset findings ──

    const gradedAssets = (assets || []).filter(a => a.sufficient_sample && a.positive_rate !== null);
    if (gradedAssets.length >= 2) {
      const sorted = [...gradedAssets].sort((a, b) => b.positive_rate - a.positive_rate);
      out.push({
        type: 'experiment',
        title: `"${sorted[0].asset}" is the strongest opening resource so far`,
        detail: `${sorted[0].positive_rate}% positive on ${sorted[0].sent} sends. `
          + `Weakest is "${sorted[sorted.length - 1].asset}" at ${sorted[sorted.length - 1].positive_rate}%.`,
        evidence: { ranked: sorted.slice(0, 5) },
      });
    }

    // ── Unit economics ──

    if (ratios?.cac !== null && ratios?.cac !== undefined) {
      out.push({
        type: 'metric',
        title: `CAC is $${ratios.cac}`,
        detail: `${ratios.denominators.growth_cost.toFixed(2)} spent for `
          + `${outbound.customers} customer(s). Cost is an estimate from token counts, not billing.`,
        evidence: { cac: ratios.cac, cost: ratios.denominators.growth_cost },
      });
    }

    return out;
  }
}

module.exports = GrowthAnalystAgent;
