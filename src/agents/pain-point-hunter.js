const BaseAgent = require('./base-agent');
const products = require('../config/products');
const Anthropic = require('@anthropic-ai/sdk');

// Subreddit targets per product
const SUBREDDIT_MAP = {
  payroll_beacon: [
    'payroll', 'humanresources', 'accounting', 'smallbusiness',
  ],
  chronostates: [
    'alternatehistory', 'historywhatif', 'paradoxplaza', 'worldbuilding',
  ],
  budgeting_beacon: [
    'personalfinance', 'budgeting', 'povertyfinance', 'YNAB', 'FinancialPlanning',
  ],
};

const REDDIT_USER_AGENT = 'BeaconOps/1.0 (Pain Point Scanner)';

class PainPointHunterAgent extends BaseAgent {
  static agentId = 'pain-point-hunter';
  static agentName = 'Pain Point Hunter';

  constructor(accountId) {
    super(accountId, {
      agentId: 'pain-point-hunter',
      agentName: 'Pain Point Hunter',
      cycle: 'daily',
      defaultTier: 2,
    });

    this.minRelevanceScore = 4; // Store anything 4+
    this.approvalThreshold = 7; // Submit 7+ to approval queue
    this.maxPostsPerSubreddit = 50;
  }

  async run() {
    const results = {
      painPointsFound: 0,
      responseDrafted: 0,
      byProduct: {},
      subredditsScanned: 0,
      postsAnalyzed: 0,
      highScoreCount: 0,
    };

    for (const productId of Object.keys(products)) {
      results.byProduct[productId] = { found: 0, highScore: 0, drafted: 0 };

      const subreddits = SUBREDDIT_MAP[productId] || [];
      if (subreddits.length === 0) continue;

      for (const subreddit of subreddits) {
        try {
          const posts = await this.fetchSubredditPosts(subreddit);
          results.subredditsScanned++;

          // Filter to last 24 hours
          const oneDayAgo = Date.now() / 1000 - 86400;
          const recentPosts = posts.filter(p => p.created_utc > oneDayAgo);
          results.postsAnalyzed += recentPosts.length;

          this.logger.debug(`r/${subreddit}: ${recentPosts.length} posts in last 24h (of ${posts.length} fetched)`, {
            agentId: this.agentId,
          });

          // Check for already-processed URLs
          const existingUrls = await this.getExistingUrls(
            recentPosts.map(p => `https://reddit.com${p.permalink}`)
          );

          for (const post of recentPosts) {
            const url = `https://reddit.com${post.permalink}`;
            if (existingUrls.has(url)) continue;

            // Classify with Claude
            const classification = await this.classifyWithClaude(post, productId);
            if (!classification || classification.score < this.minRelevanceScore) continue;

            // Draft response for high-scoring items
            let draftedResponse = null;
            let mentionsProduct = false;
            if (classification.score >= this.approvalThreshold) {
              const response = await this.draftResponseWithClaude(post, productId, classification);
              draftedResponse = response.text;
              mentionsProduct = response.mentionsProduct;
              results.byProduct[productId].drafted++;
              results.responseDrafted++;
            }

            // Store pain point
            await this.storePainPoint({
              source: 'reddit',
              source_url: url,
              subreddit: `r/${subreddit}`,
              title: post.title,
              text: (post.selftext || post.title || '').slice(0, 2000),
              product: productId,
              product_relevance: productId,
              classification: classification.type,
              score: classification.score,
              urgency: classification.urgency,
              drafted_response: draftedResponse,
              response_mentions_product: mentionsProduct,
              category: classification.category,
              reddit_author: post.author,
              reddit_score: post.score,
              reddit_num_comments: post.num_comments,
            });

            results.painPointsFound++;
            results.byProduct[productId].found++;

            // Submit high-scoring items to approval queue
            if (classification.score >= this.approvalThreshold) {
              results.highScoreCount++;
              results.byProduct[productId].highScore++;

              await this.submitForApproval({
                itemType: 'pain_point_response',
                contentPreview: `[${productId}] (${classification.score}/10) r/${subreddit}: ${post.title.slice(0, 80)}`,
                fullContent: {
                  product: productId,
                  subreddit: `r/${subreddit}`,
                  postTitle: post.title,
                  postText: (post.selftext || '').slice(0, 1000),
                  postUrl: url,
                  postAuthor: post.author,
                  classification,
                  draftedResponse,
                  mentionsProduct,
                },
              });
            }
          }
        } catch (err) {
          this.logger.warn(`Failed to scan r/${subreddit}: ${err.message}`, {
            agentId: this.agentId,
          });
        }
      }
    }

    // Trend analysis across all pain points
    results.trends = await this.analyzeTrends();
    return results;
  }

