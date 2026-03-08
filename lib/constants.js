// Agent metadata for display — maps agent IDs to human-friendly info
// Sourced from src/agents/registry.js and src/config/schedule.js

export const AGENTS = [
  // Continuous
  { id: 'inbox-monitor', name: 'Inbox Monitor', desc: 'Email monitoring & response', category: 'continuous', schedule: 'Every 5 min', essential: true },
  { id: 'infrastructure-monitor', name: 'Infrastructure Monitor', desc: 'Uptime, webhooks, API health', category: 'continuous', schedule: 'Every 1 min', essential: true },
  // Daily
  { id: 'qa-playtest', name: 'QA Playtest', desc: 'ChronoStates automated testing', category: 'daily', schedule: '12:00 AM ET', essential: false },
  { id: 'pain-point-hunter', name: 'Pain Point Hunter', desc: 'Community & market signal scan', category: 'daily', schedule: '5:30 AM ET', essential: false },
  { id: 'seo-aeo-writer', name: 'SEO/AEO Writer', desc: 'Blog posts + repurposing chain', category: 'daily', schedule: '6:00 AM ET', essential: false },
  { id: 'substack-publisher', name: 'Substack Publisher', desc: 'Paywalled newsletter generation', category: 'daily', schedule: '7:00 AM ET', essential: false },
  { id: 'social-distributor', name: 'Social Distributor', desc: 'Multi-platform social posting', category: 'daily', schedule: '7:30 AM ET', essential: false },
  { id: 'video-producer', name: 'Video Producer', desc: 'TikTok/YouTube video pipeline', category: 'daily', schedule: '8:00 AM ET', essential: false },
  { id: 'outreach-prospector', name: 'Outreach Prospector', desc: 'Lead search + email drafting', category: 'daily', schedule: '8:30 AM ET', essential: false },
  { id: 'intelligence-analyst', name: 'Intelligence Analyst', desc: 'Influencer/platform research', category: 'daily', schedule: '9:00 AM ET', essential: false },
  { id: 'product-intelligence', name: 'Product Intelligence', desc: 'Feature & pricing analysis', category: 'daily', schedule: '9:00 AM ET', essential: false },
  { id: 'ad-creative', name: 'Ad Creative', desc: 'Ad creative generation', category: 'daily', schedule: '9:30 AM ET', essential: false },
  // Weekly
  { id: 'community-scout', name: 'Community Scout', desc: 'Group & community discovery', category: 'weekly', schedule: 'Mon 6:00 AM ET', essential: false },
  { id: 'community-strategist', name: 'Community Strategist', desc: 'Rule-aware content calendar', category: 'weekly', schedule: 'Mon 7:00 AM ET', essential: false },
  { id: 'content-library-manager', name: 'Content Library Manager', desc: 'ChronoStates scenario injection', category: 'weekly', schedule: 'Mon 8:00 AM ET', essential: false },
  // Event-driven
  { id: 'user-lifecycle', name: 'User Lifecycle', desc: 'Registration drips + churn win-back', category: 'event', schedule: 'Webhook-triggered', essential: true },
];

export const CATEGORY_LABELS = {
  continuous: 'Continuous',
  daily: 'Daily',
  weekly: 'Weekly',
  event: 'Event-Driven',
};

export const PRODUCTS = [
  { id: 'chronostates', name: 'ChronoStates.io' },
  { id: 'payroll_beacon', name: 'Payroll Beacon' },
  { id: 'budgeting_beacon', name: 'Budgeting Beacon' },
];
