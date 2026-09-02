// ══════════════════════════════════════════════════════════════════
// Prospect Research (spec §8)
//
// A COMPACT card, not a report. The spec is explicit: "Do NOT create
// huge AI reports." Six short fields, each of which changes what the
// operator would say in an email.
//
// Research also closes the scoring gap left by Apollo. Apollo supplies
// company size, industry and locations, but nothing about remote policy,
// payroll hiring, or LinkedIn activity — 20 of the 100 fit points.
// Those signals are only set here when the research finds EVIDENCE for
// them, and the evidence is stored alongside. A prospect stays at its
// Apollo-derived score rather than being inflated by a guess.
// ══════════════════════════════════════════════════════════════════

const llm = require('../llm');
const { searchOrEmpty, isSearchConfigured } = require('../search');
const logger = require('../logger');

// The resources a cold email can lead with. The research picks the one
// that best matches the prospect's actual complexity.
const PAYROLL_BEACON_ASSETS = {
  local_wage_database: {
    label: 'State & local minimum wage database',
    bestFor: 'multi-state employers, especially with staff in CA/WA/NY/IL local-ordinance cities',
  },
  local_tax_database: {
    label: 'Local tax jurisdiction database',
    bestFor: 'employers in OH/PA/KY/IN, or anyone with local income tax exposure',
  },
  multi_state_guide: {
    label: 'Multi-state payroll compliance guide',
    bestFor: 'companies newly expanding across state lines',
  },
  upcoming_wage_changes: {
    label: 'Upcoming wage change calendar',
    bestFor: 'teams that plan compensation cycles ahead',
  },
  payroll_calendar: {
    label: 'Payroll deadline calendar',
    bestFor: 'lean teams juggling many filing deadlines',
  },
  jurisdiction_guide: {
    label: 'Jurisdiction-by-jurisdiction requirements guide',
    bestFor: 'distributed or remote-heavy workforces',
  },
};

const ASSET_KEYS = Object.keys(PAYROLL_BEACON_ASSETS);

class ProspectResearchService {
  constructor(accountId, { costService = null } = {}) {
    this.accountId = accountId;
    this.costService = costService;
  }

  /**
   * Build a research card for one prospect.
   * @returns {Promise<{card, signals, evidence, searched}>}
   */
  async research(prospect) {
    if (!llm.isConfigured()) {
      throw new Error('ANTHROPIC_API_KEY not configured — cannot generate research cards');
    }

    // Gather what public evidence we can before asking the model
    const evidence = await this.gatherEvidence(prospect);

    const { data, usage, model } = await llm.completeJson({
      prompt: this.buildPrompt(prospect, evidence),
      system: 'You research B2B prospects for a payroll compliance product. '
        + 'You are concise and you never invent facts about a company.',
      model: llm.MODELS.fast,
      maxTokens: 1200,
    });

    if (this.costService) {
      await this.costService.recordLlm({
        model, usage, operation: 'research:prospect', prospectId: prospect.id,
      });
    }

    const card = this.normalizeCard(data, prospect);
    const signals = this.extractSignals(data, evidence);

    return {
      card,
      signals,
      evidence: evidence.map(e => ({ title: e.title, url: e.url })),
      searched: evidence.length > 0,
    };
  }

  /**
   * Public signals about the company. Returns [] when no search
   * provider is configured — the card is then built from Apollo data
   * alone and no evidence-based signal is claimed.
   */
  async gatherEvidence(prospect) {
    if (!isSearchConfigured()) return [];
    const company = prospect.company_name;
    if (!company) return [];

    const queries = [
      `"${company}" payroll OR "human resources" job opening`,
      `"${company}" remote OR hybrid work policy`,
      `"${company}" PEO OR "professional employer organization"`,
    ];

    const evidence = [];
    for (const query of queries) {
      const hits = await searchOrEmpty(query, { limit: 3 }, logger);
      evidence.push(...hits.map(h => ({ ...h, query })));
      await new Promise(r => setTimeout(r, 500));
    }

    return evidence.slice(0, 9);
  }

