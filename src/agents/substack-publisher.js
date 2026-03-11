const BaseAgent = require('./base-agent');
const config = require('../config');
const products = require('../config/products');

// ── Alternate history hooks for subject line generation ────
const NARRATIVE_HOOKS = [
  'What if the Library of Alexandria never burned?',
  'The war Napoleon should have won',
  'What if Rome never fell?',
  'The assassination that never happened',
  'What if the Spanish Armada succeeded?',
  'The treaty that could have prevented World War I',
  'What if the Byzantine Empire survived to the modern era?',
  'The rebellion that changed nothing — until it did',
  'What if China discovered the Americas first?',
  'The plague that never spread',
  'What if the Mongol Empire reached Western Europe?',
  'The coup that almost ended democracy',
  'What if the Ottoman Empire industrialized first?',
  'The voyage Columbus never made',
  'What if Hannibal took Rome?',
  'The revolution that started a century early',
  'What if the Soviet Union won the space race — permanently?',
  'The alliance that would have rewritten the map',
  'What if gunpowder was never invented?',
  'The peace treaty that should have held',
];

class SubstackPublisherAgent extends BaseAgent {
  static agentId = 'substack-publisher';
  static agentName = 'Substack Publisher';

  constructor(accountId) {
    super(accountId, {
      agentId: 'substack-publisher',
      agentName: 'Substack Publisher',
      cycle: 'daily',
      defaultTier: 2,
    });

    this.productId = 'chronostates';
    this.publishEmail = config.substack?.publishEmail;
  }

  async run() {
    const results = {
      newsletters: 0,
      publishMethod: null,
      subjectLine: null,
      wordCount: 0,
      approvalStatus: null,
    };

    // Step 1: Gather content sources
    const sources = await this.gatherContentSources();

    // Step 2: Select daily theme from sources
    const theme = this.selectDailyTheme(sources);

    // Step 3: Generate subject line options via Claude
    const subjectLine = await this.generateSubjectLines(theme);
    results.subjectLine = subjectLine;

    // Step 4: Generate newsletter with free teaser + paywalled content
    const newsletter = await this.generateNewsletter(theme, subjectLine);

    // Step 5: Generate header image prompt (and image if available)
    const headerImage = await this.generateHeaderImage(theme, newsletter);

    // Step 6: Dedup check
    const dupCheck = await this.checkDuplicate(newsletter.fullBody, this.productId);
    if (dupCheck.isDuplicate) {
      this.logger.warn('Duplicate newsletter content detected, skipping', { agentId: this.agentId });
      return results;
    }

    // Step 7: Format for email publishing
    const formatted = this.formatForPublishing(newsletter, headerImage, subjectLine);

    // Step 8: Store in content_memory
    const contentId = await this.storeContent({
      product: this.productId,
      platform: 'substack',
      contentType: 'newsletter',
      title: subjectLine,
      contentText: newsletter.fullBody,
      metadata: {
        subjectLine,
        freeTeaser: newsletter.freeTeaser,
        paywallContent: newsletter.paywallContent,
        closingSection: newsletter.closingSection,
        wordCount: newsletter.wordCount,
        theme: theme.type,
        sources: theme.sourceSummary,
        headerImagePrompt: headerImage.prompt,
        headerImageUrl: headerImage.url || null,
        publishMethod: this.publishEmail ? 'email' : 'manual_draft',
        formattedHtml: formatted.html,
      },
    });

    // Step 9: Store in newsletter_editions table
    await this.storeNewsletterEdition(contentId, newsletter, subjectLine, formatted, headerImage, theme);

    // Step 10: Submit for Tier 2 approval
    const approval = await this.submitForApproval({
      itemType: 'newsletter',
      contentPreview: `[ChronoStates Newsletter] ${subjectLine}\n\nTeaser: ${newsletter.freeTeaser.slice(0, 200)}...`,
      fullContent: {
        product: this.productId,
        contentId,
        subjectLine,
        freeTeaser: newsletter.freeTeaser,
        paywallContent: newsletter.paywallContent,
        closingSection: newsletter.closingSection,
        wordCount: newsletter.wordCount,
        headerImagePrompt: headerImage.prompt,
        publishMethod: this.publishEmail ? 'email' : 'manual_draft',
      },
    });

    results.approvalStatus = approval.status;
    results.publishMethod = this.publishEmail ? 'email' : 'manual_draft';
    results.wordCount = newsletter.wordCount;
    results.newsletters = 1;

    // Step 11: If auto-approved, publish immediately via email
    if (approval.status === 'auto_approved' && this.publishEmail) {
      await this.publishViaEmail(formatted, subjectLine, contentId);
    }

    return results;
  }

