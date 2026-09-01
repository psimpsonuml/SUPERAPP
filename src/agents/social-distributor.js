const https = require('https');
const Anthropic = require('@anthropic-ai/sdk');
const BaseAgent = require('./base-agent');
const products = require('../config/products');
const AnalyticsPipeline = require('../shared/analytics');

// Default posting schedule (ET hours)
const DEFAULT_SCHEDULE = {
  linkedin: 8,
  reddit: 10,
  facebook: 12,
  instagram: 14,
  discord: 16,
};

// Per-platform rate limits
const RATE_LIMITS = {
  reddit: { maxPerSubredditPerDay: 1, cooldownMinutes: 10, maxPerDay: 20 },
  facebook: { maxPerPagePerDay: 3 },
  instagram: { maxPerDay: 2 },
  linkedin: { maxPerDay: 1 },
  discord: { maxPerDay: 5 },
};

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

    this.anthropic = new Anthropic();
    this.analytics = new AnalyticsPipeline(accountId);

    this.platformRules = {
      reddit: {
        maxPerSubreddit: 1, cooldownMinutes: 10,
        tone: 'Authentic, value-first, not salesy', format: 'text',
      },
      facebook: {
        maxPerPage: 3,
        tone: 'Slightly more casual, visual-first', format: 'image_caption',
      },
      instagram: {
        maxPerDay: 2,
        tone: 'Visual-first, hashtag optimized', format: 'carousel',
      },
      linkedin: {
        maxPerDay: 1,
        tone: 'Thought leadership, professional insight', format: 'professional_insight',
      },
      discord: {
        products: ['chronostates'], maxPerDay: 5,
        tone: 'Community member, conversational', format: 'conversational',
      },
    };
  }

  // ── Main run — called at 7:30 AM ET ─────────────────────
  async run() {
    const results = {
      postsScheduled: 0,
      postsQueued: 0,
      platforms: {},
      shadowbanWarnings: [],
      engagementUpdates: 0,
    };

    // Step 1: Pull engagement metrics for posts published ~24h ago
    results.engagementUpdates = await this.pullEngagementMetrics();

    // Step 2: Check for shadowban signals
    results.shadowbanWarnings = await this.detectShadowbans();

    // Step 3: Pull today's calendar entries
    const today = new Date().toISOString().slice(0, 10);
    const { data: calendarEntries } = await this.supabase
      .from('content_calendar')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('date', today)
      .in('platform', ['reddit', 'facebook', 'instagram', 'linkedin', 'discord'])
      .in('status', ['scheduled', 'approved']);

    if (!calendarEntries || calendarEntries.length === 0) {
      this.logger.info('No social posts scheduled for today', { agentId: this.agentId });
      return results;
    }

    // Step 4: Check connected accounts
    const connections = await this.getConnectedAccounts();

    // Step 5: Get today's existing post counts for rate limiting
    const todayPostCounts = await this.getTodayPostCounts();

    // Step 6: Process each calendar entry
    for (const entry of calendarEntries) {
      const platform = entry.platform;
      const productId = entry.product;

      // Skip discord for non-chronostates
      if (platform === 'discord' && productId !== 'chronostates') continue;

      // Check connection status
      const connection = connections.find(
        c => c.platform === platform && (c.product === productId || !c.product)
      );

      if (!connection || connection.status !== 'connected') {
        this.logger.warn(`Skipping ${platform} — not connected`, {
          agentId: this.agentId, platform, product: productId,
        });
        continue;
      }

      // Rate limit check
      if (this.isRateLimited(platform, productId, todayPostCounts)) {
        this.logger.info(`Rate limited on ${platform}`, { agentId: this.agentId, platform });
        continue;
      }

      try {
        // Load community rules if available
        const communityRules = await this.loadCommunityRules(entry.community_id);

        // Load brand voice
        const brandProfile = await this.brandVoice.getProfile(productId);

        // Check for existing draft from repurposing chain
        const draft = await this.loadRepurposeDraft(productId, platform, entry);

        // Generate or adapt content for this platform
        const post = await this.generatePlatformPost(
          productId, platform, entry, brandProfile, communityRules, draft
        );

        // Compute scheduled time
        const scheduledTime = this.computeScheduledTime(platform, entry);

        // Log to social_post_log
        const postLogId = await this.createPostLog({
          product: productId,
          platform,
          postType: post.format,
          contentPreview: (post.text || '').slice(0, 280),
          fullContent: post,
          calendarEntryId: entry.id,
          scheduledFor: scheduledTime,
          status: 'queued',
        });

        // Submit for Tier 2 approval with platform preview
        const approvalResult = await this.submitForApproval({
          itemType: 'social_post',
          tier: 2,
          contentPreview: this.buildApprovalPreview(productId, platform, post),
          fullContent: {
            product: productId,
            platform,
            post,
            postLogId,
            calendarEntryId: entry.id,
            scheduledTime,
            communityRules: communityRules?.rules_json?.parsed?.summary || null,
            connectionId: connection.id,
          },
        });

        // Update post log with approval item ID
        await this.supabase
          .from('social_post_log')
          .update({
            approval_item_id: approvalResult.id,
            status: approvalResult.autoApproved ? 'scheduled' : 'queued',
          })
          .eq('id', postLogId);

        // Track counts
        todayPostCounts[platform] = (todayPostCounts[platform] || 0) + 1;
        results.postsQueued++;
        results.platforms[platform] = (results.platforms[platform] || 0) + 1;

        // Mark calendar entry as processing
        // content_calendar.status has no 'processing' value in its CHECK
        // constraint — the row stays 'scheduled' until it actually posts.
        await this.supabase
          .from('content_calendar')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', entry.id);

      } catch (err) {
        this.logger.warn(`Failed to prepare ${platform} post for ${productId}`, {
          error: err.message, agentId: this.agentId,
        });
      }
    }

    results.postsScheduled = results.postsQueued;
    return results;
  }

  // ── Platform post generation ────────────────────────────
  async generatePlatformPost(productId, platform, entry, brandProfile, communityRules, existingDraft) {
    const product = products[productId];
    const rules = this.platformRules[platform];

    // If we have a draft from the repurposing chain, adapt it
    const sourceContent = existingDraft?.content_text || entry.content_theme || '';

    const voicePrompt = this.brandVoice.buildSystemPrompt(
      productId,
      `Create a ${platform} post. Tone: ${rules.tone}. Format: ${rules.format}`
    );

    const platformInstructions = this.getPlatformInstructions(platform, communityRules);
    const hashtags = this.brandVoice.getHashtags(
      productId,
      platform === 'instagram' ? 8 : platform === 'linkedin' ? 0 : 3
    );

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: voicePrompt,
        messages: [{
          role: 'user',
          content: `Create a ${platform} post for ${product.name}.

Content theme/source: ${sourceContent || entry.content_theme || 'Latest product update'}
Post type from calendar: ${entry.post_type}

${platformInstructions}

${communityRules ? `Community rules summary: ${communityRules.rules_json?.parsed?.summary || 'None available'}` : ''}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "text": "The full post text ready to publish",
  "title": ${platform === 'reddit' ? '"Reddit post title"' : 'null'},
  "hashtags": ${platform === 'linkedin' ? '[]' : JSON.stringify(hashtags)},
  "imagePrompt": ${['facebook', 'instagram'].includes(platform) ? '"AI image generation prompt for the visual"' : 'null'},
  "flair": ${platform === 'reddit' && communityRules?.rules_json?.parsed?.flair_requirements?.length ? '"suggested flair"' : 'null'},
  "embedTitle": ${platform === 'discord' ? '"Discord embed title"' : 'null'},
  "embedDescription": ${platform === 'discord' ? '"Discord embed description"' : 'null'}
}`,
        }],
      });

      const text = (response.content[0]?.text || '').trim();
      const parsed = JSON.parse(text);

      return {
        text: parsed.text || '',
        title: parsed.title || null,
        hashtags: parsed.hashtags || hashtags,
        imagePrompt: parsed.imagePrompt || null,
        flair: parsed.flair || null,
        embedTitle: parsed.embedTitle || null,
        embedDescription: parsed.embedDescription || null,
        format: rules.format,
        platform,
        product: productId,
      };
    } catch (err) {
      this.logger.warn(`Post generation failed for ${platform}/${productId}`, { error: err.message });
      // Fallback: use source content directly
      return {
        text: sourceContent || `[Post for ${product.name} on ${platform}]`,
        title: platform === 'reddit' ? entry.content_theme : null,
        hashtags,
        imagePrompt: null,
        flair: null,
        embedTitle: platform === 'discord' ? entry.content_theme : null,
        embedDescription: null,
        format: rules.format,
        platform,
        product: productId,
      };
    }
  }

  getPlatformInstructions(platform, communityRules) {
    const instructions = {
      reddit: `Reddit rules:
- Write a text post with enough context to stand alone
- Title must be informative and match subreddit conventions
- Never use clickbait or salesy language
- ${communityRules?.rules_json?.parsed?.flair_requirements?.length ? `Required flair options: ${communityRules.rules_json.parsed.flair_requirements.join(', ')}` : 'No flair requirements known'}
- ${communityRules?.rules_json?.parsed?.link_restrictions === 'text_only' ? 'TEXT ONLY — no links allowed' : 'Links allowed in body'}
- If self-promotion rules exist, keep the ratio appropriate`,

      facebook: `Facebook Page rules:
- Write an engaging caption for an image or video post
- Keep it conversational and engaging
- Include a call to action or question
- No excessive hashtags (1-3 max)`,

      instagram: `Instagram rules:
- Write a caption for a carousel or single image post
- First line is the hook — must grab attention
- Include 5-8 relevant hashtags at the end
- Use line breaks for readability
- Include a call to action`,

      linkedin: `LinkedIn rules:
- Write a professional insight post
- Lead with a thought-provoking hook
- NO hashtags or minimal (0-2 max)
- Use short paragraphs and line breaks
- Position as thought leadership, not promotion
- End with a question to drive comments`,

      discord: `Discord rules:
- Write a conversational message
- Include an embed with title and description
- Keep it casual and community-appropriate
- No corporate speak
- Can include emojis naturally`,
    };

    return instructions[platform] || '';
  }

  // ── Approval preview formatting ─────────────────────────
  buildApprovalPreview(productId, platform, post) {
    const productName = products[productId]?.name || productId;
    const platformEmoji = {
      reddit: 'Reddit', facebook: 'Facebook', instagram: 'Instagram',
      linkedin: 'LinkedIn', discord: 'Discord',
    };

    let preview = `[${productName}] ${platformEmoji[platform] || platform}\n`;

    if (platform === 'reddit') {
      preview += `Title: ${post.title || '(untitled)'}\n`;
      preview += `Flair: ${post.flair || 'None'}\n`;
    }

    preview += `---\n${(post.text || '').slice(0, 200)}`;

    if (post.hashtags?.length > 0) {
      preview += `\n\nHashtags: ${post.hashtags.join(' ')}`;
    }

    if (post.imagePrompt) {
      preview += `\n\n[Image: ${post.imagePrompt.slice(0, 80)}...]`;
    }

    return preview;
  }

  // ── Platform API posting methods ────────────────────────

  async postToReddit(connection, post) {
    const { credentials_json: creds } = connection;
    const token = await this.getRedditAccessToken(creds);

    const subreddit = post.subreddit || connection.metadata?.default_subreddit;
    if (!subreddit) throw new Error('No subreddit specified');

    const body = new URLSearchParams({
      sr: subreddit,
      kind: 'self',
      title: post.title || 'Untitled',
      text: post.text,
      ...(post.flair ? { flair_text: post.flair } : {}),
    });

    const result = await this.httpsPost('oauth.reddit.com', '/api/submit', body.toString(), {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'BeaconOps/2.0 SocialDistributor',
    });

    const parsed = JSON.parse(result);
    const postUrl = parsed?.json?.data?.url || null;
    const postId = parsed?.json?.data?.id || null;

    return { platformPostId: postId, platformPostUrl: postUrl };
  }

  async getRedditAccessToken(creds) {
    const clientId = creds.client_id || process.env.REDDIT_CLIENT_ID;
    const clientSecret = creds.client_secret || process.env.REDDIT_CLIENT_SECRET;
    const username = creds.username || process.env.REDDIT_USERNAME;
    const password = creds.password || process.env.REDDIT_PASSWORD;

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'password',
      username,
      password,
    });

    const result = await this.httpsPost('www.reddit.com', '/api/v1/access_token', body.toString(), {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'BeaconOps/2.0 SocialDistributor',
    });

    const parsed = JSON.parse(result);
    if (!parsed.access_token) throw new Error(`Reddit auth failed: ${parsed.error || 'unknown'}`);
    return parsed.access_token;
  }

  async postToFacebook(connection, post) {
    const pageAccessToken = connection.credentials_json?.page_access_token
      || process.env.FB_PAGE_ACCESS_TOKEN;
    const pageId = connection.credentials_json?.page_id
      || connection.platform_user_id;

    if (!pageAccessToken || !pageId) throw new Error('Facebook page not configured');

    const body = JSON.stringify({
      message: post.text,
      access_token: pageAccessToken,
    });

    const result = await this.httpsPost(
      'graph.facebook.com', `/v19.0/${pageId}/feed`, body,
      { 'Content-Type': 'application/json' }
    );

    const parsed = JSON.parse(result);
    if (parsed.error) throw new Error(`Facebook API error: ${parsed.error.message}`);

    return {
      platformPostId: parsed.id,
      platformPostUrl: `https://facebook.com/${parsed.id}`,
    };
  }

  async postToInstagram(connection, post) {
    const accessToken = connection.credentials_json?.page_access_token
      || process.env.FB_PAGE_ACCESS_TOKEN;
    const igUserId = connection.credentials_json?.ig_user_id
      || connection.platform_user_id;

    if (!accessToken || !igUserId) throw new Error('Instagram business account not configured');

    // Instagram requires image_url — for now log the need
    const caption = post.hashtags?.length > 0
      ? `${post.text}\n\n${post.hashtags.join(' ')}`
      : post.text;

    // Step 1: Create media container
    const containerBody = JSON.stringify({
      caption,
      image_url: post.imageUrl || 'https://placeholder.com/img.jpg',
      access_token: accessToken,
    });

    const containerResult = await this.httpsPost(
      'graph.facebook.com', `/v19.0/${igUserId}/media`, containerBody,
      { 'Content-Type': 'application/json' }
    );

    const container = JSON.parse(containerResult);
    if (container.error) throw new Error(`Instagram container error: ${container.error.message}`);

    // Step 2: Publish
    const publishBody = JSON.stringify({
      creation_id: container.id,
      access_token: accessToken,
    });

    const publishResult = await this.httpsPost(
      'graph.facebook.com', `/v19.0/${igUserId}/media_publish`, publishBody,
      { 'Content-Type': 'application/json' }
    );

    const published = JSON.parse(publishResult);
    if (published.error) throw new Error(`Instagram publish error: ${published.error.message}`);

    return {
      platformPostId: published.id,
      platformPostUrl: `https://instagram.com/p/${published.id}`,
    };
  }

  async postToLinkedIn(connection, post) {
    const accessToken = connection.credentials_json?.access_token;
    const authorUrn = connection.credentials_json?.author_urn
      || connection.platform_user_id;

    if (!accessToken || !authorUrn) throw new Error('LinkedIn not configured');

    const body = JSON.stringify({
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: post.text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    });

    const result = await this.httpsPost(
      'api.linkedin.com', '/v2/ugcPosts', body,
      {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      }
    );

    const parsed = JSON.parse(result);
    const postId = parsed.id || '';

    return {
      platformPostId: postId,
      platformPostUrl: `https://www.linkedin.com/feed/update/${postId}`,
    };
  }

  async postToDiscord(connection, post) {
    const botToken = connection.credentials_json?.bot_token || process.env.DISCORD_BOT_TOKEN;
    const channelId = connection.credentials_json?.channel_id
      || connection.metadata?.default_channel_id;

    if (!botToken || !channelId) throw new Error('Discord not configured');

    const body = JSON.stringify({
      content: post.text,
      embeds: post.embedTitle ? [{
        title: post.embedTitle,
        description: post.embedDescription || '',
        color: 0x5865F2,
      }] : undefined,
    });

    const result = await this.httpsPost(
      'discord.com', `/api/v10/channels/${channelId}/messages`, body,
      {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      }
    );

    const parsed = JSON.parse(result);
    if (parsed.code) throw new Error(`Discord API error: ${parsed.message || parsed.code}`);

    const guildId = connection.metadata?.guild_id || '';
    return {
      platformPostId: parsed.id,
      platformPostUrl: guildId
        ? `https://discord.com/channels/${guildId}/${channelId}/${parsed.id}`
        : null,
    };
  }

  // ── Execute approved post — called when approval is granted ──
  async executePost(postLogId) {
    const { data: postLog } = await this.supabase
      .from('social_post_log')
      .select('*')
      .eq('id', postLogId)
      .single();

    if (!postLog) throw new Error(`Post log ${postLogId} not found`);
    if (postLog.status === 'published') return { alreadyPublished: true };

    // Update status to posting
    await this.supabase
      .from('social_post_log')
      .update({ status: 'posting', updated_at: new Date().toISOString() })
      .eq('id', postLogId);

    const connection = (await this.getConnectedAccounts()).find(
      c => c.platform === postLog.platform && (c.product === postLog.product || !c.product)
    );

    if (!connection || connection.status !== 'connected') {
      await this.supabase
        .from('social_post_log')
        .update({ status: 'failed', error_message: 'Platform not connected', updated_at: new Date().toISOString() })
        .eq('id', postLogId);
      throw new Error(`${postLog.platform} not connected`);
    }

    const post = postLog.full_content || {};

    try {
      let result;
      switch (postLog.platform) {
        case 'reddit': result = await this.postToReddit(connection, post); break;
        case 'facebook': result = await this.postToFacebook(connection, post); break;
        case 'instagram': result = await this.postToInstagram(connection, post); break;
        case 'linkedin': result = await this.postToLinkedIn(connection, post); break;
        case 'discord': result = await this.postToDiscord(connection, post); break;
        default: throw new Error(`Unsupported platform: ${postLog.platform}`);
      }

      // Update post log with success
      await this.supabase
        .from('social_post_log')
        .update({
          status: 'published',
          platform_post_id: result.platformPostId,
          platform_post_url: result.platformPostUrl,
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', postLogId);

      // Store in content_memory for tracking
      await this.storeContent({
        product: postLog.product,
        platform: postLog.platform,
        contentType: 'social_post',
        title: `[${postLog.platform}] ${(post.title || post.text || '').slice(0, 100)}`,
        contentText: post.text || '',
        metadata: {
          platformPostId: result.platformPostId,
          platformPostUrl: result.platformPostUrl,
          postLogId,
        },
      });

      // Update calendar entry
      if (postLog.calendar_entry_id) {
        await this.supabase
          .from('content_calendar')
          .update({ status: 'posted' })
          .eq('id', postLog.calendar_entry_id);
      }

      return result;
    } catch (err) {
      await this.supabase
        .from('social_post_log')
        .update({
          status: 'failed',
          error_message: err.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', postLogId);
      throw err;
    }
  }

  // ── Engagement tracking — pull 24h metrics ──────────────
  async pullEngagementMetrics() {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 30); // 24-30h window
    const cutoffMin = new Date();
    cutoffMin.setHours(cutoffMin.getHours() - 20); // at least 20h ago

    const { data: posts } = await this.supabase
      .from('social_post_log')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('status', 'published')
      .is('engagement_pulled_at', null)
      .lt('published_at', cutoffMin.toISOString())
      .gt('published_at', cutoff.toISOString())
      .limit(50);

    let updated = 0;

    for (const post of (posts || [])) {
      try {
        const metrics = await this.fetchEngagementMetrics(post);
        if (metrics) {
          const score = this.analytics.computeEngagementScore(metrics);

          await this.supabase
            .from('social_post_log')
            .update({
              likes: metrics.likes || 0,
              comments: metrics.comments || 0,
              shares: metrics.shares || 0,
              impressions: metrics.impressions || 0,
              engagement_score: score,
              engagement_pulled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', post.id);

          // Also update content_memory if linked
          if (post.content_memory_id) {
            await this.analytics.recordEngagement(post.content_memory_id, metrics);
          }

          updated++;
        }
      } catch (err) {
        this.logger.debug(`Engagement pull failed for ${post.id}`, { error: err.message });
      }
    }

    return updated;
  }

  async fetchEngagementMetrics(post) {
    // Platform-specific engagement fetching
    // Returns null if we can't fetch (connection expired, etc.)
    const connection = (await this.getConnectedAccounts()).find(
      c => c.platform === post.platform && (c.product === post.product || !c.product)
    );

    if (!connection || connection.status !== 'connected') return null;
    if (!post.platform_post_id) return null;

    try {
      switch (post.platform) {
        case 'reddit': return await this.fetchRedditEngagement(connection, post.platform_post_id);
        case 'facebook': return await this.fetchFacebookEngagement(connection, post.platform_post_id);
        case 'linkedin': return await this.fetchLinkedInEngagement(connection, post.platform_post_id);
        case 'discord': return { likes: 0, comments: 0, shares: 0, impressions: 0 }; // Discord has no public metrics API
        case 'instagram': return await this.fetchInstagramEngagement(connection, post.platform_post_id);
        default: return null;
      }
    } catch {
      return null;
    }
  }

  async fetchRedditEngagement(connection, postId) {
    const creds = connection.credentials_json;
    const token = await this.getRedditAccessToken(creds);

    const result = await this.httpsGet(
      'oauth.reddit.com', `/api/info?id=t3_${postId}`,
      {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'BeaconOps/2.0 SocialDistributor',
      }
    );

    const parsed = JSON.parse(result);
    const data = parsed?.data?.children?.[0]?.data;
    if (!data) return null;

    return {
      likes: data.ups || 0,
      comments: data.num_comments || 0,
      shares: 0,
      impressions: 0,
    };
  }

  async fetchFacebookEngagement(connection, postId) {
    const token = connection.credentials_json?.page_access_token || process.env.FB_PAGE_ACCESS_TOKEN;
    const result = await this.httpsGet(
      'graph.facebook.com',
      `/v19.0/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${token}`,
      {}
    );

    const parsed = JSON.parse(result);
    return {
      likes: parsed.likes?.summary?.total_count || 0,
      comments: parsed.comments?.summary?.total_count || 0,
      shares: parsed.shares?.count || 0,
      impressions: 0,
    };
  }

  async fetchInstagramEngagement(connection, postId) {
    const token = connection.credentials_json?.page_access_token || process.env.FB_PAGE_ACCESS_TOKEN;
    const result = await this.httpsGet(
      'graph.facebook.com',
      `/v19.0/${postId}?fields=like_count,comments_count&access_token=${token}`,
      {}
    );

    const parsed = JSON.parse(result);
    return {
      likes: parsed.like_count || 0,
      comments: parsed.comments_count || 0,
      shares: 0,
      impressions: 0,
    };
  }

  async fetchLinkedInEngagement(connection, postId) {
    const token = connection.credentials_json?.access_token;
    const result = await this.httpsGet(
      'api.linkedin.com',
      `/v2/socialActions/${encodeURIComponent(postId)}?fields=likes,comments`,
      {
        Authorization: `Bearer ${token}`,
        'X-Restli-Protocol-Version': '2.0.0',
      }
    );

    const parsed = JSON.parse(result);
    return {
      likes: parsed.likesSummary?.totalLikes || 0,
      comments: parsed.commentsSummary?.totalFirstLevelComments || 0,
      shares: 0,
      impressions: 0,
    };
  }

  // ── Shadowban detection ─────────────────────────────────
  async detectShadowbans() {
    const warnings = [];
    const platforms = ['reddit', 'facebook', 'instagram', 'linkedin'];

    for (const platform of platforms) {
      // Get 7-day average engagement
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: recentPosts } = await this.supabase
        .from('social_post_log')
        .select('engagement_score, published_at')
        .eq('account_id', this.accountId)
        .eq('platform', platform)
        .eq('status', 'published')
        .not('engagement_score', 'is', null)
        .gt('engagement_score', 0)
        .gte('published_at', weekAgo.toISOString())
        .order('published_at', { ascending: false });

      if (!recentPosts || recentPosts.length < 3) continue;

      const avgScore = recentPosts.reduce((sum, p) => sum + p.engagement_score, 0) / recentPosts.length;

      // Check most recent post vs average
      const latestScore = recentPosts[0].engagement_score;
      if (avgScore > 0 && latestScore < avgScore * 0.3) {
        // 70%+ drop
        const warning = {
          platform,
          avgEngagement: Math.round(avgScore * 100) / 100,
          latestEngagement: latestScore,
          dropPercent: Math.round((1 - latestScore / avgScore) * 100),
        };
        warnings.push(warning);

        // Create infra alert
        await this.alert(
          'warning',
          `social-${platform}`,
          `Possible shadowban on ${platform}: engagement dropped ${warning.dropPercent}% vs 7-day average`,
          warning
        );
      }
    }

    return warnings;
  }

  // ── Helper methods ──────────────────────────────────────

  async getConnectedAccounts() {
    const { data } = await this.supabase
      .from('social_connections')
      .select('*')
      .eq('account_id', this.accountId);
    return data || [];
  }

  async getTodayPostCounts() {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await this.supabase
      .from('social_post_log')
      .select('platform')
      .eq('account_id', this.accountId)
      .gte('created_at', today)
      .in('status', ['queued', 'scheduled', 'posting', 'published']);

    const counts = {};
    for (const row of (data || [])) {
      counts[row.platform] = (counts[row.platform] || 0) + 1;
    }
    return counts;
  }

  isRateLimited(platform, productId, todayPostCounts) {
    const limits = RATE_LIMITS[platform];
    if (!limits) return false;

    const currentCount = todayPostCounts[platform] || 0;
    const maxPerDay = limits.maxPerDay || limits.maxPerPagePerDay || limits.maxPerSubredditPerDay || 999;
    return currentCount >= maxPerDay;
  }

  async loadCommunityRules(communityId) {
    if (!communityId) return null;
    const { data } = await this.supabase
      .from('community_profiles')
      .select('*')
      .eq('id', communityId)
      .single();
    return data;
  }

  async loadRepurposeDraft(productId, platform, entry) {
    // Check content_memory for pending repurpose drafts
    const { data } = await this.supabase
      .from('content_memory')
      .select('id, title, content_text, metadata')
      .eq('account_id', this.accountId)
      .eq('product', productId)
      .eq('content_type', 'social_posts')
      .eq('status', 'pending_repurpose')
      .limit(1);

    return data?.[0] || null;
  }

  computeScheduledTime(platform, entry) {
    const hour = DEFAULT_SCHEDULE[platform] || 12;
    const today = new Date();
    // Convert to ET by creating date at specific ET hour
    const scheduled = new Date(today.toISOString().slice(0, 10) + 'T00:00:00-05:00');
    scheduled.setHours(scheduled.getHours() + hour);
    return scheduled.toISOString();
  }

  async createPostLog(data) {
    const { data: row, error } = await this.supabase
      .from('social_post_log')
      .insert({
        account_id: this.accountId,
        product: data.product,
        platform: data.platform,
        post_type: data.postType,
        content_preview: data.contentPreview,
        full_content: data.fullContent,
        calendar_entry_id: data.calendarEntryId,
        scheduled_for: data.scheduledFor,
        status: data.status,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create post log: ${error.message}`);
    return row.id;
  }

  // ── HTTP helpers ────────────────────────────────────────
  httpsPost(hostname, path, body, headers = {}) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname, path, method: 'POST',
        headers: {
          'Content-Length': Buffer.byteLength(body),
          ...headers,
        },
        timeout: 15000,
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      req.write(body);
      req.end();
    });
  }

  httpsGet(hostname, path, headers = {}) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname, path, method: 'GET',
        headers: { Accept: 'application/json', ...headers },
        timeout: 10000,
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      req.end();
    });
  }
}

module.exports = SocialDistributorAgent;
