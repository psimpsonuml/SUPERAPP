// ══════════════════════════════════════════════════════════════════
// Publisher registry
//
// Platforms with no publisher here are manual-post by design, not
// oversights. linkedin_personal is permanently manual (spec §12) and
// has no publisher class at all — there is no code path that could
// post to a personal profile.
// ══════════════════════════════════════════════════════════════════

const FacebookPublisher = require('./facebook');
const InstagramPublisher = require('./instagram');
const LinkedInCompanyPublisher = require('./linkedin');
const { Publisher, PublisherUnavailableError, request } = require('./base');

const PUBLISHERS = {
  facebook: FacebookPublisher,
  instagram: InstagramPublisher,
  linkedin_company: LinkedInCompanyPublisher,
};

// Platforms that will never have an automated publisher, with the reason.
const MANUAL_PLATFORMS = {
  linkedin_personal: 'Spec §12 — personal LinkedIn is never auto-published',
  blog: 'Published through the Payroll Beacon site, not an API',
  x: 'No integration built yet',
  reddit: 'Community rules make automated posting inappropriate',
  substack: 'Published by email, handled by substack-publisher',
  youtube: 'No integration built yet',
  tiktok: 'No integration built yet',
  video: 'Video assets are produced, not posted',
};

function getPublisher(platform) {
  const Cls = PUBLISHERS[platform];
  return Cls ? new Cls() : null;
}

function canAutoPublish(platform) {
  return Object.prototype.hasOwnProperty.call(PUBLISHERS, platform);
}

function manualReason(platform) {
  return MANUAL_PLATFORMS[platform] || 'No publisher registered for this platform';
}

/** Configuration status for every platform, for the settings screen. */
function status() {
  const out = {};

  for (const [platform, Cls] of Object.entries(PUBLISHERS)) {
    const instance = new Cls();
    out[platform] = {
      automated: true,
      configured: instance.isConfigured(),
      required_env: instance.requiredEnv(),
      missing_env: instance.missingEnv(),
    };
  }

  for (const [platform, reason] of Object.entries(MANUAL_PLATFORMS)) {
    out[platform] = { automated: false, configured: false, reason };
  }

  return out;
}

module.exports = {
  getPublisher,
  canAutoPublish,
  manualReason,
  status,
  PUBLISHERS,
  MANUAL_PLATFORMS,
  Publisher,
  PublisherUnavailableError,
  request,
};
