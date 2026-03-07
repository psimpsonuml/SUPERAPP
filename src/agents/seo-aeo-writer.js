const BaseAgent = require('./base-agent');
const products = require('../config/products');
const { v4: uuidv4 } = require('uuid');

class SeoAeoWriterAgent extends BaseAgent {
  static agentId = 'seo-aeo-writer';
  static agentName = 'SEO/AEO Writer';

  constructor(accountId) {
    super(accountId, {
      agentId: 'seo-aeo-writer',
      agentName: 'SEO/AEO Writer',
      cycle: 'daily',
      defaultTier: 2,
    });
    this.keywordCooldownDays = 90;
    this.minInternalLinks = 2;
    this.minExternalLinks = 1;
  }

  async run() {
    const results = { postsGenerated: 0, repurposeChainsStarted: 0, keywordsUsed: [] };

    for (const productId of Object.keys(products)) {
      const keyword = await this.selectKeyword(productId);
      if (!keyword) {
        this.logger.warn(`No available keywords for ${productId}`, { agentId: this.agentId });
        continue;
      }

      const article = await this.generateArticle(productId, keyword);

      // Check for duplicate content
      const dupCheck = await this.checkDuplicate(article.body, productId);
      if (dupCheck.isDuplicate) {
        this.logger.warn(`Duplicate content detected for ${productId}: ${keyword.keyword}`, {
          agentId: this.agentId,
          matchType: dupCheck.matchType,
        });
        continue;
      }

      // Start repurposing chain
      const chainId = uuidv4();

      // Store the blog post
      const contentId = await this.storeContent({
        product: productId,
        platform: 'blog',
        contentType: 'blog_post',
        title: article.title,
        contentText: article.body,
        repurposeChainId: chainId,
        metadata: {
          keyword: keyword.keyword,
          metaTitle: article.metaTitle,
          metaDescription: article.metaDescription,
          ogImagePrompt: article.ogImagePrompt,
          faqSchema: article.faqSchema,
          internalLinks: article.internalLinks,
        },
      });

      // Submit for approval
      await this.submitForApproval({
        itemType: 'blog_post',
        contentPreview: `[${productId}] ${article.title} — Keyword: ${keyword.keyword}`,
        fullContent: {
          product: productId,
          contentId,
          chainId,
          article,
          keyword: keyword.keyword,
        },
      });

      // Mark keyword as used
      await this.markKeywordUsed(keyword.id);

      // Flag repurposing chain items
      await this.triggerRepurposeChain(productId, contentId, chainId, article);

      results.postsGenerated++;
      results.repurposeChainsStarted++;
      results.keywordsUsed.push(keyword.keyword);
    }

    return results;
  }

  async selectKeyword(productId) {
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() - this.keywordCooldownDays);

    const { data } = await this.supabase
      .from('keyword_map')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('product_assigned', productId)
      .eq('status', 'available')
      .or(`last_used.is.null,last_used.lt.${cooldownDate.toISOString()}`)
      .order('search_volume', { ascending: false })
      .order('difficulty', { ascending: true })
      .limit(1);

    return data?.[0] || null;
  }

  async markKeywordUsed(keywordId) {
    await this.supabase
      .from('keyword_map')
      .update({ last_used: new Date().toISOString(), status: 'used' })
      .eq('id', keywordId);
  }

  async generateArticle(productId, keyword) {
    const voicePrompt = this.brandVoice.buildSystemPrompt(
      productId,
      `Write an SEO/AEO-optimized blog post targeting the keyword "${keyword.keyword}"`
    );

    // TODO: LLM integration for article generation
    // Steps: outline → full draft → AEO pass → internal links → meta generation
    return {
      title: `[Generated Title for: ${keyword.keyword}]`,
      body: `[Generated article body for ${products[productId].name}]`,
      metaTitle: `[Meta title for: ${keyword.keyword}]`,
      metaDescription: `[Meta description for: ${keyword.keyword}]`,
      ogImagePrompt: `[OG image prompt for: ${keyword.keyword}]`,
      faqSchema: [],
      internalLinks: [],
      externalLinks: [],
      wordCount: 0,
    };
  }

  async triggerRepurposeChain(productId, sourceContentId, chainId, article) {
    // Flag chain items for downstream agents:
    // 1. Substack excerpt (ChronoStates only)
    // 2. 3 social post variants
    // 3. Short-form video script
    // 4. Reddit comment response draft

    const chainItems = [
      { type: 'social_posts', count: 3, agent: 'social-distributor' },
      { type: 'video_script', count: 1, agent: 'video-producer' },
    ];

    if (products[productId]?.hasSubstack) {
      chainItems.unshift({ type: 'substack_excerpt', count: 1, agent: 'substack-publisher' });
    }

    for (const item of chainItems) {
      await this.storeContent({
        product: productId,
        platform: 'pending',
        contentType: item.type,
        title: `[Pending ${item.type}] from: ${article.title}`,
        contentText: '',
        sourceContentId,
        repurposeChainId: chainId,
        status: 'pending_repurpose',
        metadata: { targetAgent: item.agent, count: item.count },
      });
    }
  }
}

module.exports = SeoAeoWriterAgent;
