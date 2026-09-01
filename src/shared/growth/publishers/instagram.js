// ══════════════════════════════════════════════════════════════════
// Instagram publisher (spec §33, priority 2)
//
// Instagram REQUIRES a publicly reachable image URL — the API has no
// text-only post. The previous implementation fell back to
// `https://placeholder.com/img.jpg` when no image was present, which
// meant every such post failed at container creation, and the failure
// was invisible because the transport ignored status codes.
//
// Spec §4 is explicit: "Do not use placeholder image URLs." So this
// refuses with no_image_available and the content is marked failed,
// which is the honest outcome — the pipeline currently generates an
// image PROMPT, not a rendered, hosted image.
// ══════════════════════════════════════════════════════════════════

const { Publisher, request } = require('./base');

const GRAPH_HOST = 'graph.facebook.com';
const GRAPH_VERSION = 'v21.0';
const MAX_CAPTION = 2200;

class InstagramPublisher extends Publisher {
  constructor({ igUserId, accessToken } = {}) {
    super();
    this.igUserId = igUserId || process.env.IG_USER_ID || null;
    this.accessToken = accessToken || process.env.FB_PAGE_ACCESS_TOKEN || null;
  }

  get platform() { return 'instagram'; }

  requiredEnv() { return ['IG_USER_ID', 'FB_PAGE_ACCESS_TOKEN']; }

  isConfigured() { return !!(this.igUserId && this.accessToken); }

  canPublish(content) {
    if (!content?.imageUrl) {
      return {
        publishable: false,
        reason: 'no_image_available',
        detail: 'Instagram requires a hosted image. The content pipeline produces '
          + 'an image prompt, not a rendered image — generate and host one first.',
      };
    }
    if (!/^https:\/\//.test(content.imageUrl)) {
      return { publishable: false, reason: 'image_url_not_https' };
    }
    if (!content?.body?.trim()) {
      return { publishable: false, reason: 'empty_caption' };
    }
    return { publishable: true };
  }

  async publish(content) {
    if (!this.isConfigured()) {
      return { ok: false, reason: 'not_configured', detail: `Missing: ${this.missingEnv().join(', ')}` };
    }

    const check = this.canPublish(content);
    if (!check.publishable) {
      return { ok: false, reason: check.reason, detail: check.detail };
    }

    let caption = content.body.trim();
    if (content.hashtags?.length) {
      caption = `${caption}\n\n${content.hashtags.join(' ')}`;
    }
    if (caption.length > MAX_CAPTION) caption = caption.slice(0, MAX_CAPTION - 1);

    try {
      // Step 1 — create the media container
      const container = await request({
        hostname: GRAPH_HOST,
        path: `/${GRAPH_VERSION}/${this.igUserId}/media`,
        body: { image_url: content.imageUrl, caption, access_token: this.accessToken },
      });

      const creationId = container.body?.id;
      if (!creationId) {
        return { ok: false, reason: 'container_not_created', detail: container.raw.slice(0, 200) };
      }

      // Step 2 — publish it
      const published = await request({
        hostname: GRAPH_HOST,
        path: `/${GRAPH_VERSION}/${this.igUserId}/media_publish`,
        body: { creation_id: creationId, access_token: this.accessToken },
      });

      const mediaId = published.body?.id;
      if (!mediaId) {
        return { ok: false, reason: 'publish_failed', detail: published.raw.slice(0, 200) };
      }

      // Fetch the real permalink. The old code fabricated
      // instagram.com/p/{media_id}, which is not a valid shortcode URL.
      let postUrl = null;
      try {
        const meta = await request({
          hostname: GRAPH_HOST,
          method: 'GET',
          path: `/${GRAPH_VERSION}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(this.accessToken)}`,
        });
        postUrl = meta.body?.permalink || null;
      } catch {
        // The post succeeded; only the permalink lookup failed.
      }

      return { ok: true, postId: mediaId, postUrl };
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

module.exports = InstagramPublisher;
