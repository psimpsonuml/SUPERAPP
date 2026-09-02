// ══════════════════════════════════════════════════════════════════
// ProspectProvider interface (spec §18)
//
// Apollo-specific request shapes live behind this. Nothing outside
// src/shared/growth/providers/ should know which vendor is in use.
//
// Every implementation returns the same normalized prospect shape so
// the import path, fit scoring, and dedup never branch on provider.
// ══════════════════════════════════════════════════════════════════

class ProviderUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProviderUnavailableError';
    this.code = 'PROVIDER_UNAVAILABLE';
  }
}

/**
 * Normalized prospect. Fields the provider genuinely does not know are
 * null — never a guess, and never a placeholder that looks like data.
 *
 * @typedef {Object} NormalizedProspect
 * @property {string}  fullName
 * @property {string?} firstName
 * @property {string?} lastName
 * @property {string?} title
 * @property {string?} seniority
 * @property {string?} email          null when the provider withheld it
 * @property {string}  emailStatus    verified | guessed | unavailable | invalid | unknown
 * @property {string?} linkedinUrl
 * @property {string?} companyName
 * @property {string?} companyDomain
 * @property {number?} companySize
 * @property {string?} industry
 * @property {string?} city
 * @property {string?} state
 * @property {string?} country
 * @property {string}  source         provider name
 * @property {string?} sourceId       provider's own id, for dedup
 * @property {Object}  metadata       signals the fit scorer reads
 */

class ProspectProvider {
  /** @returns {string} */
  get name() {
    throw new Error('Provider must define a name');
  }

  /** @returns {boolean} whether credentials are present */
  isConfigured() {
    throw new Error('Not implemented');
  }

  /**
   * @param {Object} filters titles[], employeeMin, employeeMax, industries[],
   *                         locations[], page, perPage
   * @returns {Promise<{prospects: NormalizedProspect[], pagination: Object}>}
   */
  async searchPeople() {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<NormalizedProspect|null>} */
  async getPerson() {
    throw new Error('Not implemented');
  }

  /**
   * Reveal or verify contact details for a known person.
   * @returns {Promise<NormalizedProspect|null>}
   */
  async enrichPerson() {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<{companies: Object[], pagination: Object}>} */
  async searchCompanies() {
    throw new Error('Not implemented');
  }
}

// Apollo returns this local-part when an email exists but has not been
// unlocked with credits. Storing it would look like a real address and
// every send to it would bounce.
const LOCKED_EMAIL_PATTERN = /^email_not_unlocked/i;

/**
 * Decide what to store for an email the provider returned.
 * A locked or placeholder value becomes null + 'unavailable' rather
 * than a string that looks contactable.
 */
function classifyEmail(rawEmail, providerStatus) {
  const email = (rawEmail || '').trim().toLowerCase();

  if (!email || LOCKED_EMAIL_PATTERN.test(email)) {
    return { email: null, emailStatus: 'unavailable' };
  }
  if (!email.includes('@') || email.split('@')[1]?.includes('..')) {
    return { email: null, emailStatus: 'invalid' };
  }

  const status = {
    verified: 'verified',
    likely_to_engage: 'guessed',
    guessed: 'guessed',
    unavailable: 'unavailable',
    unverified: 'guessed',
  }[providerStatus] || 'guessed';

  return { email, emailStatus: status };
}

module.exports = {
  ProspectProvider,
  ProviderUnavailableError,
  classifyEmail,
  LOCKED_EMAIL_PATTERN,
};
