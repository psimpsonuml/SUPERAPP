const BaseAgent = require('./base-agent');
const products = require('../config/products');
const Anthropic = require('@anthropic-ai/sdk');
const { searchOrEmpty } = require('../shared/search');

// ── Search queries per product per category ───────────────────

const INFLUENCER_QUERIES = {
  chronostates: [
    'alternate history YouTubers content creators',
    'AI gaming creators interactive fiction streamers',
    'RPG content creators worldbuilding channels YouTube',
    'vibe coding creators AI game development YouTube TikTok',
    'counterfactual history podcast creators',
  ],
  payroll_beacon: [
    'HR payroll industry influencers LinkedIn',
    'payroll compliance creators LinkedIn YouTube',
    'accounting YouTubers small business payroll',
    'SHRM speakers HR tech influencers',
    'HR tech podcasters payroll software reviews',
  ],
  budgeting_beacon: [
    'personal finance YouTubers budgeting',
    'budgeting TikTokers money management creators',
    'financial coach creators FIRE movement bloggers',
    'money management podcasters personal finance',
    'debt free journey creators budget tips',
  ],
};

const NEWSLETTER_QUERIES = {
  chronostates: [
    'alternate history newsletters subscriptions',
    'gaming newsletters sponsorship opportunities indie games',
    'interactive fiction worldbuilding newsletter community',
  ],
  payroll_beacon: [
    'HR payroll compliance newsletter sponsorship',
    'accounting industry newsletters guest contributions',
    'HR tech newsletters advertising rates sponsor',
  ],
  budgeting_beacon: [
    'personal finance newsletter sponsorship opportunities',
    'budgeting money newsletter sponsor advertising',
    'FIRE financial independence newsletter community',
  ],
};

const COMPETITOR_QUERIES_PAYROLL = [
  'payroll compliance software new features launch 2026',
  'Gusto ADP Paychex pricing changes 2026',
  'payroll software negative reviews G2 Capterra 2026',
  'payroll compliance SaaS marketing campaigns',
  'multi-state payroll software new competitors',
];

const LAUNCH_PLATFORMS = [
  {
    name: 'Product Hunt',
    url: 'https://www.producthunt.com',
    category: 'launch_platform',
    searchQuery: 'Product Hunt best launch day strategy tips 2026',
    notes: 'Best days: Tuesday-Thursday. Ship page enables pre-launch audience building.',
  },
  {
    name: 'BetaList',
    url: 'https://betalist.com',
    category: 'launch_platform',
    searchQuery: 'BetaList submission requirements cost startup listing',
    notes: 'Free submissions (review queue ~2 weeks). $129 for fast-track featured listing.',
  },
  {
    name: 'Hacker News Show HN',
    url: 'https://news.ycombinator.com/showhn.html',
    category: 'launch_platform',
    searchQuery: 'Show HN posting guidelines best practices 2026',
    notes: 'Free. Post format: "Show HN: [Title]". Must be something people can try. Best posted ~11am ET.',
  },
  {
    name: 'IndieHackers',
    url: 'https://www.indiehackers.com',
    category: 'launch_platform',
    searchQuery: 'IndieHackers community posting rules product launch',
    notes: 'Free community posts. Product section for listing. Monthly "what are you working on" threads.',
  },
  {
    name: 'AppSumo',
    url: 'https://appsumo.com',
    category: 'launch_platform',
    searchQuery: 'AppSumo partnership requirements SaaS deal listing 2026',
    notes: 'Revenue share model (typically 70/30). Must offer lifetime deal. Application process.',
  },
];

const BOOK_AGENT_QUERIES = [
  'literary agents accepting fiction queries 2026 open submissions',
  'publishers AI-friendly submission policies fiction 2026',
  'self-publishing platforms best royalties fiction 2026',
  'literary contests upcoming deadlines fiction 2026',
  'book marketing services fiction authors',
  'literary agents currently open to queries fiction speculative',
];

