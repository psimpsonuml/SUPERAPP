// ══════════════════════════════════════════════════════════════════
// Facebook Page publisher (spec §33, priority 1)
//
// Graph API v21.0. Text posts go to /{page-id}/feed; posts with an
// image go to /{page-id}/photos so the image is attached rather than
// unfurled from a link.
// ══════════════════════════════════════════════════════════════════

const { Publisher, request } = require('./base');

const GRAPH_HOST = 'graph.facebook.com';
const GRAPH_VERSION = 'v21.0';

class FacebookPublisher extends Publisher {
  constructor({ pageId, accessToken } = {}) {
    super();
    this.pageId = pageId || process.env.FB_PAGE_ID || null;
    this.accessToken = accessToken || process.env.FB_PAGE_ACCESS_TOKEN || null;
  }

  get platform() { return 'facebook'; }

  requiredEnv() { return ['FB_PAGE_ID', 'FB_PAGE_ACCESS_TOKEN']; }

  isConfigured() { return !!(this.pageId && this.accessToken); }

  canPublish(content) {
    if (!content?.body || !content.body.trim()) {
      return { publishable: false, reason: 'empty_body' };
    }
    return { publishable: true };
  }

  async publish(content) {
    if (!this.isConfigured()) {
      return {
        ok: false,
        reason: 'not_configured',
        detail: `Missing: ${this.missingEnv().join(', ')}`,
      };
    }

    const check = this.canPublish(content);
    if (!check.publishable) {
      return { ok: false, reason: check.reason };
    }

    // Append the tracked link when one is supplied and not already inline
    let message = content.body.trim();
    if (content.linkUrl && !message.includes(content.linkUrl)) {
      message = `${message}\n\n${content.linkUrl}`;
    }

    const hasImage = !!content.imageUrl;
    const path = hasImage
      ? `/${GRAPH_VERSION}/${this.pageId}/photos`
      : `/${GRAPH_VERSION}/${this.pageId}/feed`;

    const body = hasImage
      ? { url: content.imageUrl, caption: message, access_token: this.accessToken }
      : { message, access_token: this.accessToken };

    try {
      const res = await request({ hostname: GRAPH_HOST, path, body });

      // A photo post returns post_id; a feed post returns id.
      const postId = res.body?.post_id || res.body?.id;
      if (!postId) {
        return {
          ok: false,
          reason: 'no_post_id_returned',
          detail: res.raw.slice(0, 200),
        };
      }

      return {
        ok: true,
        postId,
        postUrl: `https://www.facebook.com/${postId}`,
      };
    } catch (err) {
      return {
        ok: false,
        reason: err.status === 401 || err.status === 403 ? 'auth_failed'
          : err.status === 429 ? 'rate_limited'
          : 'api_error',
        detail: err.message,
        status: err.status,
      };
    }
  }
}

module.exports = FacebookPublisher;
module.exports.GRAPH_VERSION = GRAPH_VERSION;
