// Agent metadata for display — maps agent IDs to human-friendly info
// Business + personal agents shown in the agents dashboard

export const AGENTS = [
  // ── Business: Continuous ─────────────────────────────────
  { id: 'inbox-monitor', name: 'Inbox Monitor', desc: 'Email classification & response drafting', category: 'configurable', schedule: 'Weekly (Mon 6:00 AM ET) — set INBOX_MONITOR_FREQUENCY to daily or hourly', essential: true, module: 'business' },
  { id: 'infrastructure-monitor', name: 'Infrastructure Monitor', desc: 'Uptime, webhooks, API health', category: 'continuous', schedule: 'Every 1 min', essential: true, module: 'business' },
  // ── Business: Daily ──────────────────────────────────────
  { id: 'qa-playtest', name: 'QA Playtest', desc: 'ChronoStates automated testing', category: 'daily', schedule: '12:00 AM ET', essential: false, module: 'business' },
  { id: 'pain-point-hunter', name: 'Pain Point Hunter', desc: 'Community & market signal scan', category: 'daily', schedule: '5:30 AM ET', essential: false, module: 'business' },
  { id: 'seo-aeo-writer', name: 'SEO/AEO Writer', desc: 'Blog posts + repurposing chain', category: 'daily', schedule: '6:00 AM ET', essential: false, module: 'business' },
  { id: 'substack-publisher', name: 'Substack Publisher', desc: 'Paywalled newsletter generation', category: 'daily', schedule: '7:00 AM ET', essential: false, module: 'business' },
  { id: 'social-distributor', name: 'Social Distributor', desc: 'Multi-platform social posting', category: 'daily', schedule: '7:30 AM ET', essential: false, module: 'business' },
  { id: 'video-producer', name: 'Video Producer', desc: 'TikTok/YouTube video pipeline', category: 'daily', schedule: '8:00 AM ET', essential: false, module: 'business' },
  { id: 'outreach-prospector', name: 'Outreach Prospector', desc: 'Lead search + email drafting', category: 'daily', schedule: '8:30 AM ET', essential: false, module: 'business' },
  { id: 'intelligence-analyst', name: 'Intelligence Analyst', desc: 'Influencer/platform research', category: 'weekly', schedule: 'Tue 9:00 AM ET', essential: false, module: 'business' },
  { id: 'product-intelligence', name: 'Product Intelligence', desc: 'Feature & pricing analysis', category: 'daily', schedule: '9:00 AM ET', essential: false, module: 'business' },
  { id: 'ad-creative', name: 'Ad Creative', desc: 'Ad creative generation', category: 'weekly', schedule: 'Wed 9:30 AM ET', essential: false, module: 'business' },
  { id: 'wrestling-scraper', name: 'Wrestling Results Scraper', desc: 'Weekly results scrape + statistics', category: 'weekly', schedule: 'Tue 5:00 AM ET', essential: false, module: 'personal' },
  // ── Business: Weekly ─────────────────────────────────────
  { id: 'community-scout', name: 'Community Scout', desc: 'Community discovery + rule-aware content calendar', category: 'monthly', schedule: '1st of month, 6:00 AM ET', essential: false, module: 'business' },
  { id: 'content-library-manager', name: 'Content Library Manager', desc: 'ChronoStates scenario injection', category: 'weekly', schedule: 'Mon 8:00 AM ET', essential: false, module: 'business' },
  // ── Business: Event-Driven ───────────────────────────────
  { id: 'user-lifecycle', name: 'User Lifecycle', desc: 'Registration drips + churn win-back', category: 'event', schedule: 'Webhook-triggered', essential: true, module: 'business' },
  // ── Business: On-Demand ──────────────────────────────────
  // ── Personal: On-Demand ──────────────────────────────────
  { id: 'entertainment-ranker', name: 'Entertainment Ranker', desc: 'Movie/TV/wrestling cascade scoring', category: 'on-demand', schedule: 'On-demand', essential: false, module: 'personal' },
  { id: 'personal-profile-quiz', name: 'Profile Quiz', desc: 'Comprehensive preference/belief profiler', category: 'on-demand', schedule: 'On-demand', essential: false, module: 'personal' },
  { id: 'facebook-archaeologist', name: 'Facebook Archaeologist', desc: 'FB data export analysis', category: 'on-demand', schedule: 'One-time + on-demand', essential: false, module: 'personal' },
  // ── Personal: Continuous ─────────────────────────────────
  { id: 'life-manager', name: 'Life Manager', desc: 'Reminders, routines, family log', category: 'continuous', schedule: 'Continuous', essential: false, module: 'personal' },
  { id: 'news-social-feed', name: 'News & Social Feed', desc: 'Unified multi-viewpoint news + social', category: 'continuous', schedule: 'Continuous', essential: false, module: 'personal' },
  // ── Personal: Daily ──────────────────────────────────────
  { id: 'health-dashboard', name: 'Health Dashboard', desc: 'Fitness/health data aggregation', category: 'daily', schedule: 'Daily refresh', essential: false, module: 'personal' },
  // ── Personal: Weekly ─────────────────────────────────────
  { id: 'release-tracker', name: 'Release Tracker', desc: 'Streaming/theater/game new releases', category: 'weekly', schedule: 'Weekly (Fridays)', essential: false, module: 'personal' },
  { id: 'learning-queue', name: 'Learning Queue', desc: 'Knowledge backlog + weekly surfacing', category: 'weekly', schedule: 'Weekly digest', essential: false, module: 'personal' },
];

