const https = require('https');
const Anthropic = require('@anthropic-ai/sdk');
const BaseAgent = require('./base-agent');
const products = require('../config/products');

// ── Target Reddit communities ────────────────────────────
const BUILDER_SUBREDDITS = [
  'SideProject', 'indiehackers', 'microsaas', 'startups',
  'EntrepreneurRideAlong', 'SaaS', 'buildinpublic', 'launchit',
  'RoastMyStartup', 'AlphaAndBetaUsers', 'IMadeThis',
  'webdev', 'selfhosted', 'ProductHunt',
];

// ── X/Twitter monitoring phrases ─────────────────────────
const X_HASHTAGS = [
  '#buildinpublic', '#indiehackers', '#microsaas', '#shipIt',
];
const X_PHRASES = [
  'what are you building', 'build in public', 'launched today',
  'side project', 'indie maker', 'shipping update',
];

// ── Other platforms ──────────────────────────────────────
const OTHER_SOURCES = [
  { name: 'Product Hunt', url: 'https://www.producthunt.com' },
  { name: 'IndieHackers', url: 'https://www.indiehackers.com' },
  { name: 'Hacker News Show HN', url: 'https://news.ycombinator.com' },
];

// ── Community post format expectations ───────────────────
const COMMUNITY_FORMATS = {
  SideProject: { style: 'demo', desc: 'Show what you built with a demo/screenshots and ask for feedback' },
  indiehackers: { style: 'story', desc: 'Share your journey, metrics, lessons learned — build-in-public style' },
  microsaas: { style: 'metrics', desc: 'Lead with MRR/user numbers, tech stack, growth strategy' },
  startups: { style: 'insight', desc: 'Share a specific insight or lesson from building, not just a launch post' },
  EntrepreneurRideAlong: { style: 'story', desc: 'Detailed narrative of building process, challenges, wins' },
  SaaS: { style: 'metrics', desc: 'Data-driven: pricing strategy, churn metrics, acquisition channels' },
  buildinpublic: { style: 'update', desc: 'Weekly update format: what shipped, what\'s next, ask for input' },
  launchit: { style: 'launch', desc: 'Launch announcement: what it does, who it\'s for, link' },
  RoastMyStartup: { style: 'feedback', desc: 'Present your product honestly, explicitly ask for harsh feedback' },
  AlphaAndBetaUsers: { style: 'beta', desc: 'Describe stage, what testers will get, feedback needed' },
  IMadeThis: { style: 'demo', desc: 'Show what you made with a brief description of how and why' },
  webdev: { style: 'technical', desc: 'Focus on technical implementation, stack choices, open source aspects' },
  selfhosted: { style: 'technical', desc: 'Self-hosting angle: how to deploy, Docker support, privacy focus' },
  ProductHunt: { style: 'launch', desc: 'Polish launch copy: tagline, features, maker story' },
};

// ── Product descriptions for Claude ──────────────────────
const PRODUCT_BRIEFS = {
  chronostates: {
    name: 'ChronoStates.io',
    description: 'AI-powered interactive narrative platform — choose-your-own-adventure meets AI storytelling with procedural worldbuilding',
    stage: 'early access',
    angles: ['AI gaming', 'interactive fiction', 'procedural generation', 'narrative AI'],
  },
  payroll_beacon: {
    name: 'Payroll Beacon',
    description: 'Multi-state payroll compliance SaaS that keeps small businesses audit-proof with automated tax filing',
    stage: 'live',
    angles: ['HR tech', 'compliance automation', 'multi-state payroll', 'small business'],
  },
  budgeting_beacon: {
    name: 'Budgeting Beacon',
    description: 'Personal finance app for couples and individuals — budget tracking, debt payoff planning, FIRE calculators',
    stage: 'live',
    angles: ['personal finance', 'budgeting app', 'couples finance', 'FIRE movement'],
  },
};

