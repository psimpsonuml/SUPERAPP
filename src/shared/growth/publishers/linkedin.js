// ══════════════════════════════════════════════════════════════════
// LinkedIn COMPANY PAGE publisher (spec §33, priority 3)
//
// Company page only. Personal LinkedIn is never published by the
// system — spec §12 — and there is deliberately no code path here that
// could post to a personal profile.
//
// Two fixes over the previous implementation:
//   - The created post id comes back in the `x-restli-id` RESPONSE
//     HEADER, not the body. The old code read the body and always got
//     an empty id.
//   - Uses /rest/posts with a LinkedIn-Version header rather than the
//     deprecated /v2/ugcPosts.
// ══════════════════════════════════════════════════════════════════

const { Publisher, request } = require('./base');

const API_HOST = 'api.linkedin.com';
const LINKEDIN_VERSION = '202411';
const MAX_BODY = 3000;

class LinkedInCompanyPublisher extends Publisher {
  constructor({ organizationId, accessToken } = {}) {
    super();
    this.organizationId = organizationId || process.env.LINKEDIN_ORGANIZATION_ID || null;
    this.accessToken = accessToken || process.env.LINKEDIN_ACCESS_TOKEN || null;
  }

  get platform() { return 'linkedin_company'; }

  requiredEnv() { return ['LINKEDIN_ORGANIZATION_ID', 'LINKEDIN_ACCESS_TOKEN']; }

  isConfigured() { return !!(this.organizationId && this.accessToken); }

  get authorUrn() {
    const id = String(this.organizationId).replace(/^urn:li:organization:/, '');
    return `urn:li:organization:${id}`;
  }

  canPublish(content) {
    if (!content?.body?.trim()) return { publishable: false, reason: 'empty_body' };
    if (content.body.length > MAX_BODY) {
      return { publishable: false, reason: 'body_too_long', detail: `${content.body.length} > ${MAX_BODY}` };
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

    let commentary = content.body.trim();
    if (content.linkUrl && !commentary.includes(content.linkUrl)) {
      commentary = `${commentary}\n\n${content.linkUrl}`;
    }

    const body = {
      author: this.authorUrn,
      commentary,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };

    try {
      const res = await request({
        hostname: API_HOST,
        path: '/rest/posts',
        body,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'LinkedIn-Version': LINKEDIN_VERSION,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      // The id lives in the header — this is the bit the old code missed.
      const postUrn = res.headers['x-restli-id'] || res.body?.id || null;

      if (!postUrn) {
        return {
          ok: false,
          reason: 'no_post_id_returned',
          detail: 'LinkedIn accepted the post but returned no x-restli-id header',
        };
      }

      const shareId = String(postUrn).replace(/^urn:li:(share|ugcPost):/, '');

      return {
        ok: true,
        postId: postUrn,
        postUrl: `https://www.linkedin.com/feed/update/${postUrn}`,
        shareId,
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

module.exports = LinkedInCompanyPublisher;
module.exports.LINKEDIN_VERSION = LINKEDIN_VERSION;
