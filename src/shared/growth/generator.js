// ══════════════════════════════════════════════════════════════════
// Content Generator (spec §2)
//
// One source item in, a platform-specific package out. Not a random
// daily post generator — everything traces back to a content_sources row.
//
// Two hard rules enforced here:
//   §32 A source with confidence 'needs_research' cannot be generated
//       from. Compliance facts are never invented; the generator is
//       told to use only what the source provides.
//   §31 Recent content is passed in as an avoid-list so headlines,
//       hooks, angles and CTAs don't repeat.
// ══════════════════════════════════════════════════════════════════

const llm = require('../llm');
const logger = require('../logger');

const PAYROLL_BEACON_CONTEXT = `
Payroll Beacon is a B2B payroll compliance product. It maintains a
searchable database of state and local minimum wage rates, local tax
jurisdictions, and multi-state payroll requirements.

Audience: payroll managers, payroll directors, HR leaders, and CPAs at
US companies — usually multi-state employers with 200-5,000 employees.

Voice: authoritative, precise, practitioner-oriented. Data-backed.
Regulatory language used correctly. Clear and concise.
Never: confusing, hand-wavy, "maybe", "we think", or hype.
`.trim();

// Per-platform generation contracts.
const PLATFORM_SPECS = {
  blog: {
    label: 'Payroll Beacon blog article',
    maxTokens: 8000,
    model: llm.MODELS.balanced,
    schema: `{
  "title": "SEO title, under 60 characters",
  "slug": "url-slug-here",
  "meta_description": "under 155 characters",
  "body": "full article in Markdown, 800-2000 words depending on topic depth",
  "faq": [{"question": "...", "answer": "..."}],
  "cta": "one sentence closing call to action",
  "sources_cited": ["url or citation for every regulatory claim"]
}`,
    guidance: `Write a genuinely useful article a payroll manager would bookmark.
Lead with the practical consequence, not background. Include specific
rates, dates and jurisdictions ONLY where the source provides them.
Include an FAQ section when the topic has common questions.
Do not pad to hit a word count.`,
  },

  facebook: {
    label: 'Facebook post',
    maxTokens: 1200,
    model: llm.MODELS.fast,
    schema: `{
  "body": "the post text, 40-120 words",
  "link_text": "optional short text introducing the link",
  "image_prompt": "description for an accompanying graphic, or null",
  "cta": "short closing line"
}`,
    guidance: `Conversational but professional. One useful idea per post.
No hashtag walls. No "Check out our latest blog!" framing — lead with
the substance, then link.`,
  },

  instagram: {
    label: 'Instagram post',
    maxTokens: 2000,
    model: llm.MODELS.fast,
    schema: `{
  "caption": "the caption, 50-150 words",
  "hashtags": ["#PayrollCompliance", "..."],
  "format": "carousel | single_image",
  "carousel_slides": [{"headline": "...", "body": "short line of copy"}],
  "image_prompt": "description for the primary graphic",
  "cta": "short closing line"
}`,
    guidance: `Visual-first. If the topic is a comparison or a list, use a
carousel of 3-6 slides with one idea per slide. Hashtags: 5-8, relevant,
no generic spam tags.`,
  },

  linkedin_company: {
    label: 'Payroll Beacon LinkedIn company page post',
    maxTokens: 1500,
    model: llm.MODELS.fast,
    schema: `{
  "body": "the post, 80-200 words",
  "cta": "short closing line",
  "image_prompt": "description for an accompanying graphic, or null"
}`,
    guidance: `A compliance insight, data point, or regulatory update that
stands on its own. Professional, specific, useful without clicking.
No emoji. No engagement bait.`,
  },

  linkedin_personal: {
    label: 'personal LinkedIn post (first person, from the founder)',
    maxTokens: 1500,
    model: llm.MODELS.balanced,
    schema: `{
  "body": "the post, 100-250 words, first person",
  "opening_hook": "the first line, which must stand alone as a hook"
}`,
    guidance: `This is a practitioner writing in first person — NOT a company
account. Write from the perspective of someone who runs payroll and has
opinions about it.

Good: "California's state minimum wage gets most of the attention, but the
problem for payroll teams is increasingly the number of local rates layered
on top of it."

Bad: "Check out our newest Payroll Beacon article!"

Share an observation, an interpretation of a regulation, a practical
consequence, or a lesson learned. Roughly 60% practitioner insight, 25%
research/data, 15% product — and if this one is product, make it earned.
No hashtags. No emoji. Never sound like marketing copy.`,
  },

  x: {
    label: 'X post',
    maxTokens: 600,
    model: llm.MODELS.fast,
    schema: `{"body": "under 280 characters", "thread": ["optional follow-up posts"]}`,
    guidance: 'One sharp observation. No hashtags.',
  },

  video: {
    label: 'short video script',
    maxTokens: 2000,
    model: llm.MODELS.fast,
    schema: `{
  "format": "payroll_fact | payroll_explainer",
  "title": "...",
  "hook": "first 3 seconds of narration",
  "scenes": [{"seconds": 8, "narration": "...", "on_screen_text": "...", "visual": "description"}],
  "cta": "closing line",
  "thumbnail_concept": "description",
  "estimated_duration_sec": 45
}`,
    guidance: `MVP is a script and scene plan only — no production.
payroll_fact: 30-60s, hook + 3 facts + CTA.
payroll_explainer: 30-90s, explain one thing that is harder than it looks.`,
  },
};

const SUPPORTED_PLATFORMS = Object.keys(PLATFORM_SPECS);