const REDDIT_USER_AGENT = 'BeaconOps/1.0 (Intelligence Analyst)';

class IntelligenceAnalystAgent extends BaseAgent {
  static agentId = 'intelligence-analyst';
  static agentName = 'Intelligence Analyst';

  constructor(accountId) {
    super(accountId, {
      agentId: 'intelligence-analyst',
      agentName: 'Intelligence Analyst',
      cycle: 'daily',
      defaultTier: 2,
    });

    this.categories = [
      'influencer',
      'newsletter',
      'launch_platform',
      'book_agent',
      'competitor',
    ];
  }

  async run() {
    const results = {
      totalFindings: 0,
      newFindings: 0,
      updatedFindings: 0,
      byCategory: {},
      topOpportunities: [],
    };

    for (const category of this.categories) {
      results.byCategory[category] = { found: 0, new: 0, updated: 0 };
    }

    // Load existing entries to detect duplicates
    this.existingEntries = await this.loadExistingEntries();

    // Run all research categories
    const productIds = Object.keys(products);

    // 1. Influencer research (per product)
    for (const productId of productIds) {
      const findings = await this.researchInfluencers(productId);
      await this.storeFindings(findings, 'influencer', results);
    }

    // 2. Newsletter research (per product)
    for (const productId of productIds) {
      const findings = await this.researchNewsletters(productId);
      await this.storeFindings(findings, 'newsletter', results);
    }

    // 3. SaaS launch platforms (global)
    const launchFindings = await this.researchLaunchPlatforms();
    await this.storeFindings(launchFindings, 'launch_platform', results);

    // 4. Book agents & publishers (global, focused on fiction)
    const bookFindings = await this.researchBookAgents();
    await this.storeFindings(bookFindings, 'book_agent', results);

    // 5. Competitor intelligence (Payroll Beacon only)
    if (products.payroll_beacon) {
      const competitorFindings = await this.researchCompetitors();
      await this.storeFindings(competitorFindings, 'competitor', results);
    }

    // 6. Rank top opportunities by ROI
    results.topOpportunities = await this.rankTopOpportunities();

    // 7. Submit top opportunities to approval queue for daily briefing
    if (results.topOpportunities.length > 0) {
      await this.submitForApproval({
        itemType: 'intelligence_briefing',
        tier: 3,
        contentPreview: `Daily Intelligence Briefing: ${results.totalFindings} findings, ${results.topOpportunities.length} top opportunities`,
        fullContent: {
          date: new Date().toISOString(),
          totalFindings: results.totalFindings,
          newFindings: results.newFindings,
          byCategory: results.byCategory,
          topOpportunities: results.topOpportunities.slice(0, 10),
        },
      });
    }

    return results;
  }

  // ── INFLUENCER RESEARCH ─────────────────────────────────────

  async researchInfluencers(productId) {
    const product = products[productId];
    const queries = INFLUENCER_QUERIES[productId] || [];
    const findings = [];

    for (const query of queries) {
      try {
        // Web search via Reddit for mentions of creators
        const searchResults = await this.webSearch(query);
        if (!searchResults || searchResults.length === 0) continue;

        // Use Claude to extract influencer data from search results
        const extracted = await this.extractInfluencersWithClaude(searchResults, product, productId);
        findings.push(...extracted);
      } catch (err) {
        this.logger.warn(`Influencer search failed for "${query}": ${err.message}`, {
          agentId: this.agentId,
        });
      }
    }

    return findings;
  }

  async extractInfluencersWithClaude(searchResults, product, productId) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return this.extractInfluencersByKeywords(searchResults, productId);

    const combinedText = searchResults
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet || r.text || ''}`)
      .join('\n\n')
      .slice(0, 6000);

    try {
      const client = new Anthropic();
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: `You are extracting influencer/content creator information from web search results for "${product.name}" (${product.description}).