// ── Weekly rotation schedule ─────────────────────────────
// Each product hits different communities on different days
const PROMO_ROTATION = [
  // Monday
  { day: 1, product: 'chronostates', subreddit: 'SideProject' },
  { day: 1, product: 'payroll_beacon', subreddit: 'SaaS' },
  { day: 1, product: 'budgeting_beacon', subreddit: 'indiehackers' },
  // Tuesday
  { day: 2, product: 'chronostates', subreddit: 'buildinpublic' },
  { day: 2, product: 'payroll_beacon', subreddit: 'microsaas' },
  { day: 2, product: 'budgeting_beacon', subreddit: 'startups' },
  // Wednesday
  { day: 3, product: 'chronostates', subreddit: 'IMadeThis' },
  { day: 3, product: 'payroll_beacon', subreddit: 'EntrepreneurRideAlong' },
  { day: 3, product: 'budgeting_beacon', subreddit: 'SideProject' },
  // Thursday
  { day: 4, product: 'chronostates', subreddit: 'webdev' },
  { day: 4, product: 'payroll_beacon', subreddit: 'startups' },
  { day: 4, product: 'budgeting_beacon', subreddit: 'microsaas' },
  // Friday
  { day: 5, product: 'chronostates', subreddit: 'indiehackers' },
  { day: 5, product: 'payroll_beacon', subreddit: 'AlphaAndBetaUsers' },
  { day: 5, product: 'budgeting_beacon', subreddit: 'buildinpublic' },
  // Saturday
  { day: 6, product: 'chronostates', subreddit: 'selfhosted' },
  { day: 6, product: 'budgeting_beacon', subreddit: 'EntrepreneurRideAlong' },
  // Sunday
  { day: 0, product: 'chronostates', subreddit: 'RoastMyStartup' },
  { day: 0, product: 'payroll_beacon', subreddit: 'launchit' },
];

class BuilderCommunityAgent extends BaseAgent {
  static agentId = 'builder-community';
  static agentName = 'Builder Community';

  constructor(accountId) {
    super(accountId, {
      agentId: 'builder-community',
      agentName: 'Builder Community',
      cycle: 'daily',
      defaultTier: 2,
    });
    this.anthropic = new Anthropic();
  }

  // ── Main run ───────────────────────────────────────────
  async run() {
    const results = {
      intelGathered: 0,
      promoScheduled: 0,
      xPostsQueued: 0,
      byType: {},
    };

    // Function 1: Builder Intelligence
    await this.gatherIntelligence(results);

    // Function 2: Promotional Posting
    await this.schedulePromos(results);

    return results;
  }

  // ══════════════════════════════════════════════════════
  // FUNCTION 1: Builder Intelligence
  // ══════════════════════════════════════════════════════

  async gatherIntelligence(results) {
    // Scan Reddit builder communities
    for (const sub of BUILDER_SUBREDDITS) {
      try {
        const posts = await this.fetchSubredditPosts(sub, 15);
        for (const post of posts) {
          const intel = await this.classifyBuilderPost(post, sub);
          if (intel && intel.relevance_score >= 4) {
            await this.storeIntel(intel);
            results.intelGathered++;
            results.byType[intel.intel_type] = (results.byType[intel.intel_type] || 0) + 1;
          }
        }
        await this.sleep(1200);
      } catch (err) {
        this.logger.debug(`Failed to scan r/${sub}: ${err.message}`, { agentId: this.agentId });
      }
    }

    // Scan Hacker News Show HN
    try {
      const hnPosts = await this.fetchShowHN();
      for (const post of hnPosts) {
        const intel = await this.classifyBuilderPost(post, 'Show HN');
        if (intel && intel.relevance_score >= 4) {
          await this.storeIntel(intel);
          results.intelGathered++;
          results.byType[intel.intel_type] = (results.byType[intel.intel_type] || 0) + 1;
        }
      }
    } catch (err) {
      this.logger.debug(`Failed to scan HN: ${err.message}`, { agentId: this.agentId });
    }

    // Feed high-relevance findings to Product Intelligence
    if (results.intelGathered > 0) {
      try {
        await this.supabase.from('agent_runs').insert({
          account_id: this.accountId,
          agent_id: 'product-intelligence',
          status: 'queued',
          triggered_by: 'builder-community',
          run_started_at: new Date().toISOString(),
        });
      } catch (e) { /* optional trigger */ }
    }
  }

  async fetchSubredditPosts(subreddit, limit = 15) {
    const data = await this.fetchJson(
      `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`,
      { 'User-Agent': 'BeaconOps/2.0 Builder Community' }
    );
    return (data?.data?.children || []).map(c => ({
      source: `r/${subreddit}`,
      source_url: `https://reddit.com${c.data.permalink}`,
      title: c.data.title || '',
      text: (c.data.selftext || '').slice(0, 2000),
      author: c.data.author,
      score: c.data.score,
      num_comments: c.data.num_comments,
      created: c.data.created_utc,
      flair: c.data.link_flair_text,
    }));
  }

