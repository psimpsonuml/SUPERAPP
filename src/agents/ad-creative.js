const BaseAgent = require('./base-agent');
const products = require('../config/products');

class AdCreativeAgent extends BaseAgent {
  static agentId = 'ad-creative';
  static agentName = 'Ad Creative Agent';

  constructor(accountId) {
    super(accountId, {
      agentId: 'ad-creative',
      agentName: 'Ad Creative Agent',
      cycle: 'weekly',
      defaultTier: 2,
    });

    this.platformSpecs = {
      facebook: {
        formats: ['image', 'carousel', 'video'],
        copyLimits: { primary: 125, headline: 40 },
        imageSpecs: ['1080x1080', '1200x628'],
      },
      reddit: {
        formats: ['promoted_post'],
        copyLimits: { title: 300 },
        imageSpecs: ['1200x628'],
      },
      google: {
        formats: ['search', 'display', 'video'],
        copyLimits: { headline: 30, description: 90 },
        imageSpecs: ['responsive'],
      },
      linkedin: {
        formats: ['sponsored_content', 'inmail'],
        copyLimits: { intro: 150, headline: 70 },
        imageSpecs: ['1200x627'],
      },
    };
  }

  async run() {
    const results = { creativesGenerated: 0, byProduct: {}, byPlatform: {} };

    for (const productId of Object.keys(products)) {
      results.byProduct[productId] = 0;

      for (const [platform, specs] of Object.entries(this.platformSpecs)) {
        for (const format of specs.formats) {
          const creative = await this.generateCreative(productId, platform, format, specs);

          const complianceCheck = this.checkCompliance(creative, specs);
          if (!complianceCheck.pass) {
            this.logger.warn(`Ad compliance failed: ${complianceCheck.reason}`, {
              agentId: this.agentId,
              product: productId,
              platform,
            });
            continue;
          }

          await this.submitForApproval({
            itemType: 'ad_creative',
            contentPreview: `[${productId}/${platform}/${format}] ${creative.headline}`,
            fullContent: {
              product: productId,
              platform,
              format,
              creative,
              specs,
            },
          });

          results.creativesGenerated++;
          results.byProduct[productId]++;
          results.byPlatform[platform] = (results.byPlatform[platform] || 0) + 1;
        }
      }
    }

    return results;
  }

  async generateCreative(productId, platform, format, specs) {
    const voicePrompt = this.brandVoice.buildSystemPrompt(
      productId,
      `Create ${format} ad creative for ${platform}`
    );

    // TODO: LLM + image gen integration
    return {
      headline: `[${products[productId].name} — ${format} headline]`,
      primaryText: '[Primary ad text]',
      description: '[Ad description]',
      ctaText: 'Learn More',
      imagePrompts: specs.imageSpecs.map(s => `[Image prompt for ${s}]`),
      videoConceptText: format === 'video' ? '[Video concept description]' : null,
      targetUrl: `${products[productId].domain}?utm_source=${platform}&utm_medium=paid`,
    };
  }

  checkCompliance(creative, specs) {
    // Check copy length limits
    if (specs.copyLimits.primary && creative.primaryText.length > specs.copyLimits.primary) {
      return { pass: false, reason: `Primary text exceeds ${specs.copyLimits.primary} chars` };
    }
    if (specs.copyLimits.headline && creative.headline.length > specs.copyLimits.headline) {
      return { pass: false, reason: `Headline exceeds ${specs.copyLimits.headline} chars` };
    }
    // TODO: Additional compliance checks (prohibited claims, etc.)
    return { pass: true };
  }
}

module.exports = AdCreativeAgent;
