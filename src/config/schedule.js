// Agent scheduling configuration (all times in ET)
// Agents run on defined cycles: continuous, daily, weekly, monthly, or event-driven

// ── Inbox monitor frequency ─────────────────────────────────
// Email classification defaults to weekly. Override with INBOX_MONITOR_FREQUENCY.
// Valid values: 'weekly' (default) | 'daily' | 'hourly'
const INBOX_FREQUENCIES = {
  hourly: { cron: '0 * * * *', description: 'Hourly inbox scan + classification' },
  daily: { cron: '0 6 * * *', description: 'Daily inbox scan + classification (6:00 AM)' },
  weekly: { cron: '0 6 * * 1', description: 'Weekly inbox scan + classification (Monday 6:00 AM)' },
};

const inboxFrequency = (process.env.INBOX_MONITOR_FREQUENCY || 'weekly').toLowerCase();
const inboxSchedule = INBOX_FREQUENCIES[inboxFrequency] || INBOX_FREQUENCIES.weekly;

const schedule = {
  continuous: [
    { agentId: 'infrastructure-monitor', interval: '*/1 * * * *' },
    { agentId: 'publish-dispatcher', interval: '*/10 * * * *' },
  ],

  daily: [
    { agentId: 'qa-playtest', cron: '0 0 * * *', description: 'Nightly ChronoStates test cycle' },
    { agentId: 'pain-point-hunter', cron: '30 5 * * *', description: 'Morning community scan' },
    { agentId: 'seo-aeo-writer', cron: '15 6 * * *', description: 'Generate 3 blog posts + repurposing chain' },
    { agentId: 'substack-publisher', cron: '0 7 * * *', description: 'Generate paywalled newsletter' },
    { agentId: 'social-distributor', cron: '30 7 * * *', description: 'Prepare daily social posts' },
    { agentId: 'video-producer', cron: '0 8 * * *', description: 'Daily video production pipeline' },
    { agentId: 'outreach-prospector', cron: '30 8 * * *', description: 'Lead search + email drafting' },
    { agentId: 'growth-outreach-assistant', cron: '30 7 * * 1-5', description: 'Weekday outreach drafting (business days only)' },
    { agentId: 'product-intelligence', cron: '0 9 * * *', description: 'Daily feature/pricing analysis' },
  ],

  // Frequency set by INBOX_MONITOR_FREQUENCY (weekly | daily | hourly)
  configurable: [
    {
      agentId: 'inbox-monitor',
      cron: inboxSchedule.cron,
      frequency: inboxFrequency in INBOX_FREQUENCIES ? inboxFrequency : 'weekly',
      description: inboxSchedule.description,
      envVar: 'INBOX_MONITOR_FREQUENCY',
    },
  ],

  weekly: [
    { agentId: 'intelligence-analyst', cron: '0 9 * * 2', description: 'Weekly research briefing (Tuesday)' },
    { agentId: 'growth-content-research', cron: '0 5 * * 1', description: 'Weekly Payroll Beacon topic sweep (Monday)' },
    { agentId: 'growth-content-repurposer', cron: '0 6 * * 1', description: 'Weekly content package generation (Monday)' },
    { agentId: 'growth-scheduler', cron: '0 7 * * 1', description: 'Weekly calendar slot assignment (Monday)' },
    { agentId: 'content-library-manager', cron: '0 8 * * 1', description: 'Weekly scenario generation (Monday)' },
    { agentId: 'growth-prospect-engine', cron: '0 6 * * 2', description: 'Weekly Apollo prospect import + scoring (Tuesday)' },
    { agentId: 'wrestling-scraper', cron: '0 5 * * 2', description: 'Weekly wrestling results scrape + stats (Tuesday)' },
  ],

  // Disabled per Growth OS spec §21 — paid-ad creative returns when there is
  // real ad spend and performance data to learn from. Agent code is retained
  // and still manually triggerable via /api/agents/ad-creative/trigger.
  disabled: [
    { agentId: 'ad-creative', cron: '30 9 * * 3', reason: 'No active ad spend' },
  ],

  monthly: [
    { agentId: 'community-scout', cron: '0 6 1 * *', description: 'Monthly community discovery + calendar planning (1st of month)' },
  ],

  eventDriven: [
    { agentId: 'user-lifecycle', trigger: 'supabase_webhook', description: 'Registration drips + churn win-back' },
  ],

  dailyReport: {
    cron: '0 10 * * *',
    description: 'Compile and deliver daily report',
  },
};

module.exports = schedule;
module.exports.INBOX_FREQUENCIES = INBOX_FREQUENCIES;
