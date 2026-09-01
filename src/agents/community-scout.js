const https = require('https');
const BaseAgent = require('./base-agent');
const products = require('../config/products');

// ── Keyword sets per product ───────────────────────────────
const PRODUCT_KEYWORDS = {
  chronostates: [
    'AI tools', 'AI gaming', 'creative writing', 'vibe coding',
    'RPG', 'MMORPG', 'interactive fiction', 'text adventure',
    'GPT', 'ChatGPT', 'Claude AI', 'AI storytelling',
    'AI dungeon', 'choose your own adventure', 'narrative games',
    'procedural generation', 'AI art', 'indie games', 'solo RPG',
    'tabletop RPG', 'AI worldbuilding',
  ],
  payroll_beacon: [
    'employee benefits', 'benefits administration', 'expense management',
    'expense reporting', 'equity compensation', 'stock options', 'RSU',
    'timecards', 'time tracking', 'time and attendance',
    'workforce management', 'HRIS', 'PEO', 'earned wage access',
  ],
  budgeting_beacon: [
    'personal finance', 'budgeting', 'money management', 'debt payoff',
    'financial planning', 'YNAB alternative', 'couples finance',
    'FIRE movement', 'frugal living', 'financial independence',
  ],
};

// Platforms to search
const PLATFORMS = ['reddit', 'facebook', 'discord', 'linkedin', 'slack'];

// Google search site: prefixes for non-Reddit platforms
const SITE_PREFIXES = {
  facebook: 'site:facebook.com/groups',
  discord: 'site:discord.gg OR site:discord.com/invite',
  linkedin: 'site:linkedin.com/groups',
  slack: 'site:slack.com OR site:join.slack.com',
};

class CommunityScoutAgent extends BaseAgent {
  static agentId = 'community-scout';
  static agentName = 'Community Scout';

  constructor(accountId) {
    super(accountId, {
      agentId: 'community-scout',
      agentName: 'Community Scout',
      cycle: 'monthly',
      defaultTier: 2,
    });
  }

  // ── Main run — accepts options for partial runs ────────
  async run(options = {}) {
    const { redditOnly = false } = options;
    const results = {
      communitiesDiscovered: 0,
      updated: 0,
      byProduct: {},
      byPlatform: {},
      communitiesAnalyzed: 0,
      calendarEntriesCreated: 0,
      flaggedForReview: 0,
      warmupScheduled: 0,
    };
    const platformsToScan = redditOnly ? ['reddit'] : PLATFORMS;

    for (const productId of Object.keys(PRODUCT_KEYWORDS)) {
      const keywords = PRODUCT_KEYWORDS[productId];
      results.byProduct[productId] = 0;

      for (const platform of platformsToScan) {
        try {
          const communities = platform === 'reddit'
            ? await this.searchReddit(keywords, productId)
            : await this.searchWebForCommunities(platform, keywords, productId);

          for (const community of communities) {
            const stored = await this.upsertCommunity(community, platform, productId);
            if (stored === 'new') {
              results.communitiesDiscovered++;
              results.byProduct[productId]++;
              results.byPlatform[platform] = (results.byPlatform[platform] || 0) + 1;
            } else if (stored === 'updated') {
              results.updated++;
            }
          }
        } catch (err) {
          this.logger.warn(`Failed to search ${platform} for ${productId}`, {
            error: err.message,
            agentId: this.agentId,
          });
        }
      }
    }

    // Phase 2: parse rules and build next week's content calendar.
    // Runs every cycle — existing communities need their calendar regenerated
    // even when discovery turns up nothing new.
    try {
      const planning = await this.runPlanningPhase();
      results.communitiesAnalyzed = planning.communitiesAnalyzed;
      results.calendarEntriesCreated = planning.calendarEntriesCreated;
      results.flaggedForReview = planning.flaggedForReview;
      results.warmupScheduled = planning.warmupScheduled;
      this.itemsProduced = planning.calendarEntriesCreated;
    } catch (err) {
      this.logger.warn('Planning phase failed', { error: err.message, agentId: this.agentId });
      this.errors.push({ message: `Planning phase: ${err.message}` });
    }

    return results;
  }

