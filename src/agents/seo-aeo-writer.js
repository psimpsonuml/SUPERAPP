const Anthropic = require('@anthropic-ai/sdk');
const BaseAgent = require('./base-agent');
const BacklinkBuilderAgent = require('./backlink-builder');
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
    this.minWordCount = 1500;
    this.maxWordCount = 2000;
    this.backlinkBuilder = new BacklinkBuilderAgent(accountId);
    this.anthropic = new Anthropic();
  }

  // ── Main run ───────────────────────────────────────────
  async run() {
    const results = { postsGenerated: 0, repurposeChainsStarted: 0, keywordsUsed: [], posts: [], satellitePosts: [] };

    // Phase 1: Main product blog posts
    for (const productId of Object.keys(products)) {
      const keyword = await this.selectKeyword(productId);
      if (!keyword) {
        this.logger.warn(`No available keywords for ${productId}`, { agentId: this.agentId });
        continue;
      }

      // Cannibalization check — no other product used this keyword in 90 days
      const cannibalCheck = await this.checkCannibalization(keyword.keyword, productId);
      if (cannibalCheck) {
        this.logger.warn(`Keyword "${keyword.keyword}" used by ${cannibalCheck} recently, skipping`, {
          agentId: this.agentId,
        });
        continue;
      }

      // Get existing posts for internal linking
      const existingPosts = await this.getExistingPosts(productId);

      // Generate the full article
      const article = await this.generateArticle(productId, keyword, existingPosts);

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

      // Store the blog post in content_memory
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
          externalLinks: article.externalLinks,
          wordCount: article.wordCount,
          altTexts: article.altTexts,
          targetBlog: 'main',
        },
      });

      // Determine approval tier
      const tier = keyword.status === 'pre_approved' ? 1 : 2;

      // Submit for approval
      await this.submitForApproval({
        itemType: 'blog_post',
        tier,
        contentPreview: `[${products[productId]?.name}] ${article.title} — Keyword: "${keyword.keyword}" (${article.wordCount} words)`,
        fullContent: {
          product: productId,
          contentId,
          chainId,
          article,
          keyword: keyword.keyword,
          targetBlog: 'main',
        },
      });

      // Mark keyword as used
      await this.markKeywordUsed(keyword.id);

      // Trigger repurposing chain into content_calendar
      await this.triggerRepurposeChain(productId, contentId, chainId, article);

      results.postsGenerated++;
      results.repurposeChainsStarted++;
      results.keywordsUsed.push(keyword.keyword);
      results.posts.push({
        product: productId,
        title: article.title,
        keyword: keyword.keyword,
        wordCount: article.wordCount,
        tier,
        targetBlog: 'main',
      });
    }

    // Phase 2: Satellite blog posts (Mon/Wed/Fri)
    const dayOfWeek = new Date().getDay();
    if ([1, 3, 5].includes(dayOfWeek)) {
      try {
        const satResults = await this.generateSatellitePosts();
        results.satellitePosts = satResults;
      } catch (e) {
        this.logger.warn('Satellite blog generation failed', { error: e.message });
      }
    }

    // Run Backlink Builder sub-agent
    try {
      const backlinkResults = await this.backlinkBuilder.execute();
      results.backlinkBuilder = backlinkResults;
    } catch (e) {
      this.logger.debug('Backlink builder skipped', { error: e.message });
    }

    return results;
  }

  // ── Satellite blog post generation ────────────────────
  async generateSatellitePosts() {
    const { data: blogs } = await this.supabase
      .from('satellite_blogs')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('status', 'active');

    if (!blogs?.length) return [];

    const results = [];
    for (const blog of blogs) {
      try {
        const post = await this.generateSatellitePost(blog);
        if (post) results.push(post);
      } catch (e) {
        this.logger.warn(`Satellite post failed for ${blog.domain}`, { error: e.message });
      }
    }
    return results;
  }

  async generateSatellitePost(blog) {
    const voiceProfile = blog.voice_profile || {};
    const voiceInstructions = voiceProfile.tone
      ? `\nEditorial voice: ${voiceProfile.tone}. Style: ${voiceProfile.style || 'informative'}. Persona: ${voiceProfile.persona || 'industry expert'}.`
      : '';

    // Pick a topic-relevant keyword
    const { data: recentPosts } = await this.supabase
      .from('satellite_posts')
      .select('keyword')
      .eq('satellite_blog_id', blog.id)
      .order('created_at', { ascending: false })
      .limit(20);

    const usedKeywords = (recentPosts || []).map(p => p.keyword).filter(Boolean);

    // Generate the satellite article via Claude
    const shouldLinkProduct = Math.random() < 0.65; // ~65% include a product link
    const anchorTypes = ['branded', 'generic', 'contextual'];
    const anchorType = anchorTypes[Math.floor(Math.random() * anchorTypes.length)];

    const product = products[blog.parent_product];
    const productName = product?.name || blog.parent_product;

    const anchorExamples = {
      branded: productName,
      generic: 'check out this tool',
      contextual: `a ${blog.topic}-focused solution`,
    };

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: `You are a blogger writing for ${blog.name} (${blog.domain}), a blog about ${blog.topic}.${voiceInstructions}

This blog has its own distinct editorial voice — it is NOT a corporate blog. Write naturally as an independent expert in the ${blog.topic} space.`,
      messages: [{
        role: 'user',
        content: `Write a 1200-1800 word blog post for ${blog.name} about ${blog.topic}.

Requirements:
1. Choose a specific, interesting angle within the ${blog.topic} niche
2. Write a compelling headline and full article in Markdown
3. Use short paragraphs, subheadings, and a conversational tone
4. Include 2-3 internal links to other topics on this blog (use placeholder [internal-link] tags)
5. Include 1-2 external links to authoritative sources
${shouldLinkProduct ? `6. Naturally mention and link to ${productName} once using anchor text: "${anchorExamples[anchorType]}" — the link should feel organic, not promotional` : '6. Do NOT mention any products — keep this purely informational'}
7. Avoid keywords already used: ${usedKeywords.slice(0, 10).join(', ') || 'none yet'}

Respond with JSON:
{
  "title": "Article headline",
  "keyword": "primary keyword targeted",
  "body": "Full article in markdown",
  "anchorText": "exact anchor text used for product link (or null if none)"
}`,
      }],
    });

    let parsed;
    try {
      parsed = JSON.parse(response.content[0]?.text || '{}');
    } catch {
      this.logger.warn('Failed to parse satellite post response', { blog: blog.domain });
      return null;
    }

    const body = parsed.body || '';
    const wordCount = body.split(/\s+/).filter(Boolean).length;

    if (wordCount < 800) {
      this.logger.warn(`Satellite post too short (${wordCount} words)`, { blog: blog.domain });
      return null;
    }

    // Store the satellite post
    const { data: postRecord } = await this.supabase
      .from('satellite_posts')
      .insert({
        account_id: this.accountId,
        satellite_blog_id: blog.id,
        title: parsed.title,
        keyword: parsed.keyword,
        word_count: wordCount,
        has_product_link: shouldLinkProduct,
        anchor_text: shouldLinkProduct ? (parsed.anchorText || anchorExamples[anchorType]) : null,
        link_type: shouldLinkProduct ? anchorType : null,
        internal_links_count: (body.match(/\[internal-link\]/g) || []).length,
        external_links_count: (body.match(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g) || []).length,
        status: 'pending',
      })
      .select()
      .single();

    // Update blog stats
    await this.supabase
      .from('satellite_blogs')
      .update({
        posts_generated: blog.posts_generated + 1,
        backlinks_created: shouldLinkProduct ? blog.backlinks_created + 1 : blog.backlinks_created,
      })
      .eq('id', blog.id);

    // Submit for Tier 2 approval
    await this.submitForApproval({
      itemType: 'satellite_post',
      tier: 2,
      contentPreview: `[Satellite: ${blog.name}] ${parsed.title} — ${wordCount} words${shouldLinkProduct ? ` (${anchorType} link)` : ' (no product link)'}`,
      fullContent: {
        blogId: blog.id,
        blogDomain: blog.domain,
        postId: postRecord?.id,
        article: parsed,
        anchorType: shouldLinkProduct ? anchorType : null,
        wordCount,
        targetBlog: 'satellite',
      },
    });

    return {
      blog: blog.name,
      domain: blog.domain,
      title: parsed.title,
      keyword: parsed.keyword,
      wordCount,
      hasProductLink: shouldLinkProduct,
      anchorType: shouldLinkProduct ? anchorType : null,
    };
  }

  // ── Keyword selection ──────────────────────────────────
  async selectKeyword(productId) {
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() - this.keywordCooldownDays);

    // Prioritize: pre_approved first, then available by volume desc / difficulty asc
    const { data } = await this.supabase
      .from('keyword_map')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('product_assigned', productId)
      .in('status', ['available', 'pre_approved'])
      .or(`last_used.is.null,last_used.lt.${cooldownDate.toISOString()}`)
      .order('status', { ascending: true }) // pre_approved sorts before available
      .order('search_volume_estimate', { ascending: false })
      .order('difficulty_estimate', { ascending: true })
      .limit(1);

    return data?.[0] || null;
  }

  // ── Cannibalization check ──────────────────────────────
  async checkCannibalization(keyword, currentProductId) {
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() - this.keywordCooldownDays);

    const { data } = await this.supabase
      .from('keyword_map')
      .select('product_assigned')
      .eq('account_id', this.accountId)
      .eq('keyword', keyword)
      .neq('product_assigned', currentProductId)
      .eq('status', 'used')
      .gte('last_used', cooldownDate.toISOString())
      .limit(1);

    return data?.[0]?.product_assigned || null;
  }

  async markKeywordUsed(keywordId) {
    const nextEligible = new Date();
    nextEligible.setDate(nextEligible.getDate() + this.keywordCooldownDays);

    await this.supabase
      .from('keyword_map')
      .update({
        last_used: new Date().toISOString(),
        next_eligible: nextEligible.toISOString(),
        status: 'used',
      })
      .eq('id', keywordId);
  }

  // ── Get existing posts for internal linking ────────────
  async getExistingPosts(productId) {
    const { data } = await this.supabase
      .from('content_memory')
      .select('id, title, metadata')
      .eq('account_id', this.accountId)
      .eq('product', productId)
      .eq('content_type', 'blog_post')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(20);

    return (data || []).map(p => ({
      title: p.title,
      keyword: p.metadata?.keyword || '',
      slug: (p.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60),
    }));
  }

  // ── Full article generation via Claude ─────────────────
  async generateArticle(productId, keyword, existingPosts) {
    const product = products[productId];
    const voicePrompt = this.brandVoice.buildSystemPrompt(
      productId,
      `Write an SEO/AEO-optimized blog post targeting the keyword "${keyword.keyword}"`
    );

    // Step 1: Generate outline
    const outline = await this.generateOutline(productId, keyword, voicePrompt);

    // Step 2: Write full article with AEO optimization
    const article = await this.writeFullArticle(productId, keyword, outline, existingPosts, voicePrompt);

    // Step 3: Generate meta tags + image prompts
    const meta = await this.generateMeta(productId, keyword, article);

    const body = article.body || '';
    const wordCount = body.split(/\s+/).filter(Boolean).length;

    return {
      title: article.title || outline.h1 || `${keyword.keyword} — Complete Guide`,
      body,
      metaTitle: meta.metaTitle,
      metaDescription: meta.metaDescription,
      ogImagePrompt: meta.ogImagePrompt,
      altTexts: meta.altTexts || [],
      faqSchema: article.faqSchema || [],
      internalLinks: article.internalLinks || [],
      externalLinks: article.externalLinks || [],
      wordCount,
    };
  }

  async generateOutline(productId, keyword, voicePrompt) {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: voicePrompt,
        messages: [{
          role: 'user',
          content: `Create a detailed outline for a 1500-2000 word blog post targeting the keyword "${keyword.keyword}".

Product: ${products[productId]?.name} — ${products[productId]?.description}

Respond with ONLY valid JSON:
{
  "h1": "Main title (include keyword naturally)",
  "directAnswer": "A 2-3 sentence direct answer to the query (for featured snippets)",
  "sections": [
    {"h2": "Section heading", "keyPoints": ["point 1", "point 2"]}
  ],
  "faqQuestions": ["Question 1?", "Question 2?", "Question 3?"]
}`,
        }],
      });

      return JSON.parse(response.content[0]?.text || '{}');
    } catch (err) {
      this.logger.warn('Outline generation failed, using basic structure', { error: err.message });
      return {
        h1: `The Complete Guide to ${keyword.keyword}`,
        directAnswer: '',
        sections: [
          { h2: `What is ${keyword.keyword}?`, keyPoints: ['Definition', 'Why it matters'] },
          { h2: `How to Get Started`, keyPoints: ['Step 1', 'Step 2', 'Step 3'] },
          { h2: `Best Practices`, keyPoints: ['Tip 1', 'Tip 2'] },
        ],
        faqQuestions: [`What is ${keyword.keyword}?`, `How does ${keyword.keyword} work?`],
      };
    }
  }

  async writeFullArticle(productId, keyword, outline, existingPosts, voicePrompt) {
    const internalLinksContext = existingPosts.length > 0
      ? `\nExisting blog posts for internal linking (include 2+ as markdown links):\n${existingPosts.slice(0, 10).map(p => `- "${p.title}" (/${p.slug})`).join('\n')}`
      : '';

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: voicePrompt,
        messages: [{
          role: 'user',
          content: `Write a complete 1500-2000 word blog post in Markdown.

Target keyword: "${keyword.keyword}"
Outline: ${JSON.stringify(outline)}
${internalLinksContext}

Requirements:
1. Start with the H1 title, then a direct-answer paragraph (2-3 sentences answering the core question — optimized for featured snippets)
2. Use the H2 sections from the outline, with keyword naturally woven throughout
3. Write conversationally — match how people actually search and ask questions
4. Include a FAQ section at the end with 3-5 Q&As (use "## Frequently Asked Questions" and format each as "### Q: question?")
5. Include ${existingPosts.length > 0 ? '2+ internal links to existing posts' : 'placeholder [internal-link] tags'}
6. Include 1+ external link to an authoritative source (government site, major publication, Wikipedia, etc.)
7. Use short paragraphs (2-3 sentences max), bullet points, and clear structure
8. No fluff, filler, or "In this article we'll explore..." openers
9. Be genuinely helpful — write for the reader, not just search engines

Respond with the full article in Markdown.`,
        }],
      });

      const body = response.content[0]?.text || '';

      // Extract FAQ schema from the article
      const faqSchema = this.extractFaqSchema(body);

      // Extract links
      const internalLinks = (body.match(/\[([^\]]+)\]\(\/[^)]+\)/g) || []).map(link => {
        const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
        return match ? { text: match[1], url: match[2] } : null;
      }).filter(Boolean);

      const externalLinks = (body.match(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g) || []).map(link => {
        const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
        return match ? { text: match[1], url: match[2] } : null;
      }).filter(Boolean);

      // Extract title from H1
      const h1Match = body.match(/^#\s+(.+)/m);
      const title = h1Match?.[1] || outline.h1;

      return { title, body, faqSchema, internalLinks, externalLinks };
    } catch (err) {
      this.logger.warn('Full article generation failed', { error: err.message });
      return {
        title: outline.h1 || `Guide to ${keyword.keyword}`,
        body: `[Article generation failed — manual writing needed for "${keyword.keyword}"]`,
        faqSchema: [],
        internalLinks: [],
        externalLinks: [],
      };
    }
  }

  extractFaqSchema(markdown) {
    const faqs = [];
    const faqSection = markdown.split(/##\s*Frequently Asked Questions/i)[1];
    if (!faqSection) return faqs;

    const qMatches = faqSection.matchAll(/###\s*Q:\s*(.+?)[\n\r]+([\s\S]*?)(?=###\s*Q:|$)/gi);
    for (const match of qMatches) {
      const question = match[1].trim().replace(/\?$/, '') + '?';
      const answer = match[2].trim().replace(/^A:\s*/i, '').slice(0, 500);
      if (question && answer) {
        faqs.push({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } });
      }
    }
    return faqs;
  }

  async generateMeta(productId, keyword, article) {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `Generate SEO metadata for this blog post.

Title: ${article.title}
Keyword: "${keyword.keyword}"
Product: ${products[productId]?.name}
First 500 chars: ${(article.body || '').slice(0, 500)}

Respond with ONLY valid JSON:
{
  "metaTitle": "Under 60 characters, include keyword",
  "metaDescription": "Under 155 characters, compelling with keyword",
  "ogImagePrompt": "AI image generation prompt for the OG/social image",
  "altTexts": ["Alt text for hero image", "Alt text for supporting image"]
}`,
        }],
      });

      return JSON.parse(response.content[0]?.text || '{}');
    } catch (err) {
      return {
        metaTitle: `${keyword.keyword} — ${products[productId]?.name}`.slice(0, 60),
        metaDescription: `Learn about ${keyword.keyword}. Complete guide from ${products[productId]?.name}.`.slice(0, 155),
        ogImagePrompt: `Blog header image for article about ${keyword.keyword}`,
        altTexts: [`Illustration of ${keyword.keyword}`],
      };
    }
  }

  // ── Repurposing chain → content_calendar entries ───────
  async triggerRepurposeChain(productId, sourceContentId, chainId, article) {
    const today = new Date();
    const product = products[productId];

    // 1. Substack excerpt (ChronoStates only)
    if (product?.hasSubstack) {
      const excerptDate = new Date(today);
      excerptDate.setDate(excerptDate.getDate() + 1);
      await this.createCalendarEntry({
        date: excerptDate.toISOString().slice(0, 10),
        product: productId,
        platform: 'substack',
        postType: 'value_post',
        theme: `Substack excerpt from: ${article.title}`,
        tier: 2,
        metadata: { sourceContentId, chainId, type: 'substack_excerpt' },
      });
    }

    // 2. Three social post variants (LinkedIn, Reddit, Facebook)
    const socialPlatforms = ['linkedin', 'reddit', 'facebook'];
    for (let i = 0; i < socialPlatforms.length; i++) {
      const postDate = new Date(today);
      postDate.setDate(postDate.getDate() + i + 1);
      await this.createCalendarEntry({
        date: postDate.toISOString().slice(0, 10),
        product: productId,
        platform: socialPlatforms[i],
        postType: 'value_post_with_mention',
        theme: `${socialPlatforms[i]} post from: ${article.title}`,
        tier: 2,
        metadata: { sourceContentId, chainId, type: 'social_repurpose', targetPlatform: socialPlatforms[i] },
      });
    }

    // 3. Short-form video script
    const videoDate = new Date(today);
    videoDate.setDate(videoDate.getDate() + 2);
    await this.createCalendarEntry({
      date: videoDate.toISOString().slice(0, 10),
      product: productId,
      platform: 'video',
      postType: 'value_post',
      theme: `Video script from: ${article.title}`,
      tier: 2,
      metadata: { sourceContentId, chainId, type: 'video_script' },
    });

    // Also store pending items in content_memory for downstream agents
    const chainItems = [
      { type: 'social_posts', count: 3, agent: 'social-distributor' },
      { type: 'video_script', count: 1, agent: 'video-producer' },
    ];
    if (product?.hasSubstack) {
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

  async createCalendarEntry({ date, product, platform, postType, theme, tier, metadata }) {
    await this.supabase.from('content_calendar').insert({
      account_id: this.accountId,
      date,
      product,
      platform,
      post_type: postType,
      content_theme: theme,
      status: 'scheduled',
      approval_tier: tier,
      metadata_json: metadata || {},
    });
  }
}

module.exports = SeoAeoWriterAgent;