class ContentGenerator {
  constructor(accountId, { costService = null } = {}) {
    this.accountId = accountId;
    this.costService = costService;
  }

  /**
   * Generate one platform's content from a source.
   * @returns {Promise<{platform, content, model, usage, requiresManualPosting}>}
   */
  async generate({ source, platform, recentContent = [], campaign = null }) {
    const spec = PLATFORM_SPECS[platform];
    if (!spec) throw new Error(`Unsupported platform: ${platform}`);

    // §32 — an unverified compliance source never reaches generation.
    if (source.source_confidence === 'needs_research') {
      throw new Error(
        `Source "${source.title}" is marked needs_research. `
        + 'Verify the underlying facts before generating content from it.'
      );
    }

    const prompt = this.buildPrompt({ source, spec, platform, recentContent, campaign });

    const { data, usage, model } = await llm.completeJson({
      prompt,
      system: PAYROLL_BEACON_CONTEXT,
      model: spec.model,
      maxTokens: spec.maxTokens,
    });

    if (this.costService) {
      await this.costService.recordLlm({
        model, usage, operation: `generate:${platform}`,
      });
    }

    return {
      platform,
      content: data,
      model,
      usage,
      // §12 — personal LinkedIn is never auto-published.
      requiresManualPosting: platform === 'linkedin_personal',
    };
  }

  buildPrompt({ source, spec, platform, recentContent, campaign }) {
    const parts = [];

    parts.push(`Write a ${spec.label} based on the source material below.`);
    parts.push('');
    parts.push('── SOURCE ──');
    parts.push(`Title: ${source.title}`);
    if (source.topic) parts.push(`Topic: ${source.topic}`);
    if (source.category) parts.push(`Category: ${source.category}`);
    if (source.target_audience) parts.push(`Audience: ${source.target_audience}`);

    const states = Array.isArray(source.states) ? source.states : [];
    if (states.length > 0) parts.push(`States: ${states.join(', ')}`);

    const jurisdictions = Array.isArray(source.jurisdictions) ? source.jurisdictions : [];
    if (jurisdictions.length > 0) parts.push(`Jurisdictions: ${jurisdictions.join(', ')}`);

    if (source.effective_date) parts.push(`Effective date: ${source.effective_date}`);
    if (source.summary) parts.push(`\nSummary:\n${source.summary}`);
    if (source.raw_text) parts.push(`\nSource material:\n${source.raw_text.slice(0, 6000)}`);
    if (source.source_url) parts.push(`\nSource URL: ${source.source_url}`);

    // §32 — provenance discipline
    parts.push('');
    parts.push('── FACTUAL DISCIPLINE ──');
    parts.push('Use ONLY facts present in the source material above.');
    parts.push('Do not invent rates, dates, thresholds, jurisdictions, or citations.');
    parts.push('If the source does not support a specific claim, write generally instead of inventing a specific.');
    if (source.source_confidence === 'unverified') {
      parts.push('This source is UNVERIFIED — avoid stating precise figures as settled fact.');
    }

    // §31 — repetition guard
    if (recentContent.length > 0) {
      parts.push('');
      parts.push('── AVOID REPEATING RECENT CONTENT ──');
      parts.push('Do not reuse these headlines, opening hooks, angles, statistics, or CTAs:');
      for (const item of recentContent.slice(0, 12)) {
        const title = item.title || '(untitled)';
        const opener = (item.body || '').slice(0, 120).replace(/\s+/g, ' ');
        parts.push(`- "${title}" — opened with: "${opener}"`);
      }
      parts.push('Find a genuinely different angle.');
    }

    if (campaign) {
      parts.push('');
      parts.push(`Campaign: ${campaign.name}${campaign.goal ? ` (goal: ${campaign.goal})` : ''}`);
    }

    parts.push('');
    parts.push('── GUIDANCE ──');
    parts.push(spec.guidance);

    parts.push('');
    parts.push('── OUTPUT SHAPE ──');
    parts.push(spec.schema);

    return parts.join('\n');
  }

  /**
   * Generate a full package: several platforms from one source.
   * A per-platform failure is captured, not thrown — one bad platform
   * must not lose the rest of the package.
   */
  async generatePackage({ source, platforms, recentContent = [], campaign = null }) {
    const results = { generated: [], failed: [] };

    for (const platform of platforms) {
      try {
        const result = await this.generate({ source, platform, recentContent, campaign });
        results.generated.push(result);
      } catch (err) {
        logger.warn(`Generation failed for ${platform}: ${err.message}`, {
          accountId: this.accountId, sourceId: source.id,
        });
        results.failed.push({ platform, error: err.message });
      }
    }

    return results;
  }

  /**
   * Turn a generated payload into the title/body pair growth_content stores.
   * Each platform nests its text differently.
   */
  static flatten(platform, content) {
    switch (platform) {
      case 'blog':
        return { title: content.title, body: content.body };
      case 'instagram':
        return { title: content.caption?.slice(0, 80), body: content.caption };
      case 'video':
        return {
          title: content.title,
          body: (content.scenes || []).map(s => s.narration).join('\n\n'),
        };
      case 'x':
        return { title: content.body?.slice(0, 80), body: content.body };
      default:
        return { title: content.title || content.body?.slice(0, 80), body: content.body };
    }
  }
}

module.exports = ContentGenerator;
module.exports.PLATFORM_SPECS = PLATFORM_SPECS;
module.exports.SUPPORTED_PLATFORMS = SUPPORTED_PLATFORMS;
module.exports.PAYROLL_BEACON_CONTEXT = PAYROLL_BEACON_CONTEXT;
