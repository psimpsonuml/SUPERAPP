// Agent scheduling configuration (all times in ET)
// Agents run on defined cycles: continuous, daily, weekly, or event-driven

const schedule = {
  continuous: [
    { agentId: 'infrastructure-monitor', interval: '*/1 * * * *' },
    { agentId: 'inbox-monitor', interval: '*/5 * * * *', startHour: 5 },
  ],

  daily: [
    { agentId: 'qa-playtest', cron: '0 0 * * *', description: 'Nightly ChronoStates test cycle' },
    { agentId: 'pain-point-hunter', cron: '30 5 * * *', description: 'Morning community scan' },
    { agentId: 'community-scout', cron: '45 5 * * *', description: 'Daily Reddit community scan', options: { redditOnly: true } },
    { agentId: 'seo-aeo-writer', cron: '0 6 * * *', description: 'Generate 3 blog posts + repurposing chain' },
    { agentId: 'substack-publisher', cron: '0 7 * * *', description: 'Generate paywalled newsletter' },
    { agentId: 'social-distributor', cron: '30 7 * * *', description: 'Prepare daily social posts' },
    { agentId: 'video-producer', cron: '0 8 * * *', description: 'Daily video production pipeline' },
    { agentId: 'outreach-prospector', cron: '30 8 * * *', description: 'Lead search + email drafting' },
    { agentId: 'intelligence-analyst', cron: '0 9 * * *', description: 'Daily research briefing' },
    { agentId: 'product-intelligence', cron: '0 9 * * *', description: 'Daily feature/pricing analysis' },
    { agentId: 'ad-creative', cron: '30 9 * * *', description: 'Generate ad creatives (if scheduled)' },
  ],

  weekly: [
    { agentId: 'community-scout', cron: '0 6 * * 1', description: 'Weekly community discovery (Monday)' },
    { agentId: 'community-strategist', cron: '0 7 * * 1', description: 'Weekly calendar from rules (Monday)' },
    { agentId: 'content-library-manager', cron: '0 8 * * 1', description: 'Weekly scenario generation (Monday)' },
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