  async fetchShowHN() {
    // HN API: get Show HN stories
    const ids = await this.fetchJson('https://hacker-news.firebaseio.com/v0/showstories.json');
    const posts = [];
    for (const id of (ids || []).slice(0, 15)) {
      try {
        const item = await this.fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        if (item) {
          posts.push({
            source: 'Show HN',
            source_url: item.url || `https://news.ycombinator.com/item?id=${id}`,
            title: item.title || '',
            text: (item.text || '').slice(0, 2000),
            author: item.by,
            score: item.score,
            num_comments: item.descendants || 0,
            created: item.time,
          });
        }
      } catch (e) { /* skip */ }
    }
    return posts;
  }

  async classifyBuilderPost(post, source) {
    const productDescs = Object.entries(PRODUCT_BRIEFS)
      .map(([id, p]) => `- ${p.name}: ${p.description} (angles: ${p.angles.join(', ')})`)
      .join('\n');

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `Analyze this builder community post for business intelligence.

Source: ${source}
Title: ${post.title}
Body: ${(post.text || '').slice(0, 1500)}
Author: ${post.author} | Score: ${post.score} | Comments: ${post.num_comments}

Our products:
${productDescs}

If this post contains useful intelligence for any of our products, respond with ONLY valid JSON:
{
  "relevant": true,
  "intel_type": "feature_idea|competitive_signal|partnership_opportunity|marketing_tactic|tech_approach",
  "product_relevance": "chronostates|payroll_beacon|budgeting_beacon",
  "relevance_score": 1-10,
  "summary": "1-2 sentence summary of the actionable intelligence"
}

If not relevant to any of our products, respond: {"relevant": false}`,
        }],
      });

      const text = (response.content[0]?.text || '').trim();
      const parsed = JSON.parse(text);
      if (!parsed.relevant) return null;

      return {
        source: post.source || source,
        source_url: post.source_url,
        title: post.title,
        summary: parsed.summary,
        product_relevance: parsed.product_relevance,
        intel_type: parsed.intel_type,
        relevance_score: parsed.relevance_score,
        author: post.author,
        metadata_json: {
          post_score: post.score,
          num_comments: post.num_comments,
        },
      };
    } catch (err) {
      this.logger.debug(`Classification failed for "${post.title?.slice(0, 50)}": ${err.message}`);
      return null;
    }
  }

  async storeIntel(intel) {
    const { error } = await this.supabase
      .from('builder_intel')
      .upsert({
        account_id: this.accountId,
        source: intel.source,
        source_url: intel.source_url,
        title: intel.title,
        summary: intel.summary,
        product_relevance: intel.product_relevance,
        intel_type: intel.intel_type,
        relevance_score: intel.relevance_score,
        author: intel.author,
        metadata_json: intel.metadata_json,
        date_found: new Date().toISOString(),
      }, { onConflict: 'account_id,source_url' });

    if (error) {
      this.logger.debug(`Failed to store intel: ${error.message}`);
    }
  }

  // ══════════════════════════════════════════════════════
  // FUNCTION 2: Promotional Posting
  // ══════════════════════════════════════════════════════

  async schedulePromos(results) {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun
    const todayStr = today.toISOString().slice(0, 10);

    // Get today's rotation entries
    const todayRotation = PROMO_ROTATION.filter(r => r.day === dayOfWeek);

    for (const slot of todayRotation) {
      try {
        // Check if we already posted this product in this community this week
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
        const { data: existing } = await this.supabase
          .from('content_calendar')
          .select('id')
          .eq('account_id', this.accountId)
          .eq('product', slot.product)
          .eq('community_name', `r/${slot.subreddit}`)
          .eq('post_type', 'builder_promo')
          .gte('date', weekStart.toISOString().slice(0, 10))
          .limit(1);

        if (existing && existing.length > 0) continue;

        // Generate the promo post
        const format = COMMUNITY_FORMATS[slot.subreddit] || { style: 'demo', desc: 'Show what you built' };
        const draft = await this.generatePromoPost(slot.product, slot.subreddit, format);

        // Store in content_calendar
        await this.supabase.from('content_calendar').insert({
          account_id: this.accountId,
          date: todayStr,
          product: slot.product,
          platform: 'reddit',
          community_name: `r/${slot.subreddit}`,
          post_type: 'builder_promo',
          content_theme: `${PRODUCT_BRIEFS[slot.product]?.name} in r/${slot.subreddit} (${format.style} format)`,
          content_draft: draft,
          rules_summary: format.desc,
          status: 'scheduled',
          approval_tier: 2,
          metadata_json: {
            format_style: format.style,
            rotation_day: dayOfWeek,
          },
        });

        // Submit for approval
        await this.submitForApproval({
          itemType: 'builder_promo',
          tier: 2,
          contentPreview: `[${PRODUCT_BRIEFS[slot.product]?.name}] r/${slot.subreddit} — ${format.style} post`,
          fullContent: {
            product: slot.product,
            community: `r/${slot.subreddit}`,
            format: format.style,
            draft,
          },
        });

        results.promoScheduled++;
      } catch (err) {
        this.logger.warn(`Failed to schedule promo for ${slot.product} in r/${slot.subreddit}`, {
          error: err.message,
        });
      }
    }

    // Schedule X/Twitter build-in-public posts (1 per day, rotating products)
    try {
      const xProduct = this.getXProductForToday(today);
      const xDraft = await this.generateXPost(xProduct);

      await this.supabase.from('content_calendar').insert({
        account_id: this.accountId,
        date: todayStr,
        product: xProduct,
        platform: 'twitter',
        community_name: 'X / Build in Public',
        post_type: 'builder_x_post',
        content_theme: `Build-in-public update for ${PRODUCT_BRIEFS[xProduct]?.name}`,
        content_draft: xDraft,
        status: 'scheduled',
        approval_tier: 2,
        metadata_json: { hashtags: X_HASHTAGS },
      });

      await this.submitForApproval({
        itemType: 'builder_x_post',
        tier: 2,
        contentPreview: `[${PRODUCT_BRIEFS[xProduct]?.name}] X build-in-public update`,
        fullContent: {
          product: xProduct,
          platform: 'twitter',
          draft: xDraft,
        },
      });

      results.xPostsQueued++;
    } catch (err) {
      this.logger.warn('Failed to schedule X post', { error: err.message });
    }
  }

  async generatePromoPost(productId, subreddit, format) {
    const product = PRODUCT_BRIEFS[productId];
    const voicePrompt = this.brandVoice.buildSystemPrompt(
      productId,
      `Write a builder community post for r/${subreddit}`,
    );

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: voicePrompt,
        messages: [{
          role: 'user',
          content: `Write a post for r/${subreddit} about ${product.name}.

Product: ${product.name} — ${product.description}
Stage: ${product.stage}
Angles: ${product.angles.join(', ')}

Community format: ${format.style} — ${format.desc}

Requirements:
- Match the community's expected format exactly
- Sound like a real builder sharing their project, NOT an advertisement
- Include what the product does and what stage it's at
- Include a genuine ask (feedback, thoughts, beta testers, roast it)
- Keep it authentic and conversational
- Include a link placeholder: [PRODUCT_LINK]
- Under 300 words
- Write a compelling title on the first line, then a blank line, then the body`,
        }],
      });

      return response.content[0]?.text || '';
    } catch (err) {
      this.logger.warn('Claude promo generation failed', { error: err.message });
      return `[Draft needed] ${product.name} post for r/${subreddit} in ${format.style} format`;
    }
  }

  getXProductForToday(date) {
    const productIds = Object.keys(PRODUCT_BRIEFS);
    const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
    return productIds[dayOfYear % productIds.length];
  }

  async generateXPost(productId) {
    const product = PRODUCT_BRIEFS[productId];

    // Vary the X post type
    const types = [
      'metrics update (share a number — users, features shipped, uptime)',
      'lesson learned (something surprising you discovered while building)',
      'feature launch (what you just shipped and why)',
      'behind-the-scenes (tech decision, architecture choice, tool discovery)',
      'challenge post (a problem you\'re solving and how you\'re approaching it)',
    ];
    const typeIndex = new Date().getDate() % types.length;
    const postType = types[typeIndex];

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Write a build-in-public X (Twitter) post for ${product.name}.

Product: ${product.description}
Post type: ${postType}

Requirements:
- Under 280 characters
- Authentic builder voice — not corporate
- Include 1-2 relevant hashtags from: ${X_HASHTAGS.join(' ')}
- No links (will be added separately)
- Make people want to engage (ask a question or share something relatable)`,
        }],
      });

      return response.content[0]?.text || '';
    } catch (err) {
      return `[Draft needed] ${product.name} build-in-public update — ${postType}`;
    }
  }

  // ── Helpers ────────────────────────────────────────────
  fetchJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: { Accept: 'application/json', ...headers },
        timeout: 10000,
      };
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error(`Invalid JSON from ${parsedUrl.hostname}`)); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.end();
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BuilderCommunityAgent;
