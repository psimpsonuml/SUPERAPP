// Agent metadata for display — maps agent IDs to human-friendly info
// 17 business agents + 12 personal agents = 29 total per spec

export const AGENTS = [
  // ── Business: Continuous ─────────────────────────────────
  { id: 'inbox-monitor', name: 'Inbox Monitor', desc: 'Email monitoring & response', category: 'continuous', schedule: 'Every 5 min', essential: true, module: 'business' },
  { id: 'infrastructure-monitor', name: 'Infrastructure Monitor', desc: 'Uptime, webhooks, API health', category: 'continuous', schedule: 'Every 1 min', essential: true, module: 'business' },
  // ── Business: Daily ──────────────────────────────────────
  { id: 'qa-playtest', name: 'QA Playtest', desc: 'ChronoStates automated testing', category: 'daily', schedule: '12:00 AM ET', essential: false, module: 'business' },
  { id: 'pain-point-hunter', name: 'Pain Point Hunter', desc: 'Community & market signal scan', category: 'daily', schedule: '5:30 AM ET', essential: false, module: 'business' },
  { id: 'seo-aeo-writer', name: 'SEO/AEO Writer', desc: 'Blog posts + repurposing chain', category: 'daily', schedule: '6:00 AM ET', essential: false, module: 'business' },
  { id: 'substack-publisher', name: 'Substack Publisher', desc: 'Paywalled newsletter generation', category: 'daily', schedule: '7:00 AM ET', essential: false, module: 'business' },
  { id: 'social-distributor', name: 'Social Distributor', desc: 'Multi-platform social posting', category: 'daily', schedule: '7:30 AM ET', essential: false, module: 'business' },
  { id: 'video-producer', name: 'Video Producer', desc: 'TikTok/YouTube video pipeline', category: 'daily', schedule: '8:00 AM ET', essential: false, module: 'business' },
  { id: 'outreach-prospector', name: 'Outreach Prospector', desc: 'Lead search + email drafting', category: 'daily', schedule: '8:30 AM ET', essential: false, module: 'business' },
  { id: 'intelligence-analyst', name: 'Intelligence Analyst', desc: 'Influencer/platform research', category: 'daily', schedule: '9:00 AM ET', essential: false, module: 'business' },
  { id: 'product-intelligence', name: 'Product Intelligence', desc: 'Feature & pricing analysis', category: 'daily', schedule: '9:00 AM ET', essential: false, module: 'business' },
  { id: 'builder-community', name: 'Builder Community', desc: 'Builder intel & promo rotation', category: 'daily', schedule: '6:00 AM ET', essential: false, module: 'business' },
  { id: 'ad-creative', name: 'Ad Creative', desc: 'Ad creative generation', category: 'daily', schedule: '9:30 AM ET', essential: false, module: 'business' },
  // ── Business: Weekly ─────────────────────────────────────
  { id: 'community-scout', name: 'Community Scout', desc: 'Group & community discovery', category: 'weekly', schedule: 'Mon 6:00 AM ET', essential: false, module: 'business' },
  { id: 'community-strategist', name: 'Community Strategist', desc: 'Rule-aware content calendar', category: 'weekly', schedule: 'Mon 7:00 AM ET', essential: false, module: 'business' },
  { id: 'content-library-manager', name: 'Content Library Manager', desc: 'ChronoStates scenario injection', category: 'weekly', schedule: 'Mon 8:00 AM ET', essential: false, module: 'business' },
  // ── Business: Event-Driven ───────────────────────────────
  { id: 'user-lifecycle', name: 'User Lifecycle', desc: 'Registration drips + churn win-back', category: 'event', schedule: 'Webhook-triggered', essential: true, module: 'business' },
  // ── Business: On-Demand ──────────────────────────────────
  { id: 'onboarding-setup', name: 'Onboarding & Setup', desc: 'Profile assets + setup checklists', category: 'on-demand', schedule: 'Manual trigger', essential: false, module: 'business' },
  // ── Personal: On-Demand ──────────────────────────────────
  { id: 'entertainment-ranker', name: 'Entertainment Ranker', desc: 'Movie/TV/wrestling cascade scoring', category: 'on-demand', schedule: 'On-demand', essential: false, module: 'personal' },
  { id: 'book-ranker', name: 'Book Ranker', desc: 'Book ranking with author cascade', category: 'on-demand', schedule: 'On-demand', essential: false, module: 'personal' },
  { id: 'personal-profile-quiz', name: 'Profile Quiz', desc: 'Comprehensive preference/belief profiler', category: 'on-demand', schedule: 'On-demand', essential: false, module: 'personal' },
  { id: 'dna-analyst', name: 'DNA Analyst', desc: '23andMe + public genetics atlas', category: 'on-demand', schedule: 'On-demand', essential: false, module: 'personal' },
  { id: 'facebook-archaeologist', name: 'Facebook Archaeologist', desc: 'FB data export analysis', category: 'on-demand', schedule: 'One-time + on-demand', essential: false, module: 'personal' },
  // ── Personal: Continuous ─────────────────────────────────
  { id: 'life-manager', name: 'Life Manager', desc: 'Reminders, routines, family log', category: 'continuous', schedule: 'Continuous', essential: false, module: 'personal' },
  { id: 'news-social-feed', name: 'News & Social Feed', desc: 'Unified multi-viewpoint news + social', category: 'continuous', schedule: 'Continuous', essential: false, module: 'personal' },
  // ── Personal: Daily ──────────────────────────────────────
  { id: 'health-dashboard', name: 'Health Dashboard', desc: 'Fitness/health data aggregation', category: 'daily', schedule: 'Daily refresh', essential: false, module: 'personal' },
  { id: 'finance-snapshot', name: 'Finance Snapshot', desc: 'Budgeting Beacon integration', category: 'daily', schedule: 'Daily refresh', essential: false, module: 'personal' },
  // ── Personal: Weekly ─────────────────────────────────────
  { id: 'music-discovery', name: 'Music Discovery', desc: 'Spotify integration + artist cascade', category: 'weekly', schedule: 'Weekly + on-demand', essential: false, module: 'personal' },
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
];

