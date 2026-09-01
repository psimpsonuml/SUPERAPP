// ══════════════════════════════════════════════════════════════════
// Mock prospect provider (spec §33, Phase 6)
//
// For development without Apollo credentials. Deliberately obvious:
//   - source is 'mock', never 'apollo'
//   - every email is @example.invalid, a reserved TLD that cannot
//     receive mail (RFC 2606), so a misconfiguration cannot send
//     to a real person
//   - metadata carries is_mock: true
//
// No hardcoded real credentials, and nothing here should ever be
// mistaken for live data.
// ══════════════════════════════════════════════════════════════════

const { ProspectProvider, classifyEmail } = require('./base');

const FIRST_NAMES = ['Dana', 'Marcus', 'Priya', 'Elena', 'Tom', 'Aisha', 'Ben', 'Sofia', 'Ray', 'Nina'];
const LAST_NAMES = ['Whitfield', 'Okafor', 'Raman', 'Vasquez', 'Brennan', 'Haddad', 'Lindqvist', 'Moreau', 'Ellis', 'Kowalski'];

const TITLES = [
  { title: 'Director of Payroll', seniority: 'director' },
  { title: 'Payroll Manager', seniority: 'manager' },
  { title: 'VP Payroll', seniority: 'vp' },
  { title: 'Global Payroll Director', seniority: 'director' },
  { title: 'Payroll Operations Manager', seniority: 'manager' },
  { title: 'Senior Payroll Manager', seniority: 'manager' },
  { title: 'Head of Payroll', seniority: 'head' },
  { title: 'HRIS Director', seniority: 'director' },
  { title: 'Controller', seniority: 'director' },
  { title: 'Software Engineer', seniority: 'entry' }, // deliberate poor fit
];

const COMPANIES = [
  { name: 'Northwind Health', domain: 'northwind-health.example', size: 2400, industry: 'Healthcare', states: ['CA', 'OR', 'WA', 'NV'] },
  { name: 'Cascade Biolabs', domain: 'cascadebio.example', size: 850, industry: 'Biotech', states: ['MA', 'CA'] },
  { name: 'Ridgeline Manufacturing', domain: 'ridgeline-mfg.example', size: 3200, industry: 'Manufacturing', states: ['OH', 'IN', 'MI', 'KY', 'PA'] },
  { name: 'Beacon Financial Group', domain: 'beaconfin.example', size: 1200, industry: 'Financial Services', states: ['NY', 'NJ'] },
  { name: 'Summit Hospitality', domain: 'summithosp.example', size: 4800, industry: 'Hospitality', states: ['FL', 'TX', 'AZ', 'NV', 'CA', 'GA'] },
  { name: 'Alder & Vance', domain: 'aldervance.example', size: 320, industry: 'Professional Services', states: ['IL'] },
  { name: 'Tidepool Software', domain: 'tidepool.example', size: 140, industry: 'Technology', states: ['CA'] },
  { name: 'Granite Retail Co', domain: 'graniteretail.example', size: 6100, industry: 'Retail', states: ['TX', 'OK', 'NM', 'AR'] },
];

const CITIES = [
  ['San Francisco', 'CA'], ['Boston', 'MA'], ['Columbus', 'OH'],
  ['New York', 'NY'], ['Austin', 'TX'], ['Chicago', 'IL'], ['Denver', 'CO'],
];

// Deterministic pseudo-random so repeated runs produce a stable set.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

class MockProspectProvider extends ProspectProvider {
  constructor({ seed = 42 } = {}) {
    super();
    this.seed = seed;
  }

  get name() { return 'mock'; }

  isConfigured() { return true; }

