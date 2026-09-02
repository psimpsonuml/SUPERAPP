// ══════════════════════════════════════════════════════════════════
// Apollo prospect provider (spec §18)
//
// One thing to know before trusting the output: Apollo's *search*
// endpoint does not reveal email addresses. It returns the placeholder
// local-part "email_not_unlocked@..." for people whose email exists but
// has not been paid for. Storing that string would look like a real
// address and every send to it would bounce.
//
// So search results come back with email: null, emailStatus:
// 'unavailable'. Addresses only appear after enrichPerson(), which
// spends a credit. The import path makes that an explicit step.
// ══════════════════════════════════════════════════════════════════

const https = require('https');
const { ProspectProvider, ProviderUnavailableError, classifyEmail } = require('./base');
const logger = require('../../logger');

const API_HOST = 'api.apollo.io';
const API_BASE = '/api/v1';
const TIMEOUT_MS = 20000;

// Apollo expects employee counts as range strings.
const EMPLOYEE_RANGES = [
  [1, 10], [11, 20], [21, 50], [51, 100], [101, 200],
  [201, 500], [501, 1000], [1001, 2000], [2001, 5000],
  [5001, 10000], [10001, 1000000],
];

function rangesFor(min, max) {
  return EMPLOYEE_RANGES
    .filter(([lo, hi]) => hi >= (min ?? 0) && lo <= (max ?? Infinity))
    .map(([lo, hi]) => `${lo},${hi}`);
}

class ApolloProspectProvider extends ProspectProvider {
  constructor({ apiKey } = {}) {
    super();
    this.apiKey = apiKey || process.env.APOLLO_API_KEY || null;
  }

  get name() { return 'apollo'; }

  isConfigured() { return !!this.apiKey; }

  requireKey() {
    if (!this.apiKey) {
      throw new ProviderUnavailableError(
        'APOLLO_API_KEY is not configured. Set it, or use the mock provider '
        + 'by setting PROSPECT_PROVIDER=mock for development.'
      );
    }
  }

  // ── Search ──────────────────────────────────────────────

  async searchPeople(filters = {}) {
    this.requireKey();

    const body = {
      page: filters.page || 1,
      per_page: Math.min(filters.perPage || 25, 100),
    };

    if (filters.titles?.length) body.person_titles = filters.titles;
    if (filters.locations?.length) body.person_locations = filters.locations;
    if (filters.seniorities?.length) body.person_seniorities = filters.seniorities;
    if (filters.industries?.length) body.organization_industry_tag_ids = filters.industries;
    if (filters.domains?.length) body.q_organization_domains = filters.domains.join('\n');

    const ranges = rangesFor(filters.employeeMin, filters.employeeMax);
    if (ranges.length) body.organization_num_employees_ranges = ranges;

    const data = await this.post('/mixed_people/search', body);

    return {
      prospects: (data.people || []).map(p => this.normalize(p)),
      pagination: {
        page: data.pagination?.page ?? body.page,
        perPage: data.pagination?.per_page ?? body.per_page,
        totalEntries: data.pagination?.total_entries ?? null,
        totalPages: data.pagination?.total_pages ?? null,
      },
    };
  }

  async getPerson(id) {
    this.requireKey();
    if (!id) return null;
    const data = await this.post('/people/match', { id });
    return data.person ? this.normalize(data.person) : null;
  }

  /**
   * Reveal contact details. Spends an Apollo credit.
   * Pass { revealEmail: true } deliberately — it is not the default.
   */
  async enrichPerson(input = {}) {
    this.requireKey();

    const body = {};
    if (input.id) body.id = input.id;
    if (input.email) body.email = input.email;
    if (input.linkedinUrl) body.linkedin_url = input.linkedinUrl;
    if (input.firstName) body.first_name = input.firstName;
    if (input.lastName) body.last_name = input.lastName;
    if (input.companyDomain) body.domain = input.companyDomain;

    if (Object.keys(body).length === 0) {
      throw new Error('enrichPerson needs at least one of: id, email, linkedinUrl, or name + companyDomain');
    }

    if (input.revealEmail) {
      body.reveal_personal_emails = true;
    }

    const data = await this.post('/people/match', body);
    return data.person ? this.normalize(data.person) : null;
  }

