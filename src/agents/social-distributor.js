const BaseAgent = require('./base-agent');
const products = require('../config/products');

class SocialDistributorAgent extends BaseAgent {
  static agentId = 'social-distributor';
  static agentName = 'Social Distributor';

  constructor(accountId) {
    super(accountId, {
      agentId: 'social-distributor',
      agentName: 'Social Distributor',
      cycle: 'daily',
      defaultTier: 2,
    });

    this.platformRules = {
      reddit: { maxPerSubreddit: 1, tone: 'Authentic, value-first, not salesy', format: 'text' },
      facebook: { maxPerPage: 3, tone: 'Slightly more casual', format: 'image_caption' },
      discord: { products: ['chronostates'], tone: 'Community member', format: 'conversational' },
      instagram: { maxPerDay: 2, tone: 'Visual-first, hashtag optimized', format: 'carousel' },
      linkedin: { maxPerDay: 1, tone: 'Thought leadership', format: 'professional_insight' },
    };
  }

  async run() {
    const results = { postsCreated: 0, platforms: {} };

    for (const productId of Object.keys(products)) {
      const product = products[productId];

      for (const platform of product.platforms) {
        if (platform === 'tiktok' || platform === 'youtube' || platform === 'substack') continue;
        if (platform === 'discord' && productId !== 'chronostates') continue;

        const rules = this.platformRules[platform];
        if (!rules) continue;

        const posts = await this.generatePosts(productId, platform, rules);

        for (const post of posts) {
          await this.submitForApproval({
            itemType: 'social_post',
            contentPreview: `[${productId}/${platform}] ${post.text.slice(0, 100)}...`,
            fullContent: {
              product: productId,
              platform,
              post,
            },
          });
          results.postsCreated++;
        }

        results.platforms[platform] = (results.platforms[platform] || 0) + posts.length;
      }
    }

    return results;
  }

  async generatePosts(productId, platform, rules) {
    // Pull from repurposing chain or generate fresh
    const { data: pendingRepurpose } = await this.supabase
      .from('content_memory')
      .select('id, title, content_text, metadata')
      .eq('account_id', this.accountId)
      .eq('product', productId)
      .eq('content_type', 'social_posts')
      .eq('status', 'pending_repurpose')
      .limit(3);

    const voicePrompt = this.brandVoice.buildSystemPrompt(
      productId,
      `Create ${platform} post. Tone: ${rules.tone}. Format: ${rules.format}`
    );

    const hashtags = this.brandVoice.getHashtags(productId, platform === 'instagram' ? 8 : 3);

    // TODO: LLM integration for post generation
    return [{
      text: `[Generated ${platform} post for ${products[productId].name}]`,
      hashtags,
      format: rules.format,
      imagePrompt: rules.format !== 'text' ? '[Image generation prompt]' : null,
      scheduledTime: null,
    }];
  }
}

module.exports = SocialDistributorAgent;
