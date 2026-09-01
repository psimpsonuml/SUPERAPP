// Agent Registry — maps agent IDs to their implementations

const InboxMonitorAgent = require('./inbox-monitor');
const SeoAeoWriterAgent = require('./seo-aeo-writer');
const SubstackPublisherAgent = require('./substack-publisher');
const SocialDistributorAgent = require('./social-distributor');
const VideoProducerAgent = require('./video-producer');
const ContentLibraryManagerAgent = require('./content-library-manager');
const CommunityScoutAgent = require('./community-scout');
const PainPointHunterAgent = require('./pain-point-hunter');
const QaPlaytestAgent = require('./qa-playtest');
const OutreachProspectorAgent = require('./outreach-prospector');
const IntelligenceAnalystAgent = require('./intelligence-analyst');
const AdCreativeAgent = require('./ad-creative');
const ProductIntelligenceAgent = require('./product-intelligence');
const UserLifecycleAgent = require('./user-lifecycle');
const InfrastructureMonitorAgent = require('./infrastructure-monitor');
const WrestlingScraperAgent = require('./wrestling-scraper');
const PublishDispatcherAgent = require('./publish-dispatcher');
const GrowthContentResearchAgent = require('./growth-content-research');
const GrowthContentRepurposerAgent = require('./growth-content-repurposer');
const GrowthSchedulerAgent = require('./growth-scheduler');
const GrowthProspectEngineAgent = require('./growth-prospect-engine');
const GrowthOutreachAssistantAgent = require('./growth-outreach-assistant');

const registry = {
  'inbox-monitor': {
    Agent: InboxMonitorAgent,
    name: 'Inbox Monitor',
    domain: 'Email classification & response drafting',
    cycle: 'configurable',
    essential: true,
    criticalOnFailure: true,
  },
  'seo-aeo-writer': {
    Agent: SeoAeoWriterAgent,
    name: 'SEO/AEO Writer',
    domain: 'Blog content generation',
    cycle: 'daily',
    essential: false,
    criticalOnFailure: false,
  },
  'substack-publisher': {
    Agent: SubstackPublisherAgent,
    name: 'Substack Publisher',
    domain: 'Newsletter publishing (paywalled)',
    cycle: 'daily',
    essential: false,
    criticalOnFailure: false,
  },
  'social-distributor': {
    Agent: SocialDistributorAgent,
    name: 'Social Distributor',
    domain: 'Multi-platform social posting',
    cycle: 'daily',
    essential: false,
    criticalOnFailure: false,
  },
  'video-producer': {
    Agent: VideoProducerAgent,
    name: 'Video Producer',
    domain: 'TikTok/YouTube video creation',
    cycle: 'daily',
    essential: false,
    criticalOnFailure: false,
  },
  'content-library-manager': {
    Agent: ContentLibraryManagerAgent,
    name: 'Content Library Manager',
    domain: 'ChronoStates scenario injection',
    cycle: 'weekly',
    essential: false,
    criticalOnFailure: false,
  },
  'community-scout': {
    Agent: CommunityScoutAgent,
    name: 'Community Scout',
    domain: 'Community discovery + rule-aware content calendar',
    cycle: 'monthly',
    essential: false,
    criticalOnFailure: false,
  },
  'pain-point-hunter': {
    Agent: PainPointHunterAgent,
    name: 'Pain Point Hunter',
    domain: 'Market signal detection',
    cycle: 'daily',
    essential: false,
    criticalOnFailure: false,
  },
  'qa-playtest': {
    Agent: QaPlaytestAgent,
    name: 'QA Playtest Agent',
    domain: 'ChronoStates automated testing',
    cycle: 'daily',
    essential: false,
    criticalOnFailure: true,
  },
  'outreach-prospector': {
    Agent: OutreachProspectorAgent,
    name: 'Outreach Prospector',
    domain: 'Lead gen + partnership outreach',
    cycle: 'daily',
    essential: false,
    criticalOnFailure: false,
  },
  'intelligence-analyst': {
    Agent: IntelligenceAnalystAgent,
    name: 'Intelligence Analyst',
    domain: 'Influencer/platform/publisher research',
    cycle: 'weekly',
    essential: false,
    criticalOnFailure: false,
  },
  'ad-creative': {
    Agent: AdCreativeAgent,
    name: 'Ad Creative Agent',
    domain: 'Ad creative generation',
    cycle: 'weekly',
    essential: false,
    criticalOnFailure: false,
  },
  'product-intelligence': {
    Agent: ProductIntelligenceAgent,
    name: 'Product Intelligence Agent',
    domain: 'Feature/pricing analysis',
    cycle: 'daily',
    essential: false,
    criticalOnFailure: false,
  },
  'user-lifecycle': {
    Agent: UserLifecycleAgent,
    name: 'User Lifecycle Agent',
    domain: 'Registration drips + churn win-back',
    cycle: 'event-driven',
    essential: true,
    criticalOnFailure: false,
  },
  'infrastructure-monitor': {
    Agent: InfrastructureMonitorAgent,
    name: 'Infrastructure Monitor',
    domain: 'Uptime, webhooks, API health',
    cycle: 'continuous',
    essential: true,
    criticalOnFailure: true,
  },
  'publish-dispatcher': {
    Agent: PublishDispatcherAgent,
    name: 'Publish Dispatcher',
    domain: 'Drains approved items and scheduled posts',
    cycle: 'continuous',
    essential: true,
    criticalOnFailure: true,
  },
  'growth-content-research': {
    Agent: GrowthContentResearchAgent,
    name: 'Growth Content Research',
    domain: 'Payroll Beacon topic discovery -> content sources',
    cycle: 'weekly',
    essential: false,
    criticalOnFailure: false,
  },
  'growth-content-repurposer': {
    Agent: GrowthContentRepurposerAgent,
    name: 'Growth Content Repurposer',
    domain: 'One source -> platform content package',
    cycle: 'weekly',
    essential: false,
    criticalOnFailure: false,
  },
  'growth-scheduler': {
    Agent: GrowthSchedulerAgent,
    name: 'Growth Scheduler',
    domain: 'Assigns approved content to calendar slots',
    cycle: 'weekly',
    essential: false,
    criticalOnFailure: false,
  },
  'growth-prospect-engine': {
    Agent: GrowthProspectEngineAgent,
    name: 'Growth Prospect Engine',
    domain: 'Apollo import -> dedup -> fit score',
    cycle: 'weekly',
    essential: false,
    criticalOnFailure: false,
  },
  'growth-outreach-assistant': {
    Agent: GrowthOutreachAssistantAgent,
    name: 'Growth Outreach Assistant',
    domain: 'Drafts outreach and builds the daily queue',
    cycle: 'daily',
    essential: false,
    criticalOnFailure: false,
  },
  'wrestling-scraper': {
    Agent: WrestlingScraperAgent,
    name: 'Wrestling Results Scraper',
    domain: 'Weekly wrestling results + statistics',
    cycle: 'weekly',
    essential: false,
    criticalOnFailure: false,
  },
};

function createAgent(agentId, accountId) {
  const entry = registry[agentId];
  if (!entry) {
    throw new Error(`Unknown agent: ${agentId}`);
  }
  return new entry.Agent(accountId);
}

function listAgents() {
  return Object.entries(registry).map(([id, entry]) => ({
    id,
    name: entry.name,
    domain: entry.domain,
    cycle: entry.cycle,
    essential: entry.essential,
    criticalOnFailure: entry.criticalOnFailure,
  }));
}

module.exports = { registry, createAgent, listAgents };