Return ONLY a JSON array (no markdown, no code fences). Each element:
{
  "name": "<creator name>",
  "platform": "<youtube|tiktok|x|podcast|linkedin|instagram>",
  "handle": "<@handle or channel URL if found>",
  "follower_count": "<estimated number or 'unknown'>",
  "engagement_rate": "<estimated % or 'unknown'>",
  "content_style": "<brief description>",
  "sponsorship_format": "<shoutout|dedicated_video|affiliate|integration|unknown>",
  "cost_range": "<estimated range like '$500-2000' or 'unknown'>",
  "contact_info": "<email or 'not public'>",
  "relevance_score": <1-10 how relevant to ${product.name}>,
  "reasoning": "<why this creator is relevant>"
}

Only include creators you can identify with reasonable confidence. If no creators found, return [].`,
        messages: [{ role: 'user', content: `Extract content creator information from these search results:\n\n${combinedText}` }],
      });

      const text = message.content[0]?.text || '[]';
      const parsed = JSON.parse(text);

      return (Array.isArray(parsed) ? parsed : []).map(inf => ({
        name: inf.name,
        category: 'influencer',
        platform: inf.platform || 'unknown',
        product: productId,
        url: inf.handle || null,
        contact_info: inf.contact_info !== 'not public' ? inf.contact_info : null,
        relevance_score: Math.min(10, Math.max(1, parseInt(inf.relevance_score) || 5)),
        potential_reach: this.parseFollowerCount(inf.follower_count),
        cost_estimate: inf.cost_range !== 'unknown' ? inf.cost_range : null,
        estimated_cost: this.parseCostEstimate(inf.cost_range),
        details: {
          follower_count: inf.follower_count,
          engagement_rate: inf.engagement_rate,
          content_style: inf.content_style,
          sponsorship_format: inf.sponsorship_format,
          reasoning: inf.reasoning,
        },
      }));
    } catch (err) {
      this.logger.warn(`Claude influencer extraction failed: ${err.message}`, { agentId: this.agentId });
      return this.extractInfluencersByKeywords(searchResults, productId);
    }
  }

  extractInfluencersByKeywords(searchResults, productId) {
    const findings = [];
    const platformKeywords = {
      youtube: ['youtube', 'youtuber', 'channel', 'video', 'subscriber'],
      tiktok: ['tiktok', 'tiktoker'],
      podcast: ['podcast', 'episode', 'host'],
      x: ['twitter', 'tweet', 'x.com'],
      linkedin: ['linkedin', 'profile'],
    };

    for (const result of searchResults.slice(0, 5)) {
      const text = `${result.title} ${result.snippet || ''}`.toLowerCase();
      let platform = 'unknown';
      for (const [p, keywords] of Object.entries(platformKeywords)) {
        if (keywords.some(k => text.includes(k))) { platform = p; break; }
      }

      const titleWords = (result.title || '').split(/[–\-|:,]/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 40);
      const name = titleWords[0] || result.title;

      if (name) {
        findings.push({
          name: name.slice(0, 100),
          category: 'influencer',
          platform,
          product: productId,
          url: result.url || null,
          relevance_score: 5,
          potential_reach: 0,
          cost_estimate: null,
          estimated_cost: null,
          contact_info: null,
          details: { source: 'keyword_extraction', original_title: result.title },
        });
      }
    }
    return findings;
  }

  // ── NEWSLETTER RESEARCH ─────────────────────────────────────

  async researchNewsletters(productId) {
    const product = products[productId];
    const queries = NEWSLETTER_QUERIES[productId] || [];
    const findings = [];

    for (const query of queries) {
      try {
        const searchResults = await this.webSearch(query);
        if (!searchResults || searchResults.length === 0) continue;

        const extracted = await this.extractNewslettersWithClaude(searchResults, product, productId);
        findings.push(...extracted);
      } catch (err) {
        this.logger.warn(`Newsletter search failed for "${query}": ${err.message}`, {
          agentId: this.agentId,
        });
      }
    }

    return findings;
  }

  async extractNewslettersWithClaude(searchResults, product, productId) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return [];

    const combinedText = searchResults
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet || r.text || ''}`)
      .join('\n\n')
      .slice(0, 6000);

    try {
      const client = new Anthropic();
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: `You are extracting newsletter information from web search results for "${product.name}" (${product.description}).

Return ONLY a JSON array. Each element:
{
  "name": "<newsletter name>",
  "url": "<newsletter URL>",
  "subscriber_count": "<estimated number or 'unknown'>",
  "topic_focus": "<brief description>",
  "sponsorship_rates": "<rates if found or 'unknown'>",
  "submission_process": "<how to submit/sponsor or 'unknown'>",
  "contact_info": "<email or 'not public'>",
  "relevance_score": <1-10>
}

Only include real newsletters. If none found, return [].`,
        messages: [{ role: 'user', content: `Extract newsletter sponsorship opportunities:\n\n${combinedText}` }],
      });

      const text = message.content[0]?.text || '[]';
      const parsed = JSON.parse(text);

      return (Array.isArray(parsed) ? parsed : []).map(nl => ({
        name: nl.name,
        category: 'newsletter',
        platform: 'email',
        product: productId,
        url: nl.url || null,
        contact_info: nl.contact_info !== 'not public' ? nl.contact_info : null,
        relevance_score: Math.min(10, Math.max(1, parseInt(nl.relevance_score) || 5)),
        potential_reach: this.parseFollowerCount(nl.subscriber_count),
        cost_estimate: nl.sponsorship_rates !== 'unknown' ? nl.sponsorship_rates : null,
        estimated_cost: this.parseCostEstimate(nl.sponsorship_rates),
        details: {
          subscriber_count: nl.subscriber_count,
          topic_focus: nl.topic_focus,
          submission_process: nl.submission_process,
        },
      }));
    } catch (err) {
      this.logger.warn(`Claude newsletter extraction failed: ${err.message}`, { agentId: this.agentId });
      return [];
    }
  }

  // ── LAUNCH PLATFORM RESEARCH ────────────────────────────────

  async researchLaunchPlatforms() {
    const findings = [];

    for (const platform of LAUNCH_PLATFORMS) {
      try {
        const searchResults = await this.webSearch(platform.searchQuery);
        let details = { notes: platform.notes };

        if (process.env.ANTHROPIC_API_KEY && searchResults && searchResults.length > 0) {
          const extracted = await this.extractPlatformDetailsWithClaude(searchResults, platform);
          details = { ...details, ...extracted };
        }

        findings.push({
          name: platform.name,
          category: 'launch_platform',
          platform: 'web',
          product: null,
          url: platform.url,
          relevance_score: 7,
          potential_reach: 0,
          cost_estimate: details.cost || null,
          estimated_cost: this.parseCostEstimate(details.cost),
          contact_info: null,
          details,
        });
      } catch (err) {
        this.logger.warn(`Launch platform research failed for ${platform.name}: ${err.message}`, {
          agentId: this.agentId,
        });
      }
    }

    return findings;
  }

  async extractPlatformDetailsWithClaude(searchResults, platform) {
    try {
      const combinedText = searchResults
        .map(r => `${r.title}: ${r.snippet || ''}`)
        .join('\n')
        .slice(0, 3000);

      const client = new Anthropic();
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: `Extract current information about ${platform.name} for SaaS/product launches. Return JSON only (no markdown, no code fences):
{
  "best_launch_strategy": "<brief advice>",
  "requirements": "<submission requirements>",
  "cost": "<any costs involved>",
  "upcoming_events": "<any upcoming promo windows or events>",
  "tips": "<latest tips for success>"
}`,
        messages: [{ role: 'user', content: combinedText }],
      });

      return JSON.parse(message.content[0]?.text || '{}');
    } catch {
      return {};
    }
  }

  // ── BOOK AGENTS & PUBLISHERS RESEARCH ───────────────────────

  async researchBookAgents() {
    const findings = [];

    for (const query of BOOK_AGENT_QUERIES) {
      try {
        const searchResults = await this.webSearch(query);
        if (!searchResults || searchResults.length === 0) continue;

        const extracted = await this.extractBookAgentsWithClaude(searchResults);
        findings.push(...extracted);
      } catch (err) {
        this.logger.warn(`Book agent search failed for "${query}": ${err.message}`, {
          agentId: this.agentId,
        });
      }
    }

    return findings;
  }

  async extractBookAgentsWithClaude(searchResults) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return [];

    const combinedText = searchResults
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet || r.text || ''}`)
      .join('\n\n')
      .slice(0, 6000);

    try {
      const client = new Anthropic();
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: `You are extracting literary agent, publisher, contest, and book marketing information from search results.

