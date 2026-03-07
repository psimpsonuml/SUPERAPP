const BaseAgent = require('./base-agent');
const products = require('../config/products');

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

    this.frustrationSignals = [
      'hate', 'frustrated', 'broken', 'terrible', 'wish there was',
      'looking for', 'anyone know', 'alternative to', 'switched from',
      'can\'t figure out', 'doesn\'t work', 'too expensive', 'nightmare',
      'help me', 'is there a way', 'feature request',
    ];
  }

  async run() {
    const results = { painPointsFound: 0, responseDrafted: 0, byProduct: {}, trends: [] };

    for (const productId of Object.keys(products)) {
      results.byProduct[productId] = 0;

      const signals = await this.scanCommunities(productId);

      for (const signal of signals) {
        const classified = await this.classifySignal(signal, productId);
        if (!classified.isRelevant) continue;

        // Store pain point
        await this.supabase.from('pain_points').insert({
          account_id: this.accountId,
          source: signal.source,
          source_url: signal.url,
          text: signal.text,
          product_relevance: productId,
          urgency: classified.urgency,
          category: classified.category,
        });

        // Draft a value-add response if appropriate
        if (classified.responseOpportunity) {
          const response = await this.draftResponse(signal, productId);
          await this.submitForApproval({
            itemType: 'pain_point_response',
            contentPreview: `[${productId}] Response to: ${signal.text.slice(0, 80)}...`,
            fullContent: {
              product: productId,
              originalSignal: signal,
              draftResponse: response,
              urgency: classified.urgency,
            },
          });
          results.responseDrafted++;
        }

        results.painPointsFound++;
        results.byProduct[productId]++;
      }
    }

    // Trend analysis
    results.trends = await this.analyzeTrends();
    return results;
  }

  async scanCommunities(productId) {
    // Scan communities for pain points matching product
    const { data: communities } = await this.supabase
      .from('community_profiles')
      .select('platform, name, url')
      .eq('account_id', this.accountId)
      .contains('products_relevant', [productId]);

    // TODO: Platform API integration to scan posts/comments
    this.logger.debug(`Scanning ${(communities || []).length} communities for ${productId} pain points`, {
      agentId: this.agentId,
    });
    return [];
  }

  async classifySignal(signal, productId) {
    // TODO: LLM-based classification
    return {
      isRelevant: true,
      urgency: 'medium',
      category: 'feature_gap',
      responseOpportunity: true,
    };
  }

  async draftResponse(signal, productId) {
    const voicePrompt = this.brandVoice.buildSystemPrompt(
      productId,
      'Draft a genuinely helpful response. Mention product only if naturally appropriate.'
    );

    // TODO: LLM integration
    return {
      text: '[Value-add response draft]',
      mentionsProduct: false,
      voiceProfile: voicePrompt,
    };
  }

  async analyzeTrends() {
    // Analyze pain points over 7/30/90 day windows
    const windows = [7, 30, 90];
    const trends = [];

    for (const days of windows) {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data } = await this.supabase
        .from('pain_points')
        .select('category, product_relevance, urgency')
        .eq('account_id', this.accountId)
        .gte('date_found', since.toISOString());

      if (data && data.length > 0) {
        const categories = {};
        for (const pp of data) {
          const key = `${pp.product_relevance}:${pp.category}`;
          categories[key] = (categories[key] || 0) + 1;
        }
        trends.push({ window: `${days}d`, topCategories: categories });
      }
    }

    return trends;
  }
}

module.exports = PainPointHunterAgent;
