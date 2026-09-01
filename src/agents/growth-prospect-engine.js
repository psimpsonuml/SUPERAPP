const BaseAgent = require('./base-agent');
const ProspectImportService = require('../shared/growth/import');
const GrowthProspectsService = require('../shared/growth/prospects');
const { isConfigured, providerName } = require('../shared/growth/providers');

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
}

module.exports = GrowthProspectEngineAgent;
