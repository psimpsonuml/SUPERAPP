// ══════════════════════════════════════════════════════════════════
// Publisher interface
//
// The existing social-distributor helper ignored res.statusCode
// entirely and resolved with the raw body regardless — a 401 or 429 was
// treated as a successful post, and JSON.parse then threw on the HTML
// error page. This transport checks status first.
//
// Every publisher returns { ok, postId, postUrl } or { ok: false,
// reason, detail }. A publish that did not happen never reports ok.
// ══════════════════════════════════════════════════════════════════

const https = require('https');

const TIMEOUT_MS = 20000;

class PublisherUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PublisherUnavailableError';
    this.code = 'PUBLISHER_UNAVAILABLE';
  }
}

/**
 * HTTP request that surfaces status codes and response headers.
 * Headers matter: LinkedIn returns the created post id in x-restli-id,
 * not in the body.
 */
function request({ hostname, path, method = 'POST', body = null, headers = {}, timeout = TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;

    const req = https.request({
      hostname,
      path,
      method,
      headers: {
        'Accept': 'application/json',
        ...(payload ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        } : {}),
        ...headers,
      },
      timeout,
    }, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { /* HTML error page */ }

        const result = {
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
          raw,
        };

        // Status is checked here, not left to each caller's ad-hoc
        // body inspection.
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const message = parsed?.error?.message
            || parsed?.message
            || raw.slice(0, 300)
            || `HTTP ${res.statusCode}`;
          const err = new Error(`HTTP ${res.statusCode}: ${message}`);
          err.status = res.statusCode;
          err.response = result;
          return reject(err);
        }

        // Some APIs return 200 with an error envelope
        if (parsed?.error) {
          const err = new Error(parsed.error.message || JSON.stringify(parsed.error));
          err.status = res.statusCode;
          err.response = result;
          return reject(err);
        }

        resolve(result);
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

class Publisher {
  get platform() { throw new Error('Publisher must define a platform'); }

  /** @returns {boolean} whether credentials are present */
  isConfigured() { throw new Error('Not implemented'); }

  /** @returns {string[]} names of the env vars this publisher needs */
  requiredEnv() { return []; }

  /**
   * @param {Object} content { title, body, imageUrl, linkUrl, metadata }
   * @returns {Promise<{ok, postId?, postUrl?, reason?, detail?}>}
   */
  async publish() { throw new Error('Not implemented'); }

  /**
   * Whether this content can be published as-is.
   * Returning a reason here is preferable to a failed API call.
   * @returns {{publishable: boolean, reason?: string}}
   */
  canPublish() { return { publishable: true }; }

  missingEnv() {
    return this.requiredEnv().filter(name => !process.env[name]);
  }
}

module.exports = { Publisher, PublisherUnavailableError, request };
