const BaseAgent = require('./base-agent');
const products = require('../config/products');

class VideoProducerAgent extends BaseAgent {
  static agentId = 'video-producer';
  static agentName = 'Video Producer';

  constructor(accountId) {
    super(accountId, {
      agentId: 'video-producer',
      agentName: 'Video Producer',
      cycle: 'daily',
      defaultTier: 2,
    });

    this.qualityGates = {
      captionAccuracy: 0.95,
      maxLatencyMs: 30000,
      minDurationSec: 15,
      maxShortFormSec: 60,
      maxLongFormSec: 300,
    };
  }

  async run() {
    const results = { videosProduced: 0, platforms: [] };

    for (const productId of Object.keys(products)) {
      const product = products[productId];
      if (!product.platforms.includes('tiktok') && !product.platforms.includes('youtube')) continue;

      const topic = await this.selectTopic(productId);
      const script = await this.generateScript(productId, topic);
      const assets = await this.produceVideo(productId, script);

      if (!this.passesQualityGate(assets)) {
        this.logger.warn(`Video quality gate failed for ${productId}`, { agentId: this.agentId });
        continue;
      }

      const contentId = await this.storeContent({
        product: productId,
        platform: 'video',
        contentType: 'short_form_video',
        title: script.title,
        contentText: script.scriptText,
        metadata: {
          duration: assets.duration,
          voicePreset: productId,
          thumbnail: assets.thumbnailUrl,
          captions: assets.captionsUrl,
          platforms: this.getTargetPlatforms(product),
        },
      });

      await this.submitForApproval({
        itemType: 'video',
        contentPreview: `[${productId}] Video: ${script.title} (${assets.duration}s)`,
        fullContent: {
          product: productId,
          contentId,
          script,
          assets,
        },
      });

      results.videosProduced++;
      results.platforms.push(...this.getTargetPlatforms(product));
    }

    return results;
  }

  async selectTopic(productId) {
    // Pull from blog content, pain points, or trending community topics
    const { data: recentPosts } = await this.supabase
      .from('content_memory')
      .select('title, keywords, engagement_score')
      .eq('account_id', this.accountId)
      .eq('product', productId)
      .eq('content_type', 'blog_post')
      .order('created_at', { ascending: false })
      .limit(5);

    return {
      source: 'blog_content',
      recentPosts: recentPosts || [],
      topic: recentPosts?.[0]?.title || 'General topic',
    };
  }

  async generateScript(productId, topic) {
    const voicePrompt = this.brandVoice.buildSystemPrompt(
      productId,
      'Write a 30-60 second short-form video script'
    );

    // TODO: LLM integration for script generation
    return {
      title: `[Video: ${topic.topic}]`,
      scriptText: '[Generated script text]',
      duration: 45,
      scenes: [],
      voiceoverText: '[Voiceover text for ElevenLabs]',
    };
  }

  async produceVideo(productId, script) {
    // Pipeline: visuals → voiceover → captions → thumbnail → assembly
    // TODO: Implement ElevenLabs TTS, image gen, FFmpeg assembly
    return {
      videoUrl: null,
      thumbnailUrl: null,
      captionsUrl: null,
      duration: script.duration,
      audioSynced: true,
      captionAccuracy: 0.98,
      hasBlankFrames: false,
    };
  }

  passesQualityGate(assets) {
    if (!assets.audioSynced) return false;
    if (assets.captionAccuracy < this.qualityGates.captionAccuracy) return false;
    if (assets.hasBlankFrames) return false;
    if (assets.duration < this.qualityGates.minDurationSec) return false;
    return true;
  }

  getTargetPlatforms(product) {
    return product.platforms.filter(p => p === 'tiktok' || p === 'youtube');
  }
}

module.exports = VideoProducerAgent;