  // ── Reddit Fetcher ──────────────────────────────────────

  async fetchSubredditPosts(subreddit) {
    const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.json?limit=${this.maxPostsPerSubreddit}&raw_json=1`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': REDDIT_USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Reddit API error for r/${subreddit}: ${res.status}`);
    }

    const data = await res.json();
    const children = data?.data?.children || [];

    return children
      .filter(c => c.kind === 't3') // Only link posts
      .map(c => c.data)
      .filter(p => !p.stickied && !p.removed_by_category); // Skip stickied/removed
  }

  // ── Claude Classification ──────────────────────────────

  async classifyWithClaude(post, productId) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Fallback: keyword-based classification
      return this.classifyByKeywords(post, productId);
    }

    const product = products[productId];
    const postContent = `Title: ${post.title}\n\nBody: ${(post.selftext || '').slice(0, 1500)}`;

    try {
      const client = new Anthropic();

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: `You are analyzing Reddit posts to find pain points relevant to "${product.name}" — ${product.description}. Target audience: ${product.audience}.

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "score": <1-10 relevance score>,
  "type": "<pain_point|feature_request|complaint|question|opportunity>",
  "urgency": "<low|medium|high|critical>",
  "category": "<string describing the category, e.g. 'pricing', 'ux', 'feature_gap', 'compliance', 'workflow', 'switching'>",
  "reasoning": "<one sentence why this is or isn't relevant>"
}

Score guide:
- 1-3: Not relevant to ${product.name}
- 4-6: Somewhat relevant, general pain in the space
- 7-8: Directly relevant pain point ${product.name} could address
- 9-10: Perfect match — person is actively looking for exactly what ${product.name} does`,
        messages: [{ role: 'user', content: postContent }],
      });

      const text = message.content[0]?.text || '';
      const parsed = JSON.parse(text);

      return {
        score: Math.min(10, Math.max(1, parseInt(parsed.score) || 1)),
        type: parsed.type || 'pain_point',
        urgency: parsed.urgency || 'medium',
        category: parsed.category || 'general',
        reasoning: parsed.reasoning || '',
      };
    } catch (err) {
      this.logger.warn(`Claude classification failed, using keyword fallback: ${err.message}`, {
        agentId: this.agentId,
      });
      return this.classifyByKeywords(post, productId);
    }
  }

  // ── Keyword Fallback Classification ─────────────────────

  classifyByKeywords(post, productId) {
    const text = `${post.title} ${post.selftext || ''}`.toLowerCase();

    const frustrationSignals = [
      'hate', 'frustrated', 'broken', 'terrible', 'wish there was',
      'looking for', 'anyone know', 'alternative to', 'switched from',
      "can't figure out", "doesn't work", 'too expensive', 'nightmare',
      'help me', 'is there a way', 'feature request', 'recommend',
      'struggling', 'pain', 'annoying', 'bug', 'issue', 'problem',
    ];

    const productKeywords = {
      payroll_beacon: ['payroll', 'compliance', 'multi-state', 'w-2', 'tax filing', 'garnishment', 'pay stub', 'direct deposit', 'paychex', 'gusto', 'adp'],
      chronostates: ['alternate history', 'what if', 'counterfactual', 'historical scenario', 'strategy game', 'civilization', 'paradox', 'world building'],
      budgeting_beacon: ['budget', 'budgeting', 'expense', 'savings', 'debt', 'spending', 'financial', 'money management', 'ynab', 'mint', 'envelope'],
    };

    const signals = frustrationSignals.filter(s => text.includes(s));
    const keywords = (productKeywords[productId] || []).filter(k => text.includes(k));

    const signalScore = Math.min(5, signals.length * 2);
    const keywordScore = Math.min(5, keywords.length * 2);
    const score = Math.min(10, signalScore + keywordScore);

    let type = 'question';
    if (signals.some(s => ['hate', 'frustrated', 'broken', 'terrible', 'nightmare'].includes(s))) type = 'complaint';
    else if (signals.some(s => ['wish there was', 'feature request', 'is there a way'].includes(s))) type = 'feature_request';
    else if (signals.some(s => ['looking for', 'anyone know', 'alternative to', 'recommend'].includes(s))) type = 'opportunity';
    else if (signals.length > 0) type = 'pain_point';

    const urgency = score >= 8 ? 'high' : score >= 5 ? 'medium' : 'low';

    return { score, type, urgency, category: 'general', reasoning: 'Keyword-based classification' };
  }

  // ── Claude Response Drafter ─────────────────────────────

  async draftResponseWithClaude(post, productId, classification) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { text: null, mentionsProduct: false };
    }

    const product = products[productId];
    const postContent = `Title: ${post.title}\n\nBody: ${(post.selftext || '').slice(0, 1500)}`;

    try {
      const client = new Anthropic();

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: `You are drafting a helpful Reddit response on behalf of someone who builds "${product.name}" (${product.description}).

Rules:
1. Lead with genuine value — solve the person's problem first
2. Be conversational and authentic (match Reddit tone)
3. Only mention ${product.name} if it NATURALLY fits as a solution — never force it
4. If the product is mentioned, it should be subtle: "I've been working on something that might help" or "there's a tool called ${product.name} that handles this"
5. Never be salesy, never use marketing language
6. Keep it under 200 words
7. If ${product.name} isn't directly relevant to their specific question, just help them without mentioning it

Classification: ${classification.type} (${classification.category})`,
        messages: [{ role: 'user', content: `Draft a helpful response to this Reddit post:\n\n${postContent}` }],
      });

      const responseText = message.content[0]?.text || '';
      const mentionsProduct = responseText.toLowerCase().includes(product.name.toLowerCase()) ||
                              responseText.toLowerCase().includes(product.domain.toLowerCase());

      return { text: responseText, mentionsProduct };
    } catch (err) {
      this.logger.warn(`Claude response draft failed: ${err.message}`, { agentId: this.agentId });
      return { text: null, mentionsProduct: false };
    }
  }

  // ── Storage ─────────────────────────────────────────────

  async storePainPoint(data) {
    const { error } = await this.supabase.from('pain_points').insert({
      account_id: this.accountId,
      ...data,
      date_found: new Date().toISOString(),
    });

    if (error) {
      this.logger.warn(`Failed to store pain point: ${error.message}`, { agentId: this.agentId });
    }
  }

  async getExistingUrls(urls) {
    if (urls.length === 0) return new Set();

    try {
      const { data } = await this.supabase
        .from('pain_points')
        .select('source_url')
        .eq('account_id', this.accountId)
        .in('source_url', urls);

      return new Set((data || []).map(d => d.source_url));
    } catch {
      return new Set();
    }
  }

  // ── Trend Analysis ──────────────────────────────────────

  async analyzeTrends() {
    const windows = [7, 30, 90];
    const trends = [];

    for (const days of windows) {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data } = await this.supabase
        .from('pain_points')
        .select('category, product, urgency, score')
        .eq('account_id', this.accountId)
        .gte('date_found', since.toISOString());

      if (data && data.length > 0) {
        const categories = {};
        let totalScore = 0;
        for (const pp of data) {
          const key = `${pp.product}:${pp.category}`;
          categories[key] = (categories[key] || 0) + 1;
          totalScore += pp.score || 0;
        }

        trends.push({
          window: `${days}d`,
          count: data.length,
          avgScore: (totalScore / data.length).toFixed(1),
          topCategories: categories,
        });
      }
    }

    return trends;
  }
}

module.exports = PainPointHunterAgent;
