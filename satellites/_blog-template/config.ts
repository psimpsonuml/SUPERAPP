// ══════════════════════════════════════════════════════════
// SATELLITE BLOG CONFIG — Edit this file per blog instance
// ══════════════════════════════════════════════════════════

export const BLOG_CONFIG = {
  // Identity
  name: 'The Payroll Brief',
  tagline: 'Payroll news, compliance updates, and industry insights',
  domain: 'thepayrollbrief.com',
  satelliteBlogId: 'thepayrollbrief',
  parentProduct: 'Payroll Beacon',

  // Design
  accentColor: '#2563EB',
  accentColorLight: '#DBEAFE',
  logoEmoji: '📋',

  // Content
  categories: ['compliance', 'legislation', 'industry news', 'best practices', 'state updates'],
  postsPerPage: 12,

  // Analytics (leave empty to disable)
  googleAnalyticsId: '',
  plausibleDomain: '',

  // SEO
  defaultOgImage: '/og-default.png',
  twitterHandle: '',
};

export type BlogConfig = typeof BLOG_CONFIG;