  // ── Content Source Gathering ─────────────────────────────────
  async gatherContentSources() {
    const sources = {
      blogPost: null,
      repurposeExcerpt: null,
      qaPlaytest: null,
      communityBuzz: [],
      painPoints: [],
    };

    // Source 1: Today's ChronoStates blog post from SEO/AEO Writer repurpose chain
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: pendingExcerpt } = await this.supabase
      .from('content_memory')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('product', this.productId)
      .eq('content_type', 'substack_excerpt')
      .eq('status', 'pending_repurpose')
      .order('created_at', { ascending: false })
      .limit(1);

    if (pendingExcerpt?.[0]) {
      sources.repurposeExcerpt = pendingExcerpt[0];

      // Also fetch the parent blog post
      if (pendingExcerpt[0].source_content_id) {
        const { data: blogPost } = await this.supabase
          .from('content_memory')
          .select('id, title, content_text, keywords, metadata')
          .eq('id', pendingExcerpt[0].source_content_id)
          .single();
        sources.blogPost = blogPost || null;
      }
    }

    // Source 2: QA Playtest Agent — last night's scenario results
    const { data: qaResults } = await this.supabase
      .from('qa_results')
      .select('scenario_id, checks, bugs, test_date, pass_fail, metadata')
      .eq('account_id', this.accountId)
      .order('test_date', { ascending: false })
      .limit(5);

    if (qaResults && qaResults.length > 0) {
      // Find the most interesting scenario (one with passed checks and narrative potential)
      const interesting = qaResults.find(r => r.pass_fail === 'pass' && r.metadata?.scenario_name) || qaResults[0];
      sources.qaPlaytest = interesting;
    }

    // Source 3: Community buzz — Pain Point Hunter + Community Scout
    const { data: painPoints } = await this.supabase
      .from('pain_points')
      .select('signal_text, category, source, score, date_found')
      .eq('account_id', this.accountId)
      .or('product.eq.chronostates,product_relevance.eq.chronostates')
      .order('score', { ascending: false })
      .limit(10);

    sources.painPoints = painPoints || [];

    const { data: communityPosts } = await this.supabase
      .from('community_posts')
      .select('title, platform, community_name, engagement_score, posted_at')
      .eq('account_id', this.accountId)
      .order('engagement_score', { ascending: false })
      .limit(10);

    sources.communityBuzz = communityPosts || [];

