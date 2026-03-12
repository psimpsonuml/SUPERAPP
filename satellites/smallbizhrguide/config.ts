export const BLOG_CONFIG = {
  name: 'Small Biz HR Guide',
  tagline: 'Practical HR tips for growing businesses',
  domain: 'smallbizhrguide.com',
  satelliteBlogId: 'smallbizhrguide',
  parentProduct: 'Payroll Beacon',

  // Publisher / Organization (for JSON-LD)
  publisher: 'BeaconOps',
  publisherUrl: 'https://beaconops.com',
  publisherLogo: 'https://beaconops.com/logo.png',
  language: 'en-US',
  accentColor: '#059669',
  accentColorLight: '#D1FAE5',
  logoEmoji: '👥',
  categories: ['hiring', 'compliance', 'employee management', 'benefits', 'culture'],
  postsPerPage: 12,
  googleAnalyticsId: '',
  plausibleDomain: '',
  defaultOgImage: '/og-default.png',
  twitterHandle: '',
};

export type BlogConfig = typeof BLOG_CONFIG;