  buildPrompt(prospect, evidence) {
    const parts = [];

    parts.push('Produce a COMPACT research card for this prospect. Short and decision-useful — not a report.');
    parts.push('');
    parts.push('── PROSPECT ──');
    parts.push(`Name: ${prospect.full_name}`);
    parts.push(`Title: ${prospect.title || 'unknown'}`);
    parts.push(`Company: ${prospect.company_name || 'unknown'}`);
    if (prospect.company_size) parts.push(`Employees: ${prospect.company_size}`);
    if (prospect.industry) parts.push(`Industry: ${prospect.industry}`);
    if (prospect.city || prospect.state) parts.push(`Located: ${[prospect.city, prospect.state].filter(Boolean).join(', ')}`);

    const meta = prospect.metadata || {};
    if (meta.state_count) parts.push(`Known office locations: ${meta.state_count} states`);
    if (meta.headcount_growth_pct) parts.push(`Headcount growth (6mo): ${meta.headcount_growth_pct}%`);

    parts.push(`Fit score: ${prospect.payroll_fit_score}/100 (${prospect.fit_band})`);
    if (prospect.fit_reason) parts.push(`Scored because: ${prospect.fit_reason}`);

    if (evidence.length > 0) {
      parts.push('');
      parts.push('── PUBLIC EVIDENCE ──');
      for (const e of evidence) {
        parts.push(`- ${e.title}\n  ${(e.snippet || '').slice(0, 180)}\n  ${e.url}`);
      }
    } else {
      parts.push('');
      parts.push('── PUBLIC EVIDENCE ──');
      parts.push('None available. Base the card only on the fields above and say so where relevant.');
    }

    parts.push('');
    parts.push('── RULES ──');
    parts.push('Do not invent facts about this company. If the evidence does not support a claim, leave the field null.');
    parts.push('Signals must be set to true ONLY when the evidence above supports them — otherwise null, never false-as-a-guess.');
    parts.push('Keep every field short. why_they_fit is 2-4 bullets. conversation_angle is ONE sentence.');

    parts.push('');
    parts.push('── AVAILABLE PAYROLL BEACON RESOURCES ──');
    for (const [key, asset] of Object.entries(PAYROLL_BEACON_ASSETS)) {
      parts.push(`${key}: ${asset.label} — best for ${asset.bestFor}`);
    }

    parts.push('');
    parts.push('── OUTPUT ──');
    parts.push(`{
  "why_they_fit": ["2-4 short bullets"],
  "company_complexity": ["short phrases: multi-state workforce, large headcount, distributed staff, payroll hiring, international presence"],
  "recommended_asset": "one key from the list above",
  "asset_reason": "one short clause explaining the pick",
  "conversation_angle": "ONE sentence — the specific thing worth opening with",
  "risks": ["e.g. appears to use a PEO, so internal payroll ownership may be limited"],
  "signals": {
    "remote_friendly": true or null,
    "hiring_payroll": true or null,
    "linkedin_active": true or null,
    "uses_peo": true or null
  },
  "signal_evidence": {"remote_friendly": "url or quote", "hiring_payroll": "url or quote"}
}`);

    return parts.join('\n');
  }

  normalizeCard(data, prospect) {
    const asset = ASSET_KEYS.includes(data.recommended_asset)
      ? data.recommended_asset
      : this.fallbackAsset(prospect);

    return {
      prospect: {
        name: prospect.full_name,
        title: prospect.title,
        company: prospect.company_name,
        employees: prospect.company_size,
      },
      why_they_fit: (data.why_they_fit || []).slice(0, 4),
      company_complexity: (data.company_complexity || []).slice(0, 5),
      recommended_asset: asset,
      recommended_asset_label: PAYROLL_BEACON_ASSETS[asset].label,
      asset_reason: data.asset_reason || null,
      conversation_angle: data.conversation_angle || null,
      risks: (data.risks || []).slice(0, 3),
      generated_at: new Date().toISOString(),
    };
  }

  /** Pick a sensible asset from structured data when the model doesn't. */
  fallbackAsset(prospect) {
    const meta = prospect.metadata || {};
    if (meta.multi_state || (meta.state_count || 0) > 1) return 'local_wage_database';
    if (meta.remote_friendly) return 'jurisdiction_guide';
    if ((prospect.company_size || 0) > 2000) return 'multi_state_guide';
    return 'payroll_calendar';
  }

  /**
   * Signals to merge back onto the prospect.
   * Only true values with supporting evidence are kept — a null or an
   * unsupported claim must not become a scoring point.
   */
  extractSignals(data, evidence) {
    const raw = data.signals || {};
    const support = data.signal_evidence || {};
    const hasEvidence = evidence.length > 0;

    const signals = {};
    for (const key of ['remote_friendly', 'hiring_payroll', 'linkedin_active']) {
      if (raw[key] !== true) continue;
      // A positive signal needs public evidence behind it.
      if (!hasEvidence || !support[key]) {
        logger.info(`Discarding unsupported signal "${key}" — no evidence cited`, {
          accountId: this.accountId,
        });
        continue;
      }
      signals[key] = true;
      signals[`${key}_evidence`] = String(support[key]).slice(0, 300);
    }

    // A PEO is a disqualifying-ish risk, not a scoring signal
    if (raw.uses_peo === true) {
      signals.uses_peo = true;
      if (support.uses_peo) signals.uses_peo_evidence = String(support.uses_peo).slice(0, 300);
    }

    return signals;
  }
}

module.exports = ProspectResearchService;
module.exports.PAYROLL_BEACON_ASSETS = PAYROLL_BEACON_ASSETS;
module.exports.ASSET_KEYS = ASSET_KEYS;
