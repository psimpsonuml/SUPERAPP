export const BLOG_CONFIG = {
  name: 'Our Money Story',
  tagline: 'Real talk about couples, families, and finances',
  domain: 'ourmoneystory.com',
  satelliteBlogId: 'ourmoneystory',
  parentProduct: 'Budgeting Beacon',

  // Publisher / Organization (for JSON-LD)
  publisher: 'BeaconOps',
  publisherUrl: 'https://beaconops.com',
  publisherLogo: 'https://beaconops.com/logo.png',
  language: 'en-US',
  accentColor: '#E11D48',
  accentColorLight: '#FFE4E6',
  logoEmoji: '❤️',
  categories: ['couples budgeting', 'family finances', 'money conversations', 'teaching kids', 'shared goals'],
  postsPerPage: 12,
  googleAnalyticsId: '',
  plausibleDomain: '',
  defaultOgImage: '/og-default.png',
  twitterHandle: '',
};

export type BlogConfig = typeof BLOG_CONFIG;