export const PERSONAL_MODULES = [
  { id: 'entertainment', name: 'Entertainment', desc: 'Movies, TV, wrestling with cascade scoring', icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z', href: '/personal/entertainment' },
  { id: 'books', name: 'Books', desc: 'Book ranking with author cascade', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', href: '/personal/books' },
  { id: 'music', name: 'Music', desc: 'Spotify integration + artist cascade', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3', href: '/personal/music' },
  { id: 'life', name: 'Life Manager', desc: 'Reminders, routines, family log', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z', href: '/personal/life' },
  { id: 'releases', name: 'Releases', desc: 'Streaming/theater/game new releases', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', href: '/personal/releases' },
  { id: 'quiz', name: 'Profile Quiz', desc: 'Preferences, beliefs, personality', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', href: '/personal/quiz' },
  { id: 'news', name: 'News Feed', desc: 'Multi-viewpoint news + social', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z', href: '/personal/news' },
  { id: 'health', name: 'Health', desc: 'Fitness/health data aggregation', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z', href: '/personal/health' },
  { id: 'finance', name: 'Finance', desc: 'Budgeting Beacon read-only snapshot', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', href: '/personal/finance' },
  { id: 'learning', name: 'Learning', desc: 'Knowledge backlog + weekly surfacing', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', href: '/personal/learning' },
  { id: 'dna', name: 'DNA Analyst', desc: '23andMe + genetics atlas', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z', href: '/personal/dna' },
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
  book: {
    author: { weight: 1.0, label: 'Author' },
  },
  music: {
    artist: { weight: 1.0, label: 'Artist' },
    producer: { weight: 0.7, label: 'Producer' },
    featured: { weight: 0.5, label: 'Featured' },
    songwriter: { weight: 0.4, label: 'Songwriter' },
  },
};