export const CATEGORY_LABELS = {
  continuous: 'Continuous',
  daily: 'Daily',
  weekly: 'Weekly',
  event: 'Event-Driven',
  'on-demand': 'On-Demand',
};

export const PRODUCTS = [
  { id: 'chronostates', name: 'ChronoStates.io' },
  { id: 'payroll_beacon', name: 'Payroll Beacon' },
  { id: 'budgeting_beacon', name: 'Budgeting Beacon' },
  { id: 'beaconops', name: 'BeaconOps' },
];

export const VISIBILITY_LEVELS = [
  { id: 'public', label: 'Public', desc: 'Available on all paid plans', color: 'var(--green)' },
  { id: 'premium_only', label: 'Premium Only', desc: 'Requires Growth plan or higher', color: 'var(--accent)' },
  { id: 'internal_only', label: 'Internal Only', desc: 'Admin account only', color: 'var(--purple)' },
  { id: 'hidden', label: 'Hidden', desc: 'Disabled for everyone', color: 'var(--text-muted)' },
];

export const PERSONAL_MODULES = [
  { id: 'entertainment', name: 'Entertainment', desc: 'Movies, TV, wrestling with cascade scoring', icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z', href: '/personal/entertainment' },
  { id: 'wrestling', name: 'Wrestling', desc: 'WWE/AEW/NJPW/TNA/ROH/GCW results + cascade scoring', icon: 'M6.5 6.5h11v11h-11z M4 9h2.5M17.5 9H20M4 15h2.5M17.5 15H20', href: '/personal/wrestling' },
  { id: 'life', name: 'Life Manager', desc: 'Reminders, routines, family log', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z', href: '/personal/life' },
  { id: 'releases', name: 'Releases', desc: 'Streaming/theater/game new releases', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', href: '/personal/releases' },
  { id: 'quiz', name: 'Profile Quiz', desc: 'Preferences, beliefs, personality', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', href: '/personal/quiz' },
  { id: 'news', name: 'News Feed', desc: 'Multi-viewpoint news + social', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z', href: '/personal/news' },
  { id: 'health', name: 'Health', desc: 'Fitness/health data aggregation', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z', href: '/personal/health' },
  { id: 'learning', name: 'Learning', desc: 'Knowledge backlog + weekly surfacing', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', href: '/personal/learning' },
  { id: 'facebook', name: 'Facebook Archive', desc: 'Social history analysis', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', href: '/personal/facebook' },
];

export const CASCADE_WEIGHTS = {
  movie: {
    director: { weight: 1.0, label: 'Director' },
    lead_actor: { weight: 0.8, label: 'Lead Actor' },
    writer: { weight: 0.7, label: 'Writer' },
    supporting_actor: { weight: 0.5, label: 'Supporting' },
    cinematographer: { weight: 0.4, label: 'Cinematographer' },
    composer: { weight: 0.3, label: 'Composer' },
  },
  wrestling: {
    winner: { weight: 1.0, label: 'Winner' },
    loser: { weight: 0.8, label: 'Loser' },
    participant: { weight: 0.6, label: 'Participant' },
  },
};