  async searchPeople(filters = {}) {
    const perPage = Math.min(filters.perPage || 25, 100);
    const page = filters.page || 1;
    const rand = seeded(this.seed + page);

    const prospects = [];
    for (let i = 0; i < perPage; i++) {
      const person = this.makePerson(rand, (page - 1) * perPage + i);

      // Honour the filters so the mock exercises the same code paths
      if (filters.employeeMin && person.companySize < filters.employeeMin) continue;
      if (filters.employeeMax && person.companySize > filters.employeeMax) continue;
      if (filters.titles?.length) {
        const matches = filters.titles.some(t =>
          person.title.toLowerCase().includes(t.toLowerCase())
        );
        if (!matches) continue;
      }
      if (filters.industries?.length && !filters.industries.includes(person.industry)) continue;

      prospects.push(person);
    }

    return {
      prospects,
      pagination: { page, perPage, totalEntries: prospects.length, totalPages: 3 },
    };
  }

  makePerson(rand, index) {
    const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const role = TITLES[Math.floor(rand() * TITLES.length)];
    const company = COMPANIES[Math.floor(rand() * COMPANIES.length)];
    const [city, state] = CITIES[Math.floor(rand() * CITIES.length)];

    // Roughly a third of search results have no revealed email, matching
    // Apollo's real behaviour.
    const emailRevealed = rand() > 0.35;
    const rawEmail = emailRevealed
      ? `${first.toLowerCase()}.${last.toLowerCase()}@example.invalid`
      : 'email_not_unlocked@domain.com';

    const { email, emailStatus } = classifyEmail(rawEmail, emailRevealed ? 'verified' : null);

    return {
      fullName: `${first} ${last}`,
      firstName: first,
      lastName: last,
      title: role.title,
      seniority: role.seniority,
      email,
      emailStatus,
      linkedinUrl: `https://www.linkedin.com/in/mock-${first.toLowerCase()}-${last.toLowerCase()}-${index}`,
      companyName: company.name,
      companyDomain: company.domain,
      companySize: company.size,
      industry: company.industry,
      city,
      state,
      country: 'United States',
      source: 'mock',
      sourceId: `mock-person-${index}`,
      metadata: {
        is_mock: true,
        state_count: company.states.length,
        multi_state: company.states.length > 1,
        headcount_growth_pct: Math.round(rand() * 45),
        remote_friendly: rand() > 0.5,
        hiring_payroll: rand() > 0.7,
        linkedin_active: rand() > 0.4,
      },
    };
  }

  async getPerson(id) {
    const rand = seeded(this.seed);
    return this.makePerson(rand, parseInt(String(id).replace(/\D/g, ''), 10) || 0);
  }

  async enrichPerson(input = {}) {
    const rand = seeded(this.seed + 7);
    const person = this.makePerson(rand, 0);

    // Enrichment reveals an address that search withheld
    const first = (input.firstName || person.firstName).toLowerCase();
    const last = (input.lastName || person.lastName).toLowerCase();

    return {
      ...person,
      firstName: input.firstName || person.firstName,
      lastName: input.lastName || person.lastName,
      fullName: input.firstName && input.lastName
        ? `${input.firstName} ${input.lastName}` : person.fullName,
      email: `${first}.${last}@example.invalid`,
      emailStatus: 'verified',
      companyDomain: input.companyDomain || person.companyDomain,
      sourceId: input.id || person.sourceId,
      metadata: { ...person.metadata, enriched: true },
    };
  }

  async searchCompanies(filters = {}) {
    let companies = COMPANIES.map((c, i) => ({
      id: `mock-org-${i}`,
      name: c.name,
      domain: c.domain,
      employeeCount: c.size,
      industry: c.industry,
      locations: c.states,
      linkedinUrl: null,
    }));

    if (filters.employeeMin) companies = companies.filter(c => c.employeeCount >= filters.employeeMin);
    if (filters.employeeMax) companies = companies.filter(c => c.employeeCount <= filters.employeeMax);

    return { companies, pagination: { page: 1, totalEntries: companies.length } };
  }
}

module.exports = MockProspectProvider;
module.exports.COMPANIES = COMPANIES;
module.exports.TITLES = TITLES;
