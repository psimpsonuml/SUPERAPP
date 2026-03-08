// Agent Registry — maps agent IDs to their implementations

const InboxMonitorAgent = require('./inbox-monitor');
const SeoAeoWriterAgent = require('./seo-aeo-writer');
const SubstackPublisherAgent = require('./substack-publisher');
const SocialDistributorAgent = require('./social-distributor');
const VideoProducerAgent = require('./video-producer');
const ContentLibraryManagerAgent = require('./content-library-manager');
const CommunityScoutAgent = require('./community-scout');
const CommunityStrategistAgent = require('./community-strategist');
const PainPointHunterAgent = require('./pain-point-hunter');
const QaPlaytestAgent = require('./qa-playtest');
const OutreachProspectorAgent = require('./outreach-prospector');
const IntelligenceAnalystAgent = require('./intelligence-analyst');
const AdCreativeAgent = require('./ad-creative');
const ProductIntelligenceAgent = require('./product-intelligence');
const UserLifecycleAgent = require('./user-lifecycle');
const InfrastructureMonitorAgent = require('./infrastructure-monitor');

const registry = {
  'inbox-monitor': {
    Agent: InboxMonitorAgent,
    name: 'Inbox Monitor',
    domain: 'Email monitoring & response',
    cycle: 'continuous',
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
    domain: 'Group/community discovery',
    cycle: 'weekly',
    essential: false,
    criticalOnFailure: false,
  },
  'community-strategist': {
    Agent: CommunityStrategistAgent,
    name: 'Community Strategist',
    domain: 'Rule-aware content calendar',
    cycle: 'weekly',
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
    cycle: 'daily',
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
