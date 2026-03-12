export const BLOG_CONFIG = {
  name: 'Money Clarity Guide',
  tagline: 'See your finances clearly',
  domain: 'moneyclarityguide.com',
  satelliteBlogId: 'moneyclarityguide',
  parentProduct: 'Budgeting Beacon',

  // Publisher / Organization (for JSON-LD)
  publisher: 'BeaconOps',
  publisherUrl: 'https://beaconops.com',
  publisherLogo: 'https://beaconops.com/logo.png',
  language: 'en-US',
  accentColor: '#0891B2',
  accentColorLight: '#CFFAFE',
  logoEmoji: '💰',
  categories: ['budgeting', 'saving', 'debt', 'investing', 'financial literacy'],
  postsPerPage: 12,
  googleAnalyticsId: '',
  plausibleDomain: '',
  defaultOgImage: '/og-default.png',
  twitterHandle: '',
};

export type BlogConfig = typeof BLOG_CONFIG;
