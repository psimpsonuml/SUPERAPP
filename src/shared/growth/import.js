// ══════════════════════════════════════════════════════════════════
// Prospect Import (spec §6, §18)
//
// provider -> dedup -> fit score -> suppression check
//
// Two deliberate behaviours:
//
//   Search results usually arrive WITHOUT an email — Apollo withholds
//   it until a credit is spent. Those prospects are stored with
//   email_status='unavailable' and are visible in the queue, but the
//   outreach path refuses to send to them. Enrichment is an explicit,
//   separately-budgeted step.
//
//   Anything already suppressed is imported and immediately marked
//   do_not_contact, rather than dropped. Dropping it would let the same
//   person be re-imported and re-contacted on the next run.
// ══════════════════════════════════════════════════════════════════

const GrowthProspectsService = require('./prospects');
const GrowthSettingsService = require('./settings');
const GrowthCostService = require('./cost');
const SuppressionService = require('../suppression');
const { getProvider, ProviderUnavailableError } = require('./providers');
const logger = require('../logger');

class ProspectImportService {
  constructor(accountId, { provider = null } = {}) {
    this.accountId = accountId;
    this.prospects = new GrowthProspectsService(accountId);
    this.settings = new GrowthSettingsService(accountId);
    this.cost = new GrowthCostService(accountId);
    this.suppression = new SuppressionService(accountId);
    this._provider = provider;
  }

  provider() {
    if (this._provider) return this._provider;
    const p = getProvider();
    if (!p) {
      throw new ProviderUnavailableError(
        'No prospect provider configured. Set APOLLO_API_KEY, or '
        + 'PROSPECT_PROVIDER=mock for development.'
      );
    }
    this._provider = p;
    return p;
  }

  /** Build provider filters from the saved ICP. */
  async filtersFromIcp(overrides = {}) {
    const icp = await this.settings.get('icp');
    return {
      titles: overrides.titles || icp.primary_titles,
      employeeMin: overrides.employeeMin ?? icp.employee_min,
      employeeMax: overrides.employeeMax ?? icp.employee_max,
      locations: overrides.locations || icp.geography,
      industries: overrides.industries || undefined,
      page: overrides.page || 1,
      perPage: overrides.perPage || 25,
    };
  }

  /**
   * Import one page of search results.
   * @returns {Promise<Object>} counts plus a per-prospect outcome list
   */
  async importPage(overrides = {}) {
    const provider = this.provider();
    const filters = await this.filtersFromIcp(overrides);

    const results = {
      provider: provider.name,
      page: filters.page,
      returned: 0,
      created: 0,
      enriched: 0,
      scored: 0,
      withEmail: 0,
      withoutEmail: 0,
      suppressed: 0,
      failed: 0,
      byBand: {},
      errors: [],
    };

    const { prospects, pagination } = await provider.searchPeople(filters);
    results.returned = prospects.length;
    results.pagination = pagination;

    // Apollo bills per search page
    if (provider.name === 'apollo') {
      await this.cost.record({
        service: 'apollo', operation: 'search_people',
        unitKey: 'apollo-credit', units: 1,
        metadata: { page: filters.page, returned: prospects.length },
      });
    }

    for (const candidate of prospects) {
      try {
        const outcome = await this.importOne(candidate);

        if (outcome.created) results.created++; else results.enriched++;
        if (outcome.scored) results.scored++;
        if (outcome.hasEmail) results.withEmail++; else results.withoutEmail++;
        if (outcome.suppressed) results.suppressed++;

        const band = outcome.prospect.fit_band;
        results.byBand[band] = (results.byBand[band] || 0) + 1;
      } catch (err) {
        results.failed++;
        results.errors.push({
          prospect: candidate.fullName || candidate.sourceId || 'unknown',
          error: err.message,
        });
      }
    }

    return results;
  }

  /** Import one candidate: upsert, score, and apply suppression. */
  async importOne(candidate) {
    const { prospect, created } = await this.prospects.upsert(candidate);

    const scored = await this.prospects.scoreAndSave(prospect.id);

    // Someone already on the suppression list is kept and flagged, not
    // dropped — dropping would let them be re-imported next run.
    let suppressed = false;
    if (scored.email) {
      const check = await this.suppression.check(scored.email);
      if (check.suppressed) {
        suppressed = true;
        await this.prospects.setStatus(scored.id, 'do_not_contact', {
          event: 'disqualified',
          metadata: { reason: 'suppressed_on_import', suppressionReason: check.reason },
        });
      }
    }

    return {
      prospect: scored,
      created,
      scored: true,
      hasEmail: !!scored.email,
      suppressed,
    };
  }

  /**
   * Reveal contact details for prospects that lack an email.
   * Costs a credit per prospect, so it is capped and explicit.
   */
  async enrichMissingEmails({ limit = 10 } = {}) {
    const provider = this.provider();

    const results = {
      provider: provider.name,
      attempted: 0,
      revealed: 0,
      stillUnavailable: 0,
      failed: 0,
      errors: [],
    };

    const candidates = await this.prospects.list({
      band: ['priority', 'good'],
      limit: limit * 2,
    });

    const needsEmail = candidates
      .filter(p => !p.email && p.status !== 'do_not_contact')
      .slice(0, limit);

    for (const prospect of needsEmail) {
      results.attempted++;
      try {
        const enriched = await provider.enrichPerson({
          id: prospect.source_id,
          linkedinUrl: prospect.linkedin_url,
          firstName: prospect.first_name,
          lastName: prospect.last_name,
          companyDomain: prospect.company_domain,
          revealEmail: true,
        });

        if (provider.name === 'apollo') {
          await this.cost.record({
            service: 'apollo', operation: 'enrich_person',
            unitKey: 'apollo-credit', units: 1,
            prospectId: prospect.id,
          });
        }

        if (!enriched?.email) {
          results.stillUnavailable++;
          await this.prospects.logEvent(prospect.id, 'enriched', { emailRevealed: false });
          continue;
        }

        // Suppression applies to newly revealed addresses too
        const check = await this.suppression.check(enriched.email);
        if (check.suppressed) {
          await this.prospects.setStatus(prospect.id, 'do_not_contact', {
            event: 'disqualified',
            metadata: { reason: 'suppressed_after_enrichment' },
          });
          results.stillUnavailable++;
          continue;
        }

        await this.prospects.upsert({
          ...enriched,
          sourceId: prospect.source_id || enriched.sourceId,
        });

        await this.prospects.logEvent(prospect.id, 'enriched', { emailRevealed: true });
        results.revealed++;
      } catch (err) {
        results.failed++;
        results.errors.push({ prospectId: prospect.id, error: err.message });
        logger.warn(`Enrichment failed for ${prospect.id}: ${err.message}`, {
          accountId: this.accountId,
        });
      }
    }

    return results;
  }
}

module.exports = ProspectImportService;
