const { getSupabase } = require('../db/supabase');
const products = require('../config/products');

class BrandVoiceService {
  constructor(accountId) {
    this.accountId = accountId;
    this.cache = new Map();
  }

  async getProfile(productId) {
    if (this.cache.has(productId)) {
      return this.cache.get(productId);
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('product', productId)
      .single();

    if (error || !data) {
      // Fall back to default product config
      const defaultProfile = products[productId];
      if (!defaultProfile) {
        throw new Error(`Unknown product: ${productId}`);
      }
      return {
        product: productId,
        voiceConfig: defaultProfile.voice,
        name: defaultProfile.name,
        audience: defaultProfile.audience,
        platforms: defaultProfile.platforms,
      };
    }

    const profile = {
      product: productId,
      voiceConfig: data.voice_config,
      languageSettings: data.language_settings,
      hashtagSets: data.hashtag_sets,
      prohibitedPhrases: data.prohibited_phrases,
      emojiPolicy: data.emoji_policy,
      platformAdaptations: data.platform_adaptations,
      name: products[productId]?.name || productId,
      audience: products[productId]?.audience || '',
      platforms: products[productId]?.platforms || [],
    };

    this.cache.set(productId, profile);
    return profile;
  }

  buildSystemPrompt(productId, agentPurpose) {
    const product = products[productId];
    if (!product) {
      throw new Error(`Unknown product: ${productId}`);
    }

    return [
      `You are writing content for ${product.name}: ${product.description}.`,
      `Target audience: ${product.audience}.`,
      `Voice and tone: ${product.voice.tone}.`,
      `Tone keywords: ${product.voice.keywords.join(', ')}.`,
      `Writing style: ${product.voice.style}.`,
      `Prohibited phrases: ${product.voice.prohibited.join(', ')}.`,
      `Emoji policy: ${product.voice.emojiPolicy}.`,
      ``,
      `Agent purpose: ${agentPurpose}`,
    ].join('\n');
  }

  getHashtags(productId, count = 5) {
    const product = products[productId];
    if (!product) return [];
    const tags = [...product.voice.hashtagSets];
    // Shuffle and pick
    for (let i = tags.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tags[i], tags[j]] = [tags[j], tags[i]];
    }
    return tags.slice(0, count);
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = BrandVoiceService;
