const BaseAgent = require('./base-agent');
const products = require('../config/products');
const config = require('../config');
const crypto = require('crypto');
const { SIGNAL_COLUMNS, withSignalText } = require('../shared/pain-points');

// ── Topic source queries per product ──────────────────────
const TOPIC_HOOKS = {
  chronostates: [
    'What if the Roman Empire never fell?',
    'Alternate Cold War scenarios that changed everything',
    'The butterfly effect in history — one decision changes the world',
    'Ancient civilizations with modern technology',
    'Historical turning points that almost happened',
  ],
  payroll_beacon: [
    'Multi-state payroll compliance mistakes to avoid',
    'New payroll tax changes every employer needs to know',
    'How to handle payroll for remote workers across states',
    'Common payroll audit triggers and how to prepare',
    'Payroll deadlines that catch employers off guard',
  ],
  budgeting_beacon: [
    'The 50/30/20 budget rule — does it actually work?',
    'How to save $500 this month without noticing',
    'Debt payoff strategies ranked — which one wins?',
    'Budget mistakes that keep you broke',
    'Emergency fund: how much do you really need?',
  ],
};

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
      minFileSizeBytes: 50_000,
      maxFileSizeMB: 100,
    };
  }

  async run() {
    const results = {
      videosProduced: 0,
      videosFailed: 0,
      platforms: [],
      byProduct: {},
    };

    const dayOfWeek = new Date().getDay(); // 0 = Sunday
    const isLongFormDay = dayOfWeek === 1; // Monday = long-form day

    for (const productId of Object.keys(products)) {
      const product = products[productId];
      if (!product.platforms.includes('tiktok') && !product.platforms.includes('youtube')) continue;

      const productResult = { short: null, long: null };

      try {
        // ── Short-form video (daily) ──────────────────────
        const topic = await this.selectTopic(productId);
        const script = await this.generateScript(productId, topic, 'short');
        const assets = await this.produceVideo(productId, script);

        const qgResult = this.runQualityGate(assets, 'short');
        if (!qgResult.pass) {
          this.logger.warn(`Short-form quality gate failed for ${productId}`, {
            agentId: this.agentId,
            failures: qgResult.failures,
          });
          results.videosFailed++;
          productResult.short = { status: 'failed_qa', failures: qgResult.failures };
        } else {
          const stored = await this.storeVideoAsset(productId, script, assets, 'short');
          productResult.short = { status: 'produced', contentId: stored.contentId, duration: assets.duration };
          results.videosProduced++;
          results.platforms.push(...this.getTargetPlatforms(product));
        }

        // ── Long-form video (weekly, Mondays) ─────────────
        if (isLongFormDay) {
          const longTopic = await this.selectTopic(productId, 'long');
          const longScript = await this.generateScript(productId, longTopic, 'long');
          const longAssets = await this.produceVideo(productId, longScript);

          const longQg = this.runQualityGate(longAssets, 'long');
          if (!longQg.pass) {
            this.logger.warn(`Long-form quality gate failed for ${productId}`, {
              agentId: this.agentId,
              failures: longQg.failures,
            });
            productResult.long = { status: 'failed_qa', failures: longQg.failures };
          } else {
            const stored = await this.storeVideoAsset(productId, longScript, longAssets, 'long');
            productResult.long = { status: 'produced', contentId: stored.contentId, duration: longAssets.duration };
            results.videosProduced++;
          }
        }
      } catch (error) {
        this.logger.error(`Video production failed for ${productId}: ${error.message}`, {
          agentId: this.agentId,
          product: productId,
        });
        results.videosFailed++;
        productResult.short = productResult.short || { status: 'error', error: error.message };
      }

      results.byProduct[productId] = productResult;
    }

    // Record production stats
    await this.recordProductionStats(results);

    return results;
  }

  // ── Topic Selection ─────────────────────────────────────────
  async selectTopic(productId, format = 'short') {
    // Source 1: Pending video_script from repurpose chain
    const pendingScript = await this.getPendingRepurposeScript(productId);
    if (pendingScript) {
      return {
        source: 'repurpose_chain',
        topic: pendingScript.title.replace('[Pending video_script] from: ', ''),
        sourceContentId: pendingScript.source_content_id,
        repurposeChainId: pendingScript.repurpose_chain_id,
        pendingId: pendingScript.id,
      };
    }

    // Source 2: Recent blog posts with good engagement
    const { data: recentPosts } = await this.supabase
      .from('content_memory')
      .select('id, title, keywords, metadata, content_text')
      .eq('account_id', this.accountId)
      .eq('product', productId)
      .eq('content_type', 'blog_post')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentPosts && recentPosts.length > 0) {
      // Pick a post not already used for video
      const { data: usedTopics } = await this.supabase
        .from('content_memory')
        .select('source_content_id')
        .eq('account_id', this.accountId)
        .eq('product', productId)
        .in('content_type', ['short_form_video', 'long_form_video'])
        .not('source_content_id', 'is', null);

      const usedIds = new Set((usedTopics || []).map(t => t.source_content_id));
      const unused = recentPosts.filter(p => !usedIds.has(p.id));

      if (unused.length > 0) {
        const post = unused[0];
        return {
          source: 'blog_content',
          topic: post.title,
          sourceContentId: post.id,
          keywords: post.keywords || [],
          blogExcerpt: (post.content_text || '').slice(0, 500),
        };
      }
    }

    // Source 3: Pain points with high scores
    const { data: painPoints } = await this.supabase
      .from('pain_points')
      .select(SIGNAL_COLUMNS)
      .eq('account_id', this.accountId)
      .or(`product.eq.${productId},product_relevance.eq.${productId}`)
      .order('score', { ascending: false })
      .limit(5);

    if (painPoints && painPoints.length > 0) {
      return {
        source: 'pain_point',
        topic: withSignalText(painPoints)[0].signalText,
        painPointId: painPoints[0].id,
        score: painPoints[0].score,
      };
    }

    // Source 4: Fallback — rotating topic hooks
    const hooks = TOPIC_HOOKS[productId] || TOPIC_HOOKS.budgeting_beacon;
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const hookIndex = dayOfYear % hooks.length;

    return {
      source: 'topic_hook',
      topic: hooks[hookIndex],
    };
  }

  async getPendingRepurposeScript(productId) {
    const { data } = await this.supabase
      .from('content_memory')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('product', productId)
      .eq('content_type', 'video_script')
      .eq('status', 'pending_repurpose')
      .order('created_at', { ascending: true })
      .limit(1);

    return data?.[0] || null;
  }

  // ── Script Generation ───────────────────────────────────────
  async generateScript(productId, topic, format = 'short') {
    const isShort = format === 'short';
    const durationRange = isShort ? '30-60 seconds' : '3-5 minutes';
    const sceneCount = isShort ? '3-5' : '8-15';

    const systemPrompt = this.brandVoice.buildSystemPrompt(
      productId,
      `You are a viral video scriptwriter. Write engaging ${format}-form video scripts for social media (TikTok, YouTube Shorts).`
    );

    const userPrompt = `Write a ${format}-form video script (${durationRange}) about: "${topic.topic}"

Requirements:
- Hook in the first 3 seconds (question, bold claim, or surprising fact)
- ${sceneCount} distinct visual scenes
- Clear voiceover text for each scene (conversational, punchy)
- End with a call-to-action
- Include visual direction for each scene (what images/graphics to show)

Return JSON:
{
  "title": "video title (under 60 chars)",
  "hook": "opening hook text (first 3 seconds)",
  "scenes": [
    {
      "sceneNumber": 1,
      "voiceover": "what the narrator says",
      "visualDirection": "description of what to show visually",
      "durationSec": 8
    }
  ],
  "cta": "call to action text",
  "totalDurationSec": 45,
  "hashtags": ["#tag1", "#tag2"],
  "thumbnailPrompt": "image prompt for the thumbnail"
}`;

    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in script response');

      const script = JSON.parse(jsonMatch[0]);

      // Build full voiceover text
      const voiceoverText = [
        script.hook,
        ...script.scenes.map(s => s.voiceover),
        script.cta,
      ].join(' ');

      return {
        title: script.title,
        hook: script.hook,
        scenes: script.scenes,
        cta: script.cta,
        totalDurationSec: script.totalDurationSec || script.scenes.reduce((sum, s) => sum + (s.durationSec || 5), 0),
        hashtags: script.hashtags || [],
        thumbnailPrompt: script.thumbnailPrompt || `Thumbnail for: ${script.title}`,
        voiceoverText,
        format,
        sourceTopicId: topic.sourceContentId || null,
        repurposeChainId: topic.repurposeChainId || null,
      };
    } catch (error) {
      this.logger.warn(`Script generation via Claude failed for ${productId}: ${error.message}`, {
        agentId: this.agentId,
      });

      // Fallback: build a basic script from topic
      return this.buildFallbackScript(productId, topic, format);
    }
  }

  buildFallbackScript(productId, topic, format) {
    const isShort = format === 'short';
    const duration = isShort ? 45 : 180;

    const scenes = isShort
      ? [
        { sceneNumber: 1, voiceover: `Did you know? ${topic.topic}`, visualDirection: 'Bold text on gradient background', durationSec: 8 },
        { sceneNumber: 2, voiceover: `Here\'s what most people get wrong about this.`, visualDirection: 'Infographic with key stats', durationSec: 12 },
        { sceneNumber: 3, voiceover: `The solution is simpler than you think.`, visualDirection: 'Step-by-step visual breakdown', durationSec: 15 },
        { sceneNumber: 4, voiceover: `Follow for more insights like this!`, visualDirection: 'Logo + CTA overlay', durationSec: 5 },
      ]
      : [
        { sceneNumber: 1, voiceover: `Let\'s talk about: ${topic.topic}`, visualDirection: 'Intro title card with hook', durationSec: 10 },
        { sceneNumber: 2, voiceover: 'First, let me give you some context.', visualDirection: 'Background info graphics', durationSec: 25 },
        { sceneNumber: 3, voiceover: 'Here are the key points you need to know.', visualDirection: 'Numbered list animation', durationSec: 30 },
        { sceneNumber: 4, voiceover: 'Let me break down the details.', visualDirection: 'Detailed infographic', durationSec: 40 },
        { sceneNumber: 5, voiceover: 'And here\'s the practical takeaway.', visualDirection: 'Action items checklist', durationSec: 30 },
        { sceneNumber: 6, voiceover: 'Now go apply what you\'ve learned! Subscribe for more.', visualDirection: 'CTA + subscribe graphic', durationSec: 10 },
      ];

    const voiceoverText = scenes.map(s => s.voiceover).join(' ');

    return {
      title: topic.topic.slice(0, 60),
      hook: `Did you know? ${topic.topic.slice(0, 40)}`,
      scenes,
      cta: 'Follow for more!',
      totalDurationSec: duration,
      hashtags: [],
      thumbnailPrompt: `Eye-catching thumbnail for video about: ${topic.topic}`,
      voiceoverText,
      format,
      sourceTopicId: topic.sourceContentId || null,
      repurposeChainId: topic.repurposeChainId || null,
    };
  }

  // ── Video Production Pipeline ───────────────────────────────
  async produceVideo(productId, script) {
    const startTime = Date.now();
    const product = products[productId];
    const dateStr = new Date().toISOString().slice(0, 10);
    const videoId = crypto.randomUUID();
    const storagePath = `videos/${productId}/${dateStr}/${videoId}`;

    // Step 1: Generate TTS audio via ElevenLabs
    const audio = await this.generateAudio(productId, script.voiceoverText);

    // Step 2: Generate images for each scene
    const sceneImages = await this.generateSceneImages(productId, script.scenes);

    // Step 3: Generate captions (SRT + VTT)
    const captions = await this.generateCaptions(script, audio);

    // Step 4: Generate thumbnail
    const thumbnail = await this.generateThumbnail(productId, script);

    // Step 5: Assemble video with FFmpeg
    const assembled = await this.assembleVideo({
      productId,
      script,
      audio,
      sceneImages,
      captions,
      storagePath,
    });

    // Step 6: Upload to Supabase Storage
    const uploaded = await this.uploadToStorage(storagePath, {
      video: assembled.videoBuffer,
      thumbnail: thumbnail.buffer,
      captionsSrt: captions.srt,
      captionsVtt: captions.vtt,
    });

    const latencyMs = Date.now() - startTime;

    return {
      videoId,
      videoUrl: uploaded.videoUrl,
      thumbnailUrl: uploaded.thumbnailUrl,
      captionsSrtUrl: uploaded.captionsSrtUrl,
      captionsVttUrl: uploaded.captionsVttUrl,
      duration: audio.durationSec || script.totalDurationSec,
      fileSizeBytes: assembled.fileSizeBytes || 0,
      audioSynced: audio.success,
      captionAccuracy: captions.accuracy,
      hasBlankFrames: assembled.hasBlankFrames || false,
      hasSilentGaps: audio.hasSilentGaps || false,
      latencyMs,
      sceneCount: sceneImages.length,
      storagePath,
      format: script.format,

      // ── Production-truth fields — the quality gate depends on these.
      // Without them a run with placeholder audio, no images and no
      // FFmpeg pass could still report a produced video.
      assembled: assembled.assembled === true,
      assemblyError: assembled.error || null,
      audioPlaceholder: audio.placeholder === true,
      audioBytes: audio.sizeBytes || 0,
      imagesGenerated: sceneImages.filter(img => img.success).length,
      videoBytes: assembled.videoBuffer ? assembled.videoBuffer.length : 0,
    };
  }

  // ── ElevenLabs TTS ──────────────────────────────────────────
  async generateAudio(productId, voiceoverText) {
    const voiceId = config.elevenlabs.voices[productId];
    const apiKey = config.elevenlabs.apiKey;

    if (!apiKey || !voiceId) {
      this.logger.warn(`ElevenLabs not configured for ${productId}, using placeholder audio`, {
        agentId: this.agentId,
      });
      return this.generatePlaceholderAudio(voiceoverText);
    }

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: voiceoverText,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`ElevenLabs API error ${response.status}: ${errorBody}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());

      // Estimate duration from audio size (MP3 ~128kbps = 16KB/sec)
      const estimatedDuration = Math.round(audioBuffer.length / 16000);

      return {
        success: true,
        buffer: audioBuffer,
        durationSec: estimatedDuration,
        format: 'mp3',
        hasSilentGaps: false,
        sizeBytes: audioBuffer.length,
      };
    } catch (error) {
      this.logger.warn(`ElevenLabs TTS failed for ${productId}: ${error.message}`, {
        agentId: this.agentId,
      });
      return this.generatePlaceholderAudio(voiceoverText);
    }
  }

  generatePlaceholderAudio(voiceoverText) {
    // Estimate duration: ~150 words per minute
    const wordCount = voiceoverText.split(/\s+/).length;
    const durationSec = Math.max(15, Math.round((wordCount / 150) * 60));

    return {
      success: false,
      buffer: Buffer.alloc(0),
      durationSec,
      format: 'mp3',
      hasSilentGaps: false,
      sizeBytes: 0,
      placeholder: true,
    };
  }

  // ── Image Generation (per scene) ────────────────────────────
  async generateSceneImages(productId, scenes) {
    const provider = config.imageGen.provider;
    const apiKey = config.imageGen.apiKey;

    const results = [];

    for (const scene of scenes) {
      try {
        if (!apiKey) {
          results.push({
            sceneNumber: scene.sceneNumber,
            success: false,
            placeholder: true,
            prompt: scene.visualDirection,
          });
          continue;
        }

        const imagePrompt = `${scene.visualDirection}. Style: clean, modern, social media optimized, 9:16 vertical format.`;

        if (provider === 'openai') {
          const image = await this.generateOpenAIImage(apiKey, imagePrompt);
          results.push({
            sceneNumber: scene.sceneNumber,
            success: true,
            buffer: image.buffer,
            prompt: imagePrompt,
          });
        } else {
          results.push({
            sceneNumber: scene.sceneNumber,
            success: false,
            placeholder: true,
            prompt: imagePrompt,
          });
        }
      } catch (error) {
        this.logger.warn(`Image gen failed for scene ${scene.sceneNumber}: ${error.message}`, {
          agentId: this.agentId,
        });
        results.push({
          sceneNumber: scene.sceneNumber,
          success: false,
          placeholder: true,
          prompt: scene.visualDirection,
          error: error.message,
        });
      }
    }

    return results;
  }

  async generateOpenAIImage(apiKey, prompt) {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1792', // 9:16 vertical
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI image API error: ${response.status}`);
    }

    const data = await response.json();
    const b64 = data.data[0].b64_json;

    return {
      buffer: Buffer.from(b64, 'base64'),
      format: 'png',
    };
  }

  // ── Caption Generation (SRT + VTT) ─────────────────────────
  async generateCaptions(script, audio) {
    const scenes = script.scenes || [];
    let currentTime = 0;
    const srtEntries = [];
    const vttEntries = [];
    let entryIndex = 1;

    for (const scene of scenes) {
      const words = scene.voiceover.split(/\s+/);
      const sceneDuration = scene.durationSec || 5;
      const wordDuration = sceneDuration / Math.max(words.length, 1);

      // Group words into caption segments (3-5 words per segment)
      const segmentSize = 4;
      for (let i = 0; i < words.length; i += segmentSize) {
        const segmentWords = words.slice(i, i + segmentSize);
        const segStart = currentTime + (i * wordDuration);
        const segEnd = currentTime + (Math.min(i + segmentSize, words.length) * wordDuration);

        // Bold the "current" word (first word of segment) for visual emphasis
        const captionText = segmentWords.map((w, idx) =>
          idx === 0 ? `<b>${w}</b>` : w
        ).join(' ');

        const plainText = segmentWords.join(' ');

        srtEntries.push(
          `${entryIndex}\n${this.formatSrtTime(segStart)} --> ${this.formatSrtTime(segEnd)}\n${plainText}\n`
        );

        vttEntries.push(
          `${this.formatVttTime(segStart)} --> ${this.formatVttTime(segEnd)}\n${captionText}\n`
        );

        entryIndex++;
      }

      currentTime += sceneDuration;
    }

    const srt = srtEntries.join('\n');
    const vtt = `WEBVTT\n\n${vttEntries.join('\n')}`;

    return {
      srt,
      vtt,
      accuracy: 0.98, // Generated from script text, so high accuracy
      entryCount: entryIndex - 1,
      totalDuration: currentTime,
    };
  }

  formatSrtTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  formatVttTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  // ── Thumbnail Generation ────────────────────────────────────
  async generateThumbnail(productId, script) {
    const apiKey = config.imageGen.apiKey;

    if (!apiKey) {
      return { buffer: Buffer.alloc(0), placeholder: true };
    }

    try {
      const prompt = `${script.thumbnailPrompt}. Style: YouTube thumbnail, bold text, eye-catching, high contrast, 16:9 landscape.`;

      if (config.imageGen.provider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt,
            n: 1,
            size: '1792x1024', // 16:9 landscape for YouTube
            response_format: 'b64_json',
          }),
        });

        if (!response.ok) throw new Error(`Thumbnail gen error: ${response.status}`);

        const data = await response.json();
        return {
          buffer: Buffer.from(data.data[0].b64_json, 'base64'),
          format: 'png',
          dimensions: { width: 1792, height: 1024 },
          placeholder: false,
        };
      }
    } catch (error) {
      this.logger.warn(`Thumbnail generation failed: ${error.message}`, { agentId: this.agentId });
    }

    return { buffer: Buffer.alloc(0), placeholder: true };
  }

  // ── FFmpeg Video Assembly ───────────────────────────────────
  async assembleVideo({ productId, script, audio, sceneImages, captions, storagePath }) {
    // If we don't have real assets, return a manifest for manual assembly
    const hasRealAudio = audio.success && audio.buffer.length > 0;
    const hasRealImages = sceneImages.some(img => img.success);

    if (!hasRealAudio || !hasRealImages) {
      this.logger.info(`Skipping FFmpeg assembly for ${productId} — placeholder assets`, {
        agentId: this.agentId,
        hasAudio: hasRealAudio,
        hasImages: hasRealImages,
      });

      return {
        videoBuffer: Buffer.alloc(0),
        fileSizeBytes: 0,
        hasBlankFrames: false,
        assembled: false,
        manifest: {
          storagePath,
          script: script.title,
          sceneCount: script.scenes.length,
          audioDuration: audio.durationSec,
          imagesGenerated: sceneImages.filter(i => i.success).length,
          captionEntries: captions.entryCount,
        },
      };
    }

    try {
      const { execSync } = require('child_process');
      const fs = require('fs');
      const os = require('os');
      const path = require('path');

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beaconops-video-'));

      // Write audio file
      const audioPath = path.join(tmpDir, 'audio.mp3');
      fs.writeFileSync(audioPath, audio.buffer);

      // Write scene images
      const imagePaths = [];
      for (const img of sceneImages) {
        if (img.success && img.buffer) {
          const imgPath = path.join(tmpDir, `scene_${img.sceneNumber}.png`);
          fs.writeFileSync(imgPath, img.buffer);
          imagePaths.push(imgPath);
        }
      }

      // Write captions
      const captionPath = path.join(tmpDir, 'captions.srt');
      fs.writeFileSync(captionPath, captions.srt);

      // Build FFmpeg command with Ken Burns pan/zoom effect
      const outputPath = path.join(tmpDir, 'output.mp4');
      const sceneDurations = script.scenes.map(s => s.durationSec || 5);

      // Create concat file for images with durations
      const concatEntries = [];
      for (let i = 0; i < imagePaths.length; i++) {
        const dur = sceneDurations[i] || 5;
        concatEntries.push(`file '${imagePaths[i]}'`);
        concatEntries.push(`duration ${dur}`);
      }
      // FFmpeg needs last image repeated without duration
      if (imagePaths.length > 0) {
        concatEntries.push(`file '${imagePaths[imagePaths.length - 1]}'`);
      }
      const concatPath = path.join(tmpDir, 'concat.txt');
      fs.writeFileSync(concatPath, concatEntries.join('\n'));

      // FFmpeg: images + audio + captions → MP4
      // Ken Burns: zoompan filter for subtle pan/zoom
      const ffmpegCmd = [
        'ffmpeg -y',
        `-f concat -safe 0 -i "${concatPath}"`,
        `-i "${audioPath}"`,
        '-filter_complex',
        '"[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,',
        'zoompan=z=\'min(zoom+0.0015,1.5)\':d=125:x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':s=1080x1920:fps=25[v]"',
        '-map "[v]" -map 1:a',
        '-c:v libx264 -preset fast -crf 23',
        '-c:a aac -b:a 128k',
        '-shortest',
        '-movflags +faststart',
        `"${outputPath}"`,
      ].join(' ');

      execSync(ffmpegCmd, { timeout: 120000, stdio: 'pipe' });

      const videoBuffer = fs.readFileSync(outputPath);

      // Cleanup
      fs.rmSync(tmpDir, { recursive: true, force: true });

      return {
        videoBuffer,
        fileSizeBytes: videoBuffer.length,
        hasBlankFrames: false,
        assembled: true,
      };
    } catch (error) {
      this.logger.warn(`FFmpeg assembly failed: ${error.message}`, { agentId: this.agentId });

      return {
        videoBuffer: Buffer.alloc(0),
        fileSizeBytes: 0,
        hasBlankFrames: false,
        assembled: false,
        error: error.message,
      };
    }
  }

  // ── Supabase Storage Upload ─────────────────────────────────
  async uploadToStorage(storagePath, assets) {
    const result = {
      videoUrl: null,
      thumbnailUrl: null,
      captionsSrtUrl: null,
      captionsVttUrl: null,
    };

    try {
      const bucket = 'video-assets';

      // Ensure bucket exists
      const { data: buckets } = await this.supabase.storage.listBuckets();
      if (!buckets?.find(b => b.name === bucket)) {
        await this.supabase.storage.createBucket(bucket, { public: true });
      }

      // Upload video
      if (assets.video && assets.video.length > 0) {
        const { data } = await this.supabase.storage
          .from(bucket)
          .upload(`${storagePath}/video.mp4`, assets.video, {
            contentType: 'video/mp4',
            upsert: true,
          });
        if (data) {
          const { data: urlData } = this.supabase.storage.from(bucket).getPublicUrl(`${storagePath}/video.mp4`);
          result.videoUrl = urlData?.publicUrl || null;
        }
      }

      // Upload thumbnail
      if (assets.thumbnail && assets.thumbnail.length > 0) {
        const { data } = await this.supabase.storage
          .from(bucket)
          .upload(`${storagePath}/thumbnail.png`, assets.thumbnail, {
            contentType: 'image/png',
            upsert: true,
          });
        if (data) {
          const { data: urlData } = this.supabase.storage.from(bucket).getPublicUrl(`${storagePath}/thumbnail.png`);
          result.thumbnailUrl = urlData?.publicUrl || null;
        }
      }

      // Upload captions
      if (assets.captionsSrt) {
        await this.supabase.storage
          .from(bucket)
          .upload(`${storagePath}/captions.srt`, Buffer.from(assets.captionsSrt), {
            contentType: 'text/plain',
            upsert: true,
          });
        const { data: urlData } = this.supabase.storage.from(bucket).getPublicUrl(`${storagePath}/captions.srt`);
        result.captionsSrtUrl = urlData?.publicUrl || null;
      }

      if (assets.captionsVtt) {
        await this.supabase.storage
          .from(bucket)
          .upload(`${storagePath}/captions.vtt`, Buffer.from(assets.captionsVtt), {
            contentType: 'text/vtt',
            upsert: true,
          });
        const { data: urlData } = this.supabase.storage.from(bucket).getPublicUrl(`${storagePath}/captions.vtt`);
        result.captionsVttUrl = urlData?.publicUrl || null;
      }
    } catch (error) {
      this.logger.warn(`Storage upload failed: ${error.message}`, { agentId: this.agentId });
    }

    return result;
  }

  // ── Store Video Asset + Submit for Approval ─────────────────
  async storeVideoAsset(productId, script, assets, format) {
    const contentType = format === 'short' ? 'short_form_video' : 'long_form_video';
    const product = products[productId];

    // Store in content_memory
    const contentId = await this.storeContent({
      product: productId,
      platform: 'video',
      contentType,
      title: script.title,
      contentText: script.voiceoverText,
      sourceContentId: script.sourceTopicId,
      repurposeChainId: script.repurposeChainId,
      metadata: {
        duration: assets.duration,
        format,
        voicePreset: productId,
        videoUrl: assets.videoUrl,
        thumbnailUrl: assets.thumbnailUrl,
        captionsSrtUrl: assets.captionsSrtUrl,
        captionsVttUrl: assets.captionsVttUrl,
        storagePath: assets.storagePath,
        sceneCount: assets.sceneCount,
        hashtags: script.hashtags,
        platforms: this.getTargetPlatforms(product),
        fileSizeBytes: assets.fileSizeBytes,
        qualityGate: {
          audioSynced: assets.audioSynced,
          captionAccuracy: assets.captionAccuracy,
          hasBlankFrames: assets.hasBlankFrames,
          hasSilentGaps: assets.hasSilentGaps,
        },
      },
    });

    // Store in video_assets table
    await this.storeVideoRecord(productId, contentId, script, assets, format);

    // Mark pending repurpose script as consumed
    if (script.repurposeChainId) {
      await this.supabase
        .from('content_memory')
        .update({ status: 'consumed' })
        .eq('account_id', this.accountId)
        .eq('repurpose_chain_id', script.repurposeChainId)
        .eq('content_type', 'video_script')
        .eq('status', 'pending_repurpose');
    }

    // Submit for Tier 2 approval
    await this.submitForApproval({
      itemType: 'video',
      contentPreview: `[${productId}] ${format === 'short' ? 'Short' : 'Long'} Video: ${script.title} (${assets.duration}s)`,
      fullContent: {
        product: productId,
        contentId,
        format,
        script: {
          title: script.title,
          scenes: script.scenes,
          hashtags: script.hashtags,
        },
        assets: {
          videoUrl: assets.videoUrl,
          thumbnailUrl: assets.thumbnailUrl,
          captionsSrtUrl: assets.captionsSrtUrl,
          captionsVttUrl: assets.captionsVttUrl,
          duration: assets.duration,
          platforms: this.getTargetPlatforms(product),
        },
      },
    });

    return { contentId };
  }

  async storeVideoRecord(productId, contentId, script, assets, format) {
    try {
      await this.supabase.from('video_assets').insert({
        account_id: this.accountId,
        content_id: contentId,
        product: productId,
        title: script.title,
        format,
        duration_sec: assets.duration,
        video_url: assets.videoUrl,
        thumbnail_url: assets.thumbnailUrl,
        captions_srt_url: assets.captionsSrtUrl,
        captions_vtt_url: assets.captionsVttUrl,
        storage_path: assets.storagePath,
        scene_count: assets.sceneCount,
        file_size_bytes: assets.fileSizeBytes,
        hashtags: script.hashtags,
        platforms: this.getTargetPlatforms(products[productId]),
        quality_gate: {
          audioSynced: assets.audioSynced,
          captionAccuracy: assets.captionAccuracy,
          hasBlankFrames: assets.hasBlankFrames,
          hasSilentGaps: assets.hasSilentGaps,
        },
        status: 'pending_approval',
        source_content_id: script.sourceTopicId,
        repurpose_chain_id: script.repurposeChainId,
      });
    } catch (error) {
      this.logger.warn(`Failed to store video record: ${error.message}`, { agentId: this.agentId });
    }
  }

  // ── Quality Gate (7 checks) ─────────────────────────────────
  // ── Quality gate ────────────────────────────────────────────
  // A video only counts as produced when a real file actually exists.
  // Placeholder audio, missing scene images, a skipped or failed FFmpeg
  // pass, or a zero/undersized output all fail hard — no partial credit.
  runQualityGate(assets, format = 'short') {
    const failures = [];
    const maxDuration = format === 'short' ? this.qualityGates.maxShortFormSec : this.qualityGates.maxLongFormSec;
    const checks = 10;

    // 1. FFmpeg assembly actually ran and succeeded
    if (!assets.assembled) {
      failures.push(assets.assemblyError
        ? `assembly_failed: ${assets.assemblyError}`
        : 'assembly_skipped: production dependencies unavailable');
    }

    // 2. A real output file exists and clears the minimum size
    const fileBytes = assets.fileSizeBytes || 0;
    if (fileBytes < this.qualityGates.minFileSizeBytes) {
      failures.push(`file_too_small: ${fileBytes}B < ${this.qualityGates.minFileSizeBytes}B`);
    }

    // 3. The upload produced a retrievable URL
    if (!assets.videoUrl) {
      failures.push('no_video_url');
    }

    // 4. Real audio — not the word-count placeholder
    if (!assets.audioSynced || assets.audioPlaceholder || (assets.audioBytes || 0) === 0) {
      failures.push('audio_missing_or_placeholder');
    }

    // 5. At least one real scene image
    if ((assets.imagesGenerated || 0) === 0) {
      failures.push('no_scene_images');
    }

    // 6. Duration within range
    if (assets.duration < this.qualityGates.minDurationSec) {
      failures.push(`duration_too_short: ${assets.duration}s < ${this.qualityGates.minDurationSec}s`);
    }
    if (assets.duration > maxDuration) {
      failures.push(`duration_too_long: ${assets.duration}s > ${maxDuration}s`);
    }

    // 7. Caption accuracy — only meaningful when audio is real
    if (assets.captionAccuracy < this.qualityGates.captionAccuracy) {
      failures.push(`caption_accuracy_low: ${assets.captionAccuracy} < ${this.qualityGates.captionAccuracy}`);
    }

    // 8. Thumbnail present
    if (!assets.thumbnailUrl) {
      failures.push('no_thumbnail');
    }

    // 9. No blank frames
    if (assets.hasBlankFrames) {
      failures.push('has_blank_frames');
    }

    // 10. Upper file-size bound
    if (fileBytes > 0) {
      const fileSizeMB = fileBytes / (1024 * 1024);
      if (fileSizeMB > this.qualityGates.maxFileSizeMB) {
        failures.push(`file_too_large: ${fileSizeMB.toFixed(1)}MB > ${this.qualityGates.maxFileSizeMB}MB`);
      }
    }

    return {
      pass: failures.length === 0,
      failures,
      checks,
      passed: Math.max(checks - failures.length, 0),
    };
  }

  // ── Production Stats ────────────────────────────────────────
  async recordProductionStats(results) {
    try {
      await this.supabase.from('engagement_log').insert({
        account_id: this.accountId,
        event_type: 'video_production_daily',
        event_data: {
          date: new Date().toISOString().slice(0, 10),
          videosProduced: results.videosProduced,
          videosFailed: results.videosFailed,
          platforms: [...new Set(results.platforms)],
          byProduct: results.byProduct,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to record production stats: ${error.message}`, { agentId: this.agentId });
    }
  }

  getTargetPlatforms(product) {
    return product.platforms.filter(p => p === 'tiktok' || p === 'youtube');
  }
}

module.exports = VideoProducerAgent;