  // ── Reddit: subreddit search via public JSON API ───────
  async searchReddit(keywords, productId) {
    const communities = [];
    const seen = new Set();

    // Search with batched keyword queries
    const batches = this.batchKeywords(keywords, 3);

    for (const batch of batches) {
      const query = batch.join(' OR ');
      try {
        const data = await this.fetchJson(
          `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(query)}&limit=10&sort=relevance`,
          { 'User-Agent': 'BeaconOps/2.0 Community Scout' }
        );

        for (const child of (data?.data?.children || [])) {
          const sub = child.data;
          if (!sub || seen.has(sub.display_name_prefixed)) continue;
          seen.add(sub.display_name_prefixed);

          // Fetch additional stats
          let postsPerDay = 0;
          let activeUsers = sub.accounts_active || sub.active_user_count || 0;
          try {
            const about = await this.fetchJson(
              `https://www.reddit.com/r/${sub.display_name}/about.json`,
              { 'User-Agent': 'BeaconOps/2.0 Community Scout' }
            );
            activeUsers = about?.data?.accounts_active || activeUsers;
          } catch (e) { /* optional */ }

          // Estimate posts per day from hot listing
          try {
            const hot = await this.fetchJson(
              `https://www.reddit.com/r/${sub.display_name}/hot.json?limit=25`,
              { 'User-Agent': 'BeaconOps/2.0 Community Scout' }
            );
            const posts = hot?.data?.children || [];
            if (posts.length > 1) {
              const newest = posts[0]?.data?.created_utc || 0;
              const oldest = posts[posts.length - 1]?.data?.created_utc || 0;
              const daySpan = Math.max(1, (newest - oldest) / 86400);
              postsPerDay = Math.round((posts.length / daySpan) * 10) / 10;
            }
          } catch (e) { /* optional */ }

          communities.push({
            name: sub.display_name_prefixed,
            url: `https://reddit.com/${sub.display_name_prefixed}`,
            description: (sub.public_description || sub.description || '').slice(0, 1000),
            subscriber_count: sub.subscribers || 0,
            active_users: activeUsers,
            posts_per_day: postsPerDay,
            rules_json: {},
            rule_friendliness: this.assessRedditRuleFriendliness(sub),
          });
        }

        // Rate limit: Reddit allows ~60 req/min for public JSON
        await this.sleep(1200);
      } catch (err) {
        this.logger.debug(`Reddit search batch failed: ${err.message}`, { agentId: this.agentId });
      }
    }

    // Fetch rules for top communities
    for (const comm of communities.slice(0, 15)) {
      try {
        const subName = comm.name.replace('r/', '');
        const rulesData = await this.fetchJson(
          `https://www.reddit.com/r/${subName}/about/rules.json`,
          { 'User-Agent': 'BeaconOps/2.0 Community Scout' }
        );
        const rules = (rulesData?.rules || []).map(r => ({
          title: r.short_name,
          description: (r.description || '').slice(0, 500),
        }));
        comm.rules_json = { rules };
        comm.rule_friendliness = this.classifyRules(rules);
        await this.sleep(1000);
      } catch (e) { /* optional */ }
    }

    return this.scoreAndRank(communities, productId);
  }

  // ── Web search for Facebook/Discord/LinkedIn/Slack ─────
  async searchWebForCommunities(platform, keywords, productId) {
    const communities = [];
    const sitePrefix = SITE_PREFIXES[platform];
    if (!sitePrefix) return [];

    // Take top 5 keywords to avoid excessive searches
    const searchKeywords = keywords.slice(0, 5);

    for (const keyword of searchKeywords) {
      const query = `${sitePrefix} ${keyword}`;
      try {
        const searchResults = await this.googleSearch(query);

        for (const result of searchResults) {
          communities.push({
            name: result.title || keyword,
            url: result.url,
            description: result.snippet || '',
            subscriber_count: this.estimateSizeFromSnippet(result.snippet),
            active_users: null,
            posts_per_day: null,
            rules_json: {},
            rule_friendliness: 'unknown',
          });
        }

        await this.sleep(2000); // Be polite to search
      } catch (err) {
        this.logger.debug(`Web search failed for ${platform}/${keyword}: ${err.message}`, {
          agentId: this.agentId,
        });
      }
    }

    // Deduplicate by URL
    const seen = new Set();
    const deduped = communities.filter(c => {
      if (!c.url || seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    });

    return this.scoreAndRank(deduped, productId);
  }

  // ── Google custom search (uses Programmable Search Engine) ──
  async googleSearch(query) {
    // Use Google Custom Search API if available, else fallback to DuckDuckGo HTML
    const googleKey = process.env.GOOGLE_SEARCH_API_KEY;
    const googleCx = process.env.GOOGLE_SEARCH_CX;

    if (googleKey && googleCx) {
      const url = `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(query)}&num=10`;
      const data = await this.fetchJson(url);
      return (data?.items || []).map(item => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
      }));
    }