  async searchCompanies(filters = {}) {
    this.requireKey();

    const body = {
      page: filters.page || 1,
      per_page: Math.min(filters.perPage || 25, 100),
    };
    if (filters.domains?.length) body.q_organization_domains = filters.domains.join('\n');
    if (filters.locations?.length) body.organization_locations = filters.locations;

    const ranges = rangesFor(filters.employeeMin, filters.employeeMax);
    if (ranges.length) body.organization_num_employees_ranges = ranges;

    const data = await this.post('/mixed_companies/search', body);

    return {
      companies: (data.organizations || data.accounts || []).map(o => this.normalizeCompany(o)),
      pagination: {
        page: data.pagination?.page ?? body.page,
        totalEntries: data.pagination?.total_entries ?? null,
      },
    };
  }

  // ── Normalization ───────────────────────────────────────

  normalize(person) {
    const org = person.organization || person.account || {};

    // Locked emails become null, not a fake-looking address.
    const { email, emailStatus } = classifyEmail(person.email, person.email_status);

    return {
      fullName: person.name || [person.first_name, person.last_name].filter(Boolean).join(' '),
      firstName: person.first_name || null,
      lastName: person.last_name || null,
      title: person.title || null,
      seniority: person.seniority || null,

      email,
      emailStatus,

      linkedinUrl: person.linkedin_url || null,

      companyName: org.name || person.organization_name || null,
      companyDomain: org.primary_domain || org.website_url || null,
      companySize: org.estimated_num_employees ?? null,
      industry: org.industry || null,

      city: person.city || null,
      state: person.state || null,
      country: person.country || null,

      source: 'apollo',
      sourceId: person.id || null,

      metadata: this.extractSignals(person, org),
    };
  }

  /**
   * Signals the fit scorer reads. Only what Apollo actually provides —
   * anything it does not know is omitted, so the scorer awards no points
   * for it rather than scoring on an invented value.
   */
  extractSignals(person, org) {
    const meta = {
      apollo_person_id: person.id || null,
      apollo_org_id: org.id || null,
    };

    // Multi-state: inferable only when Apollo returns multiple US locations
    const locations = org.locations || org.organization_locations || [];
    if (Array.isArray(locations) && locations.length > 0) {
      const states = new Set(
        locations.map(l => (typeof l === 'string' ? l : l.state)).filter(Boolean)
      );
      meta.state_count = states.size;
      if (states.size > 1) meta.multi_state = true;
    }

    // Headcount growth, when Apollo supplies the derived field
    const growth = org.organization_headcount_six_month_growth
      ?? org.headcount_six_month_growth;
    if (typeof growth === 'number') {
      meta.headcount_growth_pct = Math.round(growth * 100);
    }

    if (org.retail_location_count) meta.retail_locations = org.retail_location_count;
    if (org.founded_year) meta.founded_year = org.founded_year;
    if (org.annual_revenue) meta.annual_revenue = org.annual_revenue;

    // NOT inferred from Apollo, left absent on purpose:
    //   remote_friendly, hiring_payroll, linkedin_active
    // These need a job-board or activity signal Apollo does not provide.
    // The fit scorer simply awards 0 for them.

    return meta;
  }

  normalizeCompany(org) {
    return {
      id: org.id || null,
      name: org.name || null,
      domain: org.primary_domain || org.website_url || null,
      employeeCount: org.estimated_num_employees ?? null,
      industry: org.industry || null,
      locations: org.locations || [],
      linkedinUrl: org.linkedin_url || null,
    };
  }

  // ── Transport ───────────────────────────────────────────

  post(path, body) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);

      const req = https.request({
        hostname: API_HOST,
        path: `${API_BASE}${path}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Accept': 'application/json',
          'X-Api-Key': this.apiKey,
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: TIMEOUT_MS,
      }, (res) => {
        let out = '';
        res.on('data', c => { out += c; });
        res.on('end', () => {
          if (res.statusCode === 401 || res.statusCode === 403) {
            return reject(new ProviderUnavailableError(
              `Apollo rejected the API key (HTTP ${res.statusCode})`
            ));
          }
          if (res.statusCode === 429) {
            return reject(new Error('Apollo rate limit reached — back off and retry'));
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Apollo ${res.statusCode}: ${out.slice(0, 300)}`));
          }
          try {
            resolve(JSON.parse(out));
          } catch (err) {
            reject(new Error(`Apollo returned unparseable JSON: ${err.message}`));
          }
        });
      });

      req.on('timeout', () => { req.destroy(); reject(new Error('Apollo request timed out')); });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
}

module.exports = ApolloProspectProvider;
module.exports.EMPLOYEE_RANGES = EMPLOYEE_RANGES;
module.exports.rangesFor = rangesFor;