    return sources;
  }

  // ── Theme Selection ─────────────────────────────────────────
  selectDailyTheme(sources) {
    const theme = {
      type: 'original',
      primaryTopic: null,
      blogContext: null,
      scenarioHighlight: null,
      communityAngle: null,
      sourceSummary: [],
    };

    // Priority 1: Repurpose from today's blog post
    if (sources.blogPost) {
      theme.type = 'blog_adaptation';
      theme.primaryTopic = sources.blogPost.title;
      theme.blogContext = (sources.blogPost.content_text || '').slice(0, 1500);
      theme.sourceSummary.push(`Blog: ${sources.blogPost.title}`);
    }

    // Priority 2: QA Playtest scenario highlight
    if (sources.qaPlaytest) {
      const scenarioName = sources.qaPlaytest.metadata?.scenario_name || 'Recent Playtest';
      theme.scenarioHighlight = {
        name: scenarioName,
        checks: sources.qaPlaytest.checks,
        result: sources.qaPlaytest.pass_fail,
        metadata: sources.qaPlaytest.metadata || {},
      };
      theme.sourceSummary.push(`Scenario: ${scenarioName}`);

      // If no blog, promote scenario to primary
      if (!theme.primaryTopic) {
        theme.type = 'scenario_spotlight';
        theme.primaryTopic = `Scenario of the Day: ${scenarioName}`;
      }
    }

    // Priority 3: Community buzz
    if (sources.painPoints.length > 0) {
      const topBuzz = sources.painPoints[0];
      theme.communityAngle = {
        topic: topBuzz.signal_text,
        source: topBuzz.source,
        score: topBuzz.score,
      };
      theme.sourceSummary.push(`Community: ${topBuzz.signal_text.slice(0, 60)}`);

      if (!theme.primaryTopic) {
        theme.type = 'community_driven';
        theme.primaryTopic = topBuzz.signal_text;
      }
    }

    // Fallback: Rotating narrative hooks
    if (!theme.primaryTopic) {
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
      const hookIndex = dayOfYear % NARRATIVE_HOOKS.length;
      theme.type = 'original';
      theme.primaryTopic = NARRATIVE_HOOKS[hookIndex];
      theme.sourceSummary.push(`Hook: ${NARRATIVE_HOOKS[hookIndex]}`);
    }

    return theme;
  }

  // ── Subject Line Generation ─────────────────────────────────
  async generateSubjectLines(theme) {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: 'You write compelling email subject lines for an alternate history newsletter. Always provocative, curiosity-driven. Format: provocative question OR bold statement.',
        messages: [{
          role: 'user',
          content: `Generate 3 newsletter subject line options for this topic: "${theme.primaryTopic}"

Theme type: ${theme.type}
${theme.scenarioHighlight ? `Scenario: ${theme.scenarioHighlight.name}` : ''}
${theme.communityAngle ? `Community buzz: ${theme.communityAngle.topic}` : ''}

Return JSON: { "options": ["line1", "line2", "line3"], "recommended": 0 }
Pick the most curiosity-driven one as recommended (0-indexed).`,
        }],
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const idx = parsed.recommended ?? 0;
        return parsed.options[idx] || parsed.options[0];
      }
    } catch (error) {
      this.logger.warn(`Subject line generation failed: ${error.message}`, { agentId: this.agentId });
    }

    // Fallback: use topic directly
    return theme.primaryTopic.length <= 80
      ? theme.primaryTopic
      : `${theme.primaryTopic.slice(0, 77)}...`;
  }

  // ── Newsletter Generation ───────────────────────────────────
  async generateNewsletter(theme, subjectLine) {
    const systemPrompt = this.brandVoice.buildSystemPrompt(
      this.productId,
      `You are writing a daily paywalled newsletter for ChronoStates — an alternate history gaming/narrative platform. Write like a brilliant history professor who is also a great storyteller. Never dry, never academic, always provocative and intellectually curious.`
    );

    const userPrompt = this.buildNewsletterPrompt(theme, subjectLine);

    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const fullBody = [parsed.freeTeaser, parsed.paywallContent, parsed.closingSection].join('\n\n');
        const wordCount = fullBody.split(/\s+/).length;

        return {
          freeTeaser: parsed.freeTeaser,
          paywallContent: parsed.paywallContent,
          closingSection: parsed.closingSection,
          fullBody,
          wordCount,
        };
      }
    } catch (error) {
      this.logger.warn(`Newsletter generation via Claude failed: ${error.message}`, { agentId: this.agentId });
    }

    // Fallback newsletter
    return this.buildFallbackNewsletter(theme, subjectLine);
  }

  buildNewsletterPrompt(theme, subjectLine) {
    let sourceContext = '';

    if (theme.blogContext) {
      sourceContext += `\n\nBLOG POST TO ADAPT (rewrite for Substack audience, do NOT copy-paste):\n${theme.blogContext}`;
    }

    if (theme.scenarioHighlight) {
      sourceContext += `\n\nSCENARIO OF THE DAY:\nScenario: ${theme.scenarioHighlight.name}\nResult: ${theme.scenarioHighlight.result}\nDetails: ${JSON.stringify(theme.scenarioHighlight.metadata).slice(0, 500)}`;
    }

    if (theme.communityAngle) {
      sourceContext += `\n\nCOMMUNITY BUZZ:\nTopic: ${theme.communityAngle.topic}\nSource: ${theme.communityAngle.source}`;
    }

    return `Write a daily ChronoStates newsletter with subject: "${subjectLine}"
Theme: ${theme.primaryTopic}
Theme type: ${theme.type}
${sourceContext}

STRUCTURE (return as JSON):
{
  "freeTeaser": "2-3 paragraphs visible to all. Hook with a provocative alternate history question or scenario. Make non-subscribers think 'I need to read the rest.' End with: 'Subscribe to read the full analysis and get daily scenarios like this.'",
  "paywallContent": "The meat — 800-1200 words. Full scenario walkthrough, platform feature highlight, behind-the-scenes on ChronoStates narrative generation, deep-dive on the historical topic. Use proper headings (## format), bold for emphasis, occasional pull quotes (> format) for dramatic statements.${theme.scenarioHighlight ? ' Include a Scenario of the Day section highlighting the playtest results.' : ''}${theme.communityAngle ? ' Include a Community Pulse section on what the alternate history community is discussing.' : ''}",
  "closingSection": "Quick links section: try this scenario on ChronoStates, join the Discord, share with a history-loving friend. Simple CTAs, not pushy."
}

Requirements:
- Free teaser must end with clear paywall CTA
- Paywalled content: 800-1200 words, use ## headings, **bold**, > pull quotes
- Voice: imaginative, epic, intellectually curious — brilliant storyteller
- Must feel exclusive and worth the subscription`;
  }

  buildFallbackNewsletter(theme, subjectLine) {
    const freeTeaser = `**${subjectLine}**

Imagine a world where one pivotal moment in history played out differently. ${theme.primaryTopic} — it's the kind of question that keeps historians up at night and alternate history enthusiasts coming back for more.

Today, we're diving deep into this fascinating what-if scenario, exploring the ripple effects that would have reshaped civilizations, redrawn borders, and altered the course of human progress in ways you've never considered.

*Subscribe to read the full analysis and get daily scenarios like this.*`;

    const paywallContent = `## The Scenario

${theme.primaryTopic} — let's break this down from the moment of divergence.

${theme.scenarioHighlight ? `### Scenario of the Day

Our latest ChronoStates playtest explored a related scenario: **${theme.scenarioHighlight.name}**. The simulation revealed fascinating outcomes that challenge conventional historical assumptions.

` : ''}Every counterfactual begins with a single changed variable. But the beauty of alternate history lies in the cascading consequences — the second, third, and fourth-order effects that transform the entire trajectory of civilization.

## The Ripple Effects

> "History is not the past. It is the method we have evolved of organizing our ignorance of the past." — Hilary Mantel

When we model this divergence in ChronoStates, the narrative engine generates outcomes that would surprise even seasoned historians. The political realignments alone would fill volumes.

${theme.communityAngle ? `## Community Pulse

The alternate history community has been buzzing about **${theme.communityAngle.topic}**. It's a topic that connects directly to today's scenario — and the debates have been fascinating.

` : ''}## What ChronoStates Reveals

Behind the scenes, our narrative generation system processes thousands of historical variables to create these scenarios. Each decision branch creates a new possibility space — and that's what makes alternate history so compelling as both entertainment and intellectual exercise.

The key insight from today's analysis: small changes in history don't create small changes in outcomes. They create entirely different worlds.`;

    const closingSection = `---

**Explore today's scenario**: [Try it on ChronoStates](https://chronostates.io)

**Join the conversation**: [ChronoStates Discord](https://discord.gg/chronostates)

**Share this**: Know someone who loves history? Forward this newsletter — they'll thank you.

*Until tomorrow's divergence point,*
*The ChronoStates Team*`;

    const fullBody = [freeTeaser, paywallContent, closingSection].join('\n\n');

    return {
      freeTeaser,
      paywallContent,
      closingSection,
      fullBody,
      wordCount: fullBody.split(/\s+/).length,
    };
  }

  // ── Header Image Generation ─────────────────────────────────
  async generateHeaderImage(theme, newsletter) {
    const prompt = `Epic alternate history scene: ${theme.primaryTopic}. Dramatic lighting, cinematic composition, historical grandeur mixed with speculative elements. Wide landscape format, newsletter header style.`;

    const apiKey = config.imageGen.apiKey;

    if (!apiKey) {
      return { prompt, url: null, placeholder: true };
    }

    try {
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
            size: '1792x1024',
            response_format: 'url',
          }),
        });

        if (!response.ok) throw new Error(`Image gen error: ${response.status}`);

        const data = await response.json();
        const imageUrl = data.data[0]?.url;

        // Upload to Supabase Storage
        if (imageUrl) {
          const stored = await this.uploadHeaderImage(imageUrl);
          return { prompt, url: stored || imageUrl, placeholder: false };
        }
      }
    } catch (error) {
      this.logger.warn(`Header image generation failed: ${error.message}`, { agentId: this.agentId });
    }

    return { prompt, url: null, placeholder: true };
  }

  async uploadHeaderImage(imageUrl) {
    try {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) return null;

      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      const dateStr = new Date().toISOString().slice(0, 10);
      const path = `newsletters/chronostates/${dateStr}/header.png`;

      const bucket = 'newsletter-assets';
      const { data: buckets } = await this.supabase.storage.listBuckets();
      if (!buckets?.find(b => b.name === bucket)) {
        await this.supabase.storage.createBucket(bucket, { public: true });
      }

      const { data } = await this.supabase.storage
        .from(bucket)
        .upload(path, buffer, { contentType: 'image/png', upsert: true });

      if (data) {
        const { data: urlData } = this.supabase.storage.from(bucket).getPublicUrl(path);
        return urlData?.publicUrl || null;
      }
    } catch (error) {
      this.logger.warn(`Header image upload failed: ${error.message}`, { agentId: this.agentId });
    }
    return null;
  }

  // ── Format for Publishing ───────────────────────────────────
  formatForPublishing(newsletter, headerImage, subjectLine) {
    const headerImageHtml = headerImage.url
      ? `<img src="${headerImage.url}" alt="${subjectLine}" style="width:100%;max-width:600px;border-radius:8px;margin-bottom:20px;" />\n\n`
      : '';

    // Convert markdown-ish content to HTML for email publishing
    const formatSection = (text) => {
      return text
        .replace(/^## (.+)$/gm, '<h2 style="color:#1a1a2e;margin-top:24px;">$1</h2>')
        .replace(/^### (.+)$/gm, '<h3 style="color:#2d2d44;margin-top:16px;">$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^> (.+)$/gm, '<blockquote style="border-left:4px solid #c4a35a;padding:12px 20px;margin:16px 0;font-style:italic;color:#555;">$1</blockquote>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#c4a35a;text-decoration:underline;">$1</a>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(?!<[h23bap])(.+)$/gm, '<p>$1</p>')
        .replace(/---/g, '<hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />');
    };

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a2e;line-height:1.7;">
${headerImageHtml}
<h1 style="font-size:28px;color:#1a1a2e;margin-bottom:8px;">${subjectLine}</h1>
<p style="color:#888;font-size:14px;margin-bottom:24px;">ChronoStates Daily &middot; ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

${formatSection(newsletter.freeTeaser)}

<div style="background:#f8f6f0;border:2px solid #c4a35a;border-radius:8px;padding:24px;margin:24px 0;text-align:center;">
<p style="font-size:18px;font-weight:bold;color:#1a1a2e;">🔒 Premium Content Below</p>
<p>Subscribe to ChronoStates to read the full analysis and get daily alternate history scenarios.</p>
</div>

${formatSection(newsletter.paywallContent)}

${formatSection(newsletter.closingSection)}
</body>
</html>`;

    const plainText = `${subjectLine}\n\nChronoStates Daily — ${new Date().toLocaleDateString()}\n\n${newsletter.fullBody}`;

    return { html, plainText };
  }

  // ── Email Publishing ────────────────────────────────────────
  async publishViaEmail(formatted, subjectLine, contentId) {
    if (!this.publishEmail) {
      this.logger.info('No SUBSTACK_PUBLISH_EMAIL configured, skipping email publish', { agentId: this.agentId });
      return false;
    }

    try {
      // Use Resend API (already configured in the system for email sending)
      const resendKey = config.email.resendApiKey;
      if (!resendKey) {
        this.logger.warn('Resend API key not configured, cannot publish via email', { agentId: this.agentId });
        return false;
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: config.email.notificationEmail || 'newsletter@chronostates.io',
          to: [this.publishEmail],
          subject: subjectLine,
          html: formatted.html,
          text: formatted.plainText,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Resend API error ${response.status}: ${errorBody}`);
      }

      const result = await response.json();

      // Mark as published
      await this.contentMemory.markPublished(contentId);
      await this.supabase
        .from('newsletter_editions')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          publish_method: 'email',
          email_id: result.id,
        })
        .eq('content_id', contentId)
        .eq('account_id', this.accountId);

      this.logger.info('Newsletter published via email to Substack', {
        agentId: this.agentId,
        emailId: result.id,
        subjectLine,
      });

      return true;
    } catch (error) {
      this.logger.error(`Email publish failed: ${error.message}`, { agentId: this.agentId });
      return false;
    }
  }

  // ── Store Newsletter Edition Record ─────────────────────────
  async storeNewsletterEdition(contentId, newsletter, subjectLine, formatted, headerImage, theme) {
    try {
      await this.supabase.from('newsletter_editions').insert({
        account_id: this.accountId,
        content_id: contentId,
        product: this.productId,
        subject_line: subjectLine,
        free_teaser: newsletter.freeTeaser,
        paywall_content: newsletter.paywallContent,
        closing_section: newsletter.closingSection,
        word_count: newsletter.wordCount,
        header_image_url: headerImage.url || null,
        header_image_prompt: headerImage.prompt,
        theme_type: theme.type,
        sources: theme.sourceSummary,
        status: 'pending_approval',
        publish_method: this.publishEmail ? 'email' : 'manual_draft',
        formatted_html: formatted.html,
      });
    } catch (error) {
      this.logger.warn(`Failed to store newsletter edition: ${error.message}`, { agentId: this.agentId });
    }
  }
}

module.exports = SubstackPublisherAgent;