    // Fallback: DuckDuckGo lite (HTML scraping avoided — use API endpoint)
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`;
      const data = await this.fetchJson(url);
      const results = [];
      for (const topic of (data?.RelatedTopics || [])) {
        if (topic.FirstURL) {
          results.push({
            title: topic.Text?.slice(0, 100) || '',
            url: topic.FirstURL,
            snippet: topic.Text || '',
          });
        }
      }
      return results;
    } catch (e) {
      return [];
    }
  }

  // ── Scoring ────────────────────────────────────────────
  scoreAndRank(communities, productId) {
    const keywords = PRODUCT_KEYWORDS[productId] || [];

    return communities.map(c => {
      // Size score (0-10)
      const subs = c.subscriber_count || 0;
      const sizeScore = subs >= 1000000 ? 10
        : subs >= 500000 ? 9
        : subs >= 100000 ? 8
        : subs >= 50000 ? 7
        : subs >= 10000 ? 6
        : subs >= 5000 ? 5
        : subs >= 1000 ? 4
        : subs >= 500 ? 3
        : subs >= 100 ? 2
        : 1;

      // Activity score (0-10)
      const ppd = c.posts_per_day || 0;
      const activityScore = ppd >= 100 ? 10
        : ppd >= 50 ? 9
        : ppd >= 20 ? 8
        : ppd >= 10 ? 7
        : ppd >= 5 ? 6
        : ppd >= 2 ? 5
        : ppd >= 1 ? 4
        : ppd >= 0.5 ? 3
        : ppd > 0 ? 2
        : 1;

      // Relevance score (0-10) — keyword matches in name + description
      const text = `${c.name} ${c.description}`.toLowerCase();
      const matches = keywords.filter(kw => text.includes(kw.toLowerCase())).length;
      const relevanceScore = Math.min(10, Math.round((matches / Math.max(1, keywords.length)) * 20));

      // Rule friendliness bonus/penalty
      const ruleBonus = c.rule_friendliness === 'promotion_friendly' ? 1
        : c.rule_friendliness === 'limited_promotion' ? 0
        : c.rule_friendliness === 'no_marketing' ? -1
        : 0;

      // Weighted overall: relevance 40%, size 25%, activity 25%, rules 10%
      const rawOverall = (relevanceScore * 0.4) + (sizeScore * 0.25) + (activityScore * 0.25) + ((5 + ruleBonus) * 0.1);
      const overallScore = Math.min(10, Math.round(rawOverall * 10) / 10);

      return {
        ...c,
        activity_score: activityScore,
        relevance_score: relevanceScore,
        overall_score: overallScore,
      };
    }).sort((a, b) => b.overall_score - a.overall_score);
  }

  // ── Upsert community into Supabase ─────────────────────
  async upsertCommunity(community, platform, productId) {
    const { data: existing } = await this.supabase
      .from('community_profiles')
      .select('id')
      .eq('account_id', this.accountId)
      .eq('platform', platform)
      .eq('name', community.name)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update scores and stats
      await this.supabase
        .from('community_profiles')
        .update({
          subscriber_count: community.subscriber_count,
          active_users: community.active_users,
          posts_per_day: community.posts_per_day,
          activity_score: community.activity_score,
          relevance_score: community.relevance_score,
          overall_score: community.overall_score,
          rules_json: community.rules_json,
          rule_friendliness: community.rule_friendliness,
          last_scanned: new Date().toISOString(),
        })
        .eq('id', existing[0].id);
      return 'updated';
    }

    await this.supabase.from('community_profiles').insert({
      account_id: this.accountId,
      platform,
      name: community.name,
      url: community.url,
      description: (community.description || '').slice(0, 1000),
      subscriber_count: community.subscriber_count,
      active_users: community.active_users,
      posts_per_day: community.posts_per_day,
      activity_score: community.activity_score,
      relevance_score: community.relevance_score,
      overall_score: community.overall_score,
      product: productId,
      rules_json: community.rules_json || {},
      classification: 'discovered',
      rule_friendliness: community.rule_friendliness || 'unknown',
      last_scanned: new Date().toISOString(),
    });
    return 'new';
  }

  // ── Phase 2: rule parsing + content calendar generation ─
  async runPlanningPhase() {
    const CommunityPlanner = require('./community-planner');
    const planner = new CommunityPlanner({
      accountId: this.accountId,
      supabase: this.supabase,
      logger: this.logger,
    });

    this.logger.info('Starting planning phase: rule parsing and content calendar', {
      agentId: this.agentId,
    });

    return planner.plan();
  }

  // ── Reddit rule assessment helpers ─────────────────────
  assessRedditRuleFriendliness(subredditData) {
    const desc = (subredditData.public_description || subredditData.description || '').toLowerCase();
    if (desc.includes('no self-promotion') || desc.includes('no marketing') || desc.includes('no advertising')) {
      return 'no_marketing';
    }
    if (desc.includes('self-promotion allowed') || desc.includes('share your')) {
      return 'promotion_friendly';
    }
    return 'unknown';
  }

  classifyRules(rules) {
    const allText = rules.map(r => `${r.title} ${r.description}`).join(' ').toLowerCase();
    if (allText.includes('no self-promotion') || allText.includes('no advertising') ||
        allText.includes('no spam') && allText.includes('no promotion')) {
      return 'no_marketing';
    }
    if (allText.includes('self-promotion thread') || allText.includes('weekly promotion') ||
        allText.includes('share your project') || allText.includes('10% rule')) {
      return 'limited_promotion';
    }
    if (allText.includes('share your') || allText.includes('self-promotion allowed')) {
      return 'promotion_friendly';
    }
    return 'unknown';
  }

  estimateSizeFromSnippet(snippet) {
    if (!snippet) return null;
    // Try to extract member counts from search snippets
    const match = snippet.match(/([\d,]+)\s*(members?|people|followers?)/i);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
    return null;
  }

  // ── HTTP helper ────────────────────────────────────────
  fetchJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...headers,
        },
        timeout: 10000,
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Invalid JSON from ${parsedUrl.hostname}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      req.end();
    });
  }

  batchKeywords(keywords, batchSize) {
    const batches = [];
    for (let i = 0; i < keywords.length; i += batchSize) {
      batches.push(keywords.slice(i, i + batchSize));
    }
    return batches;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CommunityScoutAgent;