Return ONLY a JSON array (no markdown, no code fences). Each element:
{
  "name": "<agent/publisher/contest/service name>",
  "type": "<literary_agent|publisher|contest|self_publishing|marketing_service>",
  "url": "<website URL>",
  "accepting_queries": <true|false|null>,
  "genres_accepted": "<genres they accept>",
  "ai_friendly": <true|false|null>,
  "deadline": "<submission deadline if applicable or null>",
  "cost": "<any costs or 'free'>",
  "contact_info": "<submission email or query process>",
  "notes": "<relevant details>"
}

Focus on agents currently open to queries and fiction-friendly. If none found, return [].`,
        messages: [{ role: 'user', content: `Extract book agent/publisher/contest information:\n\n${combinedText}` }],
      });

      const text = message.content[0]?.text || '[]';
      const parsed = JSON.parse(text);

      return (Array.isArray(parsed) ? parsed : []).map(ba => ({
        name: ba.name,
        category: 'book_agent',
        platform: ba.type || 'literary_agent',
        product: 'chronostates',
        url: ba.url || null,
        contact_info: ba.contact_info || null,
        relevance_score: ba.accepting_queries ? 8 : 5,
        potential_reach: 0,
        cost_estimate: ba.cost !== 'free' ? ba.cost : null,
        estimated_cost: this.parseCostEstimate(ba.cost),
        details: {
          type: ba.type,
          accepting_queries: ba.accepting_queries,
          genres_accepted: ba.genres_accepted,
          ai_friendly: ba.ai_friendly,
          deadline: ba.deadline,
          notes: ba.notes,
        },
      }));
    } catch (err) {
      this.logger.warn(`Claude book agent extraction failed: ${err.message}`, { agentId: this.agentId });
      return [];
    }
  }

  // ── COMPETITOR INTELLIGENCE (Payroll Beacon only) ───────────

  async researchCompetitors() {
    const findings = [];

    for (const query of COMPETITOR_QUERIES_PAYROLL) {
      try {
        const searchResults = await this.webSearch(query);
        if (!searchResults || searchResults.length === 0) continue;

        const extracted = await this.extractCompetitorIntelWithClaude(searchResults);
        findings.push(...extracted);
      } catch (err) {
        this.logger.warn(`Competitor search failed for "${query}": ${err.message}`, {
          agentId: this.agentId,
        });
      }
    }

    return findings;
  }

  async extractCompetitorIntelWithClaude(searchResults) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return this.extractCompetitorsByKeywords(searchResults);

    const combinedText = searchResults
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet || r.text || ''}`)
      .join('\n\n')
      .slice(0, 6000);

    try {
      const client = new Anthropic();
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: `You are analyzing payroll compliance competitor intelligence for Payroll Beacon (B2B payroll compliance SaaS).

Extract actionable competitive intelligence. Return ONLY a JSON array (no markdown, no code fences):
{
  "competitor_name": "<company name>",
  "intel_type": "<product_launch|pricing_change|negative_review|marketing_campaign|feature_update|blog_post|social_activity>",
  "summary": "<2-3 sentence summary of the finding>",
  "source_url": "<URL if available>",
  "actionable": <true|false>,
  "action_suggestion": "<what Payroll Beacon should do in response>",
  "urgency": "<low|medium|high>"
}

Only include findings from the last 30 days if possible. If none found, return [].`,
        messages: [{ role: 'user', content: `Extract competitor intelligence:\n\n${combinedText}` }],
      });

      const text = message.content[0]?.text || '[]';
      const parsed = JSON.parse(text);

      return (Array.isArray(parsed) ? parsed : []).map(ci => ({
        name: `${ci.competitor_name}: ${ci.intel_type}`,
        category: 'competitor',
        platform: 'web',
        product: 'payroll_beacon',
        url: ci.source_url || null,
        relevance_score: ci.actionable ? 8 : 5,
        potential_reach: 0,
        cost_estimate: null,
        estimated_cost: null,
        contact_info: null,
        details: {
          competitor_name: ci.competitor_name,
          intel_type: ci.intel_type,
          summary: ci.summary,
          actionable: ci.actionable,
          action_suggestion: ci.action_suggestion,
          urgency: ci.urgency,
        },
      }));
    } catch (err) {
      this.logger.warn(`Claude competitor extraction failed: ${err.message}`, { agentId: this.agentId });
      return this.extractCompetitorsByKeywords(searchResults);
    }
  }

  extractCompetitorsByKeywords(searchResults) {
    const competitors = ['gusto', 'adp', 'paychex', 'rippling', 'paylocity', 'paycor', 'onpay', 'justworks'];
    const findings = [];

    for (const result of searchResults.slice(0, 10)) {
      const text = `${result.title} ${result.snippet || ''}`.toLowerCase();
      const matchedCompetitor = competitors.find(c => text.includes(c));

      if (matchedCompetitor) {
        findings.push({
          name: `${matchedCompetitor}: web mention`,
          category: 'competitor',
          platform: 'web',
          product: 'payroll_beacon',
          url: result.url || null,
          relevance_score: 5,
          potential_reach: 0,
          cost_estimate: null,
          estimated_cost: null,
          contact_info: null,
          details: {
            competitor_name: matchedCompetitor,
            intel_type: 'web_mention',
            summary: (result.snippet || result.title || '').slice(0, 500),
            source: 'keyword_extraction',
          },
        });
      }
    }

    return findings;
  }

  // ── WEB SEARCH ─────────────────────────────────────────────
  // Real web search via src/shared/search.js. This previously queried
  // reddit.com/search.json and labelled the results "web research",
  // so influencer rates, newsletter sponsorships, book agents and
  // competitor intel were all being extracted from Reddit post text.

  async webSearch(query) {
    return searchOrEmpty(query, { limit: 10 }, this.logger);
  }

  // ── STORAGE & DEDUPLICATION ────────────────────────────────

  async loadExistingEntries() {
    try {
      const { data } = await this.supabase
        .from('intelligence_log')
        .select('id, name, category, product, status, date_found')
        .eq('account_id', this.accountId);

      const map = new Map();
      for (const entry of (data || [])) {
        const key = `${entry.name}::${entry.category}::${entry.product || ''}`.toLowerCase();
        map.set(key, entry);
      }
      return map;
    } catch {
      return new Map();
    }
  }

  async storeFindings(findings, category, results) {
    for (const finding of findings) {
      const key = `${finding.name}::${finding.category}::${finding.product || ''}`.toLowerCase();
      const existing = this.existingEntries.get(key);

      try {
        if (existing) {
          // Update existing — don't resurface completed/passed items
          if (existing.status === 'completed' || existing.status === 'passed') {
            continue;
          }

          await this.supabase
            .from('intelligence_log')
            .update({
              details: finding.details,
              relevance_score: finding.relevance_score,
              estimated_cost: finding.estimated_cost,
              cost_estimate: finding.cost_estimate,
              potential_reach: finding.potential_reach,
              contact_info: finding.contact_info,
              url: finding.url,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          results.updatedFindings++;
          results.byCategory[category].updated++;
        } else {
          // Insert new entry
          await this.supabase.from('intelligence_log').insert({
            account_id: this.accountId,
            intel_type: finding.category,
            category: finding.category,
            name: finding.name,
            platform: finding.platform || null,
            product: finding.product || null,
            details: finding.details || {},
            relevance_score: finding.relevance_score || 5,
            potential_reach: finding.potential_reach || 0,
            estimated_cost: finding.estimated_cost || null,
            cost_estimate: finding.cost_estimate || null,
            roi_estimate: finding.roi_estimate || null,
            contact_info: finding.contact_info || null,
            url: finding.url || null,
            status: 'discovered',
            date_found: new Date().toISOString(),
          });

          results.newFindings++;
          results.byCategory[category].new++;

          // Prevent re-insertion within same run
          this.existingEntries.set(key, { name: finding.name, category, product: finding.product, status: 'discovered' });
        }

        results.totalFindings++;
        results.byCategory[category].found++;
      } catch (err) {
        this.logger.warn(`Failed to store intelligence finding "${finding.name}": ${err.message}`, {
          agentId: this.agentId,
        });
      }
    }
  }

  // ── ROI RANKING ───────────────────────────────────────────

  async rankTopOpportunities() {
    try {
      const { data } = await this.supabase
        .from('intelligence_log')
        .select('*')
        .eq('account_id', this.accountId)
        .in('status', ['discovered', 'new'])
        .order('date_found', { ascending: false })
        .limit(200);

      if (!data || data.length === 0) return [];

      // ROI formula: (potential_reach * relevance_score) / max(estimated_cost, 1)
      const scored = data.map(entry => {
        const reach = entry.potential_reach || 1;
        const relevance = entry.relevance_score || 5;
        const cost = Math.max(entry.estimated_cost || 1, 1);
        const roiScore = (reach * relevance) / cost;

        return { ...entry, roiScore };
      });

      scored.sort((a, b) => b.roiScore - a.roiScore);

      return scored.slice(0, 10).map(entry => ({
        id: entry.id,
        name: entry.name,
        category: entry.category,
        product: entry.product,
        platform: entry.platform,
        relevance_score: entry.relevance_score,
        potential_reach: entry.potential_reach,
        estimated_cost: entry.estimated_cost,
        cost_estimate: entry.cost_estimate,
        roiScore: Math.round(entry.roiScore * 100) / 100,
        url: entry.url,
        contact_info: entry.contact_info,
        details: entry.details,
        date_found: entry.date_found,
        status: entry.status,
      }));
    } catch (err) {
      this.logger.warn(`ROI ranking failed: ${err.message}`, { agentId: this.agentId });
      return [];
    }
  }

  // ── UTILITY HELPERS ────────────────────────────────────────

  parseFollowerCount(str) {
    if (!str || str === 'unknown') return 0;
    const cleaned = String(str).toLowerCase().replace(/,/g, '');

    const millionMatch = cleaned.match(/([\d.]+)\s*m/);
    if (millionMatch) return Math.round(parseFloat(millionMatch[1]) * 1_000_000);

    const kMatch = cleaned.match(/([\d.]+)\s*k/);
    if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1_000);

    const numMatch = cleaned.match(/(\d+)/);
    if (numMatch) return parseInt(numMatch[1]);

    return 0;
  }

  parseCostEstimate(str) {
    if (!str || str === 'unknown' || str === 'free') return null;
    const cleaned = String(str).replace(/[,$]/g, '');

    // Take the midpoint of ranges like "$500-2000"
    const rangeMatch = cleaned.match(/(\d+)\s*[-–to]+\s*(\d+)/);
    if (rangeMatch) {
      return Math.round((parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2);
    }

    const numMatch = cleaned.match(/(\d+)/);
    if (numMatch) return parseInt(numMatch[1]);

    return null;
  }
}

module.exports = IntelligenceAnalystAgent;
