// ══════════════════════════════════════════════════════════════════
// Growth Attribution (spec §14)
//
// Builds UTM-tagged outbound links and records the events they produce,
// so registrations can be traced back to the content or outreach that
// caused them.
// ══════════════════════════════════════════════════════════════════

const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');
const config = require('../../config');
const logger = require('../logger');

// Canonical utm_source values per channel.
const CONTENT_SOURCES = {
  blog: 'blog',
  facebook: 'facebook',
  instagram: 'instagram',
  linkedin_company: 'linkedin_company',
  linkedin_personal: 'linkedin_personal',
  x: 'x',
  reddit: 'reddit',
  substack: 'substack',
  youtube: 'youtube',
  tiktok: 'tiktok',
  tumblr: 'tumblr',
};

const OUTBOUND_SOURCES = {
  email: 'apollo',
  linkedin: 'linkedin_outreach',
};

function baseUrl() {
  return config.urls?.payrollBeacon || 'https://payrollbeacon.com';
}

/**
 * Build a UTM-tagged URL.
 * Undefined params are omitted rather than serialized as "undefined".
 */
function buildUrl({ url, source, medium, campaign, content, term }) {
  const target = url || baseUrl();
  const parsed = new URL(target.startsWith('http') ? target : `https://${target}`);

  const params = {
    utm_source: source,
    utm_medium: medium,
    utm_campaign: campaign,
    utm_content: content,
    utm_term: term,
  };

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      parsed.searchParams.set(key, String(value));
    }
  }

  return parsed.toString();
}

/** Link for a piece of published content. */
function contentUrl({ platform, campaign, contentSlug, url }) {
  return buildUrl({
    url,
    source: CONTENT_SOURCES[platform] || platform,
    medium: 'organic_social',
    campaign: campaign || 'content',
    content: contentSlug,
  });
}

/** Link for an outreach message. */
function outreachUrl({ channel = 'email', campaign, asset, url }) {
  return buildUrl({
    url,
    source: OUTBOUND_SOURCES[channel] || channel,
    medium: channel,
    campaign: campaign || 'multistate_payroll',
    content: asset,
  });
}

class GrowthAttributionService {
  constructor(accountId) {
    this.accountId = accountId;
  }

  /** Record an attribution event. Never throws. */
  async record({
    eventType = 'click', utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
    landingUrl, referrer, contentId, prospectId, campaignId, externalId, valueUsd, metadata,
  }) {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data } = await getSupabase()
        .from('growth_attribution_events')
        .insert({
          account_id: this.accountId,
          event_type: eventType,
          utm_source: utmSource || null,
          utm_medium: utmMedium || null,
          utm_campaign: utmCampaign || null,
          utm_content: utmContent || null,
          utm_term: utmTerm || null,
          landing_url: landingUrl || null,
          referrer: referrer || null,
          content_id: contentId || null,
          prospect_id: prospectId || null,
          campaign_id: campaignId || null,
          external_id: externalId || null,
          value_usd: valueUsd ?? null,
          metadata: metadata || {},
        })
        .select('id')
        .single();
      return data?.id || null;
    } catch (err) {
      logger.warn(`Failed to record attribution event: ${err.message}`, {
        accountId: this.accountId,
      });
      return null;
    }
  }

  /** Record from a raw query string (e.g. a landing-page ping). */
  async recordFromQuery(query = {}, { eventType = 'visit', landingUrl, referrer } = {}) {
    if (!query.utm_source && !query.utm_campaign) return null;
    return this.record({
      eventType,
      utmSource: query.utm_source,
      utmMedium: query.utm_medium,
      utmCampaign: query.utm_campaign,
      utmContent: query.utm_content,
      utmTerm: query.utm_term,
      landingUrl,
      referrer,
    });
  }

  /** Funnel rollup grouped by campaign, then source. */
  async funnel({ days = 30 } = {}) {
    if (!isSupabaseConfigured()) return { byCampaign: {}, bySource: {}, totals: {} };

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data } = await getSupabase()
      .from('growth_attribution_events')
      .select('event_type, utm_source, utm_campaign, value_usd')
      .eq('account_id', this.accountId)
      .gte('created_at', since.toISOString());

    const byCampaign = {};
    const bySource = {};
    const totals = {};

    for (const row of data || []) {
      const campaign = row.utm_campaign || 'untagged';
      const source = row.utm_source || 'unknown';
      const type = row.event_type;

      byCampaign[campaign] = byCampaign[campaign] || {};
      byCampaign[campaign][type] = (byCampaign[campaign][type] || 0) + 1;

      bySource[source] = bySource[source] || {};
      bySource[source][type] = (bySource[source][type] || 0) + 1;

      totals[type] = (totals[type] || 0) + 1;
    }

    return { byCampaign, bySource, totals, periodDays: days };
  }
}

module.exports = GrowthAttributionService;
module.exports.buildUrl = buildUrl;
module.exports.contentUrl = contentUrl;
module.exports.outreachUrl = outreachUrl;
module.exports.CONTENT_SOURCES = CONTENT_SOURCES;
module.exports.OUTBOUND_SOURCES = OUTBOUND_SOURCES;
