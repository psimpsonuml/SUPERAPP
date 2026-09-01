// ══════════════════════════════════════════════════════════════════
// Web Search Provider
//
// Replaces three pseudo-search implementations that quietly returned
// the wrong thing:
//   - intelligence-analyst  → queried reddit.com/search.json and called
//                             it "web research"
//   - community-scout       → DuckDuckGo *Instant Answer* API, which
//                             returns disambiguation entries, not results
//   - outreach-prospector   → regex-scraped DuckDuckGo HTML
//
// Configure ONE of:
//   BRAVE_SEARCH_API_KEY                        (recommended)
//   SERPER_API_KEY                              (Google results via serper.dev)
//   GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX    (Google Custom Search)
//
// With none configured, search() throws SearchUnavailableError. Callers
// must degrade visibly — never fall back to scraping or to a
// different corpus dressed up as web results.
// ══════════════════════════════════════════════════════════════════

const https = require('https');

class SearchUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SearchUnavailableError';
    this.code = 'SEARCH_UNAVAILABLE';
  }
}

function httpGetJson(url, headers = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(body)); }
        catch (err) { reject(new Error(`Invalid JSON response: ${err.message}`)); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Search request timed out')); });
    req.on('error', reject);
  });
}

function httpPostJson(hostname, path, payload, headers = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers },
      timeout: timeoutMs,
    }, (res) => {
      let out = '';
      res.on('data', c => { out += c; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${out.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(out)); }
        catch (err) { reject(new Error(`Invalid JSON response: ${err.message}`)); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Search request timed out')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Providers ─────────────────────────────────────────────
// Each returns [{ title, url, snippet, source }]

const providers = {
  brave: {
    name: 'brave',
    isConfigured: () => !!process.env.BRAVE_SEARCH_API_KEY,
    async search(query, { limit = 10 } = {}) {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${Math.min(limit, 20)}`;
      const data = await httpGetJson(url, {
        'Accept': 'application/json',
        'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY,
      });
      return (data?.web?.results || []).map(r => ({
        title: r.title || '',
        url: r.url || '',
        snippet: r.description || '',
        source: 'brave',
      }));
    },
  },

  serper: {
    name: 'serper',
    isConfigured: () => !!process.env.SERPER_API_KEY,
    async search(query, { limit = 10 } = {}) {
      const data = await httpPostJson('google.serper.dev', '/search',
        { q: query, num: Math.min(limit, 20) },
        { 'X-API-KEY': process.env.SERPER_API_KEY });
      return (data?.organic || []).map(r => ({
        title: r.title || '',
        url: r.link || '',
        snippet: r.snippet || '',
        source: 'serper',
      }));
    },
  },

  google_cse: {
    name: 'google_cse',
    isConfigured: () => !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX),
    async search(query, { limit = 10 } = {}) {
      const url = `https://www.googleapis.com/customsearch/v1`
        + `?key=${process.env.GOOGLE_SEARCH_API_KEY}`
        + `&cx=${process.env.GOOGLE_SEARCH_CX}`
        + `&q=${encodeURIComponent(query)}`
        + `&num=${Math.min(limit, 10)}`;
      const data = await httpGetJson(url);
      return (data?.items || []).map(r => ({
        title: r.title || '',
        url: r.link || '',
        snippet: r.snippet || '',
        source: 'google_cse',
      }));
    },
  },
};

const PROVIDER_ORDER = ['brave', 'serper', 'google_cse'];

/** Return the first configured provider, or null. */
function getProvider() {
  const preferred = process.env.SEARCH_PROVIDER;
  if (preferred && providers[preferred]?.isConfigured()) return providers[preferred];
  for (const key of PROVIDER_ORDER) {
    if (providers[key].isConfigured()) return providers[key];
  }
  return null;
}

function isSearchConfigured() {
  return getProvider() !== null;
}

function configuredProviderName() {
  return getProvider()?.name || null;
}

/**
 * Run a web search.
 * Throws SearchUnavailableError when no provider is configured, so callers
 * fail visibly instead of silently researching the wrong corpus.
 */
async function search(query, options = {}) {
  const provider = getProvider();
  if (!provider) {
    throw new SearchUnavailableError(
      'No web search provider configured. Set BRAVE_SEARCH_API_KEY, SERPER_API_KEY, '
      + 'or GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX.'
    );
  }
  if (!query || !query.trim()) return [];
  return provider.search(query.trim(), options);
}

/**
 * Search variant that returns [] and logs instead of throwing.
 * Use only where an empty result is genuinely acceptable — never to
 * paper over a missing provider in a research pipeline.
 */
async function searchOrEmpty(query, options = {}, logger = null) {
  try {
    return await search(query, options);
  } catch (err) {
    if (logger) {
      const level = err.code === 'SEARCH_UNAVAILABLE' ? 'warn' : 'warn';
      logger[level](`Web search skipped: ${err.message}`, { query: query?.slice(0, 80) });
    }
    return [];
  }
}

module.exports = {
  search,
  searchOrEmpty,
  isSearchConfigured,
  configuredProviderName,
  SearchUnavailableError,
  providers,
};
