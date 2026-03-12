export const BLOG_CONFIG = {
  name: 'AI Vibe Coder Weekly',
  tagline: 'AI tools, indie building, and the vibe coding movement',
  domain: 'aivibecoderweekly.com',
  satelliteBlogId: 'aivibecoderweekly',
  parentProduct: 'ChronoStates',

  // Publisher / Organization (for JSON-LD)
  publisher: 'BeaconOps',
  publisherUrl: 'https://beaconops.com',
  publisherLogo: 'https://beaconops.com/logo.png',
  language: 'en-US',
  accentColor: '#7C3AED',
  accentColorLight: '#EDE9FE',
  logoEmoji: '⚡',
  categories: ['AI tools', 'vibe coding', 'indie hacking', 'build in public', 'tutorials', 'tool reviews'],
  postsPerPage: 12,
  googleAnalyticsId: '',
  plausibleDomain: '',
  defaultOgImage: '/og-default.png',
  twitterHandle: '',
};

export type BlogConfig = typeof BLOG_CONFIG;
