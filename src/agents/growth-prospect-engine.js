const BaseAgent = require('./base-agent');
const ProspectImportService = require('../shared/growth/import');
const GrowthProspectsService = require('../shared/growth/prospects');
const { isConfigured, providerName } = require('../shared/growth/providers');
const ProspectResearchService = require('../shared/growth/research');
const GrowthCostService = require('../shared/growth/cost');
const llm = require('../shared/llm');

// ══════════════════════════════════════════════════════════════════
// Worker 4 — Prospect Engine (spec §20)
//
// Imports from the configured provider, deduplicates, enriches, scores,
// and classifies. It does not write outreach — that is Worker 5.
//
// With no provider configured it fails loudly rather than reporting a
// successful run that imported nothing.
// ══════════════════════════════════════════════════════════════════

const PAGES_PER_RUN = 2;
const ENRICH_PER_RUN = 10;
const RESEARCH_PER_RUN = 10;

class GrowthProspectEngineAgent extends BaseAgent {
  static agentId = 'growth-prospect-engine';
  static agentName = 'Growth Prospect Engine';

  constructor(accountId) {
    super(accountId, {
      agentId: 'growth-prospect-engine',
      agentName: 'Growth Prospect Engine',
      cycle: 'weekly',
      defaultTier: 2,
    });

    this.import = new ProspectImportService(accountId);
    this.prospects = new GrowthProspectsService(accountId);
    this.cost = new GrowthCostService(accountId);
    this.research = new ProspectResearchService(accountId, { costService: this.cost });
  }

  async run(options = {}) {
    if (!isConfigured()) {
      // A run that imported nothing because it had no provider is a
      // failure, not a quiet success.
      throw new Error(
        'No prospect provider configured. Set APOLLO_API_KEY, or '
        + 'PROSPECT_PROVIDER=mock for development.'
      );
    }

    const results = {
      provider: providerName(),
      pagesImported: 0,
      created: 0,
      enriched: 0,
      withEmail: 0,
      withoutEmail: 0,
      suppressed: 0,
      failed: 0,
      byBand: {},
      emailsRevealed: 0,
      errors: [],
    };

    const pages = options.pages || PAGES_PER_RUN;

    for (let page = 1; page <= pages; page++) {
      try {
        const pageResult = await this.import.importPage({ page, perPage: 25 });

        results.pagesImported++;
        results.created += pageResult.created;
        results.enriched += pageResult.enriched;
        results.withEmail += pageResult.withEmail;
        results.withoutEmail += pageResult.withoutEmail;
        results.suppressed += pageResult.suppressed;
        results.failed += pageResult.failed;
        results.errors.push(...pageResult.errors);

        for (const [band, count] of Object.entries(pageResult.byBand)) {
          results.byBand[band] = (results.byBand[band] || 0) + count;
        }

        // Stop early when the provider has no more pages
        if (pageResult.returned === 0) break;
      } catch (err) {
        this.logger.warn(`Import page ${page} failed: ${err.message}`, { agentId: this.agentId });
        results.errors.push({ page, error: err.message });
        this.errors.push({ message: `Page ${page}: ${err.message}` });
        break;
      }
    }

    // Reveal emails for the best-fit prospects that lack one
    if (options.enrich !== false) {
      try {
        const enrichment = await this.import.enrichMissingEmails({
          limit: options.enrichLimit || ENRICH_PER_RUN,
        });
        results.emailsRevealed = enrichment.revealed;
        results.enrichmentAttempted = enrichment.attempted;
        results.enrichmentFailed = enrichment.failed;
        results.errors.push(...enrichment.errors);
      } catch (err) {
        this.logger.warn(`Enrichment pass failed: ${err.message}`, { agentId: this.agentId });
        results.errors.push({ stage: 'enrichment', error: err.message });
      }
    }

    // Research the best-fit prospects. This is also the only place the
    // remote/hiring/activity signals can be earned — Apollo does not
    // supply them, so an unresearched prospect caps around 80/100.
    if (options.research !== false) {
      results.research = await this.researchPriorityProspects(
        options.researchLimit || RESEARCH_PER_RUN
      );
    }

    results.funnel = await this.prospects.funnelCounts();

    // Surface the contactability gap plainly — priority prospects with
    // no address cannot be emailed no matter how well they score.
    const priorityNoEmail = (await this.prospects.list({ band: 'priority', limit: 200 }))
      .filter(p => !p.email).length;
    if (priorityNoEmail > 0) {
      results.priorityWithoutEmail = priorityNoEmail;
      this.logger.info(
        `${priorityNoEmail} priority prospect(s) have no email address and cannot be contacted`,
        { agentId: this.agentId }
      );
    }

    this.itemsProduced = results.created;
    return results;
  }

  /**
   * Generate research cards for unresearched priority prospects.
   * Each card re-scores the prospect, since research can supply signals
   * Apollo cannot.
   */
  async researchPriorityProspects(limit) {
    const out = { attempted: 0, completed: 0, failed: 0, rescored: 0, errors: [] };

    if (!llm.isConfigured()) {
      out.skipped = 'ANTHROPIC_API_KEY not configured';
      this.logger.warn('Skipping prospect research — no LLM configured', { agentId: this.agentId });
      return out;
    }

    const candidates = await this.prospects.listNeedingResearch({ limit });

    for (const prospect of candidates) {
      out.attempted++;
      try {
        const before = prospect.payroll_fit_score;
        const result = await this.research.research(prospect);
        const updated = await this.prospects.saveResearch(prospect.id, result);

        out.completed++;
        if (updated.payroll_fit_score !== before) out.rescored++;
      } catch (err) {
        out.failed++;
        out.errors.push({ prospectId: prospect.id, error: err.message });
        this.logger.warn(`Research failed for ${prospect.id}: ${err.message}`, {
          agentId: this.agentId,
        });
      }
    }

    return out;
  }
}

module.exports = GrowthProspectEngineAgent;
