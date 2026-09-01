// ══════════════════════════════════════════════════════════════════
// Prospect provider factory
//
// Selection:
//   PROSPECT_PROVIDER=apollo|mock  explicit choice
//   otherwise: apollo when APOLLO_API_KEY is set, else none
//
// The mock provider is NEVER selected implicitly. Falling back to fake
// prospects because a key is missing would look like the system is
// working when it is not — so with no key and no explicit choice,
// getProvider() returns null and callers report that plainly.
// ══════════════════════════════════════════════════════════════════

const ApolloProspectProvider = require('./apollo');
const MockProspectProvider = require('./mock');
const { ProviderUnavailableError, classifyEmail } = require('./base');
const logger = require('../../logger');

function getProvider(explicit = null) {
  const choice = (explicit || process.env.PROSPECT_PROVIDER || '').toLowerCase();

  if (choice === 'mock') {
    logger.warn('Using the MOCK prospect provider — results are fabricated test data');
    return new MockProspectProvider();
  }

  if (choice === 'apollo') {
    const provider = new ApolloProspectProvider();
    if (!provider.isConfigured()) {
      throw new ProviderUnavailableError(
        'PROSPECT_PROVIDER=apollo but APOLLO_API_KEY is not set'
      );
    }
    return provider;
  }

  // No explicit choice: use Apollo only if it is genuinely configured.
  const apollo = new ApolloProspectProvider();
  if (apollo.isConfigured()) return apollo;

  return null;
}

function isConfigured() {
  try {
    return getProvider() !== null;
  } catch {
    return false;
  }
}

function providerName() {
  try {
    return getProvider()?.name || null;
  } catch {
    return null;
  }
}

module.exports = {
  getProvider,
  isConfigured,
  providerName,
  ApolloProspectProvider,
  MockProspectProvider,
  ProviderUnavailableError,
  classifyEmail,
};
