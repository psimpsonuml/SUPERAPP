export const BLOG_CONFIG = {
  name: 'The Payroll Brief',
  tagline: 'Payroll news, compliance updates, and industry insights',
  domain: 'thepayrollbrief.com',
  satelliteBlogId: 'thepayrollbrief',
  parentProduct: 'Payroll Beacon',
  accentColor: '#2563EB',
  accentColorLight: '#DBEAFE',
  logoEmoji: '📋',
  categories: ['compliance', 'legislation', 'industry news', 'best practices', 'state updates'],
  postsPerPage: 12,
  googleAnalyticsId: '',
  plausibleDomain: '',
  defaultOgImage: '/og-default.png',
  twitterHandle: '',
};

export type BlogConfig = typeof BLOG_CONFIG;
