const BaseAgent = require('./base-agent');
const products = require('../config/products');
const config = require('../config');

// ── Platform specs with exact character limits ────────────
const PLATFORM_SPECS = {
  facebook: {
    formats: ['image', 'video'],
    copyFields: {
      primaryText: { label: 'Primary Text', maxChars: 125 },
      headline: { label: 'Headline', maxChars: 40 },
      ctaButton: { label: 'CTA Button', maxChars: 25 },
    },
    imageSpecs: [
      { label: 'Square', width: 1080, height: 1080, ratio: '1:1' },
      { label: 'Landscape', width: 1200, height: 628, ratio: '1.91:1' },
    ],
  },
  reddit: {
    formats: ['promoted_post'],
    copyFields: {
      title: { label: 'Title', maxChars: 300 },
    },
    imageSpecs: [
      { label: 'Feed Image', width: 1200, height: 628, ratio: '1.91:1' },
    ],
  },
  google_search: {
    formats: ['search'],
    copyFields: {
      headline1: { label: 'Headline 1', maxChars: 30 },
      headline2: { label: 'Headline 2', maxChars: 30 },
      headline3: { label: 'Headline 3', maxChars: 30 },
      description1: { label: 'Description 1', maxChars: 90 },
      description2: { label: 'Description 2', maxChars: 90 },
    },
    imageSpecs: [],
  },
  google_display: {
    formats: ['display'],
    copyFields: {
      shortHeadline: { label: 'Short Headline', maxChars: 25 },
      longHeadline: { label: 'Long Headline', maxChars: 90 },
      description: { label: 'Description', maxChars: 90 },
    },
    imageSpecs: [
      { label: 'Landscape', width: 1200, height: 628, ratio: '1.91:1' },
      { label: 'Medium Rectangle', width: 300, height: 250, ratio: '6:5' },
      { label: 'Leaderboard', width: 728, height: 90, ratio: '8:1' },
    ],
  },
  linkedin: {
    formats: ['sponsored_content'],
    copyFields: {
      introText: { label: 'Intro Text', maxChars: 150 },
      headline: { label: 'Headline', maxChars: 70 },
    },
    imageSpecs: [
      { label: 'Sponsored Image', width: 1200, height: 627, ratio: '1.91:1' },
    ],
  },
};

// ── Angle frameworks per variant ──────────────────────────
const AD_ANGLES = ['pain_point', 'curiosity', 'social_proof', 'direct_benefit'];

// ── Default creative strategies per product ───────────────
const CREATIVE_STRATEGIES = {
  chronostates: {
    approach: 'Curiosity-driven',
    hook: 'What if you could rewrite history?',
    hookStyle: 'Provocative historical scenarios',
    visual: 'Epic historical imagery with a twist — alternate timelines, dramatic what-if moments',
    brandColors: '#7c3aed, #4c1d95, #ede9fe',
    emotionalTone: 'Wonder, intellectual excitement, epic scale',
  },
  payroll_beacon: {
    approach: 'Pain-driven',
    hook: 'Still manually tracking state payroll laws?',
    hookStyle: 'Compliance fear → data confidence resolution',
    visual: 'Clean, professional, state maps with data overlays',
    brandColors: '#2563eb, #1e40af, #dbeafe',
    emotionalTone: 'Relief, confidence, professional trust',
  },
  budgeting_beacon: {
    approach: 'Aspiration-driven',
    hook: 'See every dollar, 24 months ahead.',
    hookStyle: 'Financial clarity promise, empowerment',
    visual: 'Cash flow calendar visualization, empowerment moments, clean financial dashboards',
    brandColors: '#059669, #065f46, #ecfdf5',
    emotionalTone: 'Clarity, empowerment, financial confidence',
  },
};

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
  }

  async run() {
    const results = {
      creativesGenerated: 0,
      byProduct: {},
      byPlatform: {},
      complianceFlags: [],
      videoConceptsGenerated: 0,
    };

    // Fetch performance data once for creative strategy bias
    const performanceData = await this.getPerformanceData();

    for (const productId of Object.keys(products)) {
      const product = products[productId];
      results.byProduct[productId] = { total: 0, byPlatform: {}, complianceFlags: 0, videosConcepts: 0 };

      for (const [platformId, specs] of Object.entries(PLATFORM_SPECS)) {
        const variants = await this.generateVariants(productId, platformId, specs, performanceData);

        for (const variant of variants) {
          // Compliance check via Claude
          const compliance = await this.checkCompliance(variant, platformId, productId);

          // Store in content_memory
          await this.storeContent({
            type: 'ad_creative',
            product: productId,
            title: `[${product.name}/${platformId}] ${variant.angle} — ${variant.copy?.headline || variant.copy?.title || variant.copy?.headline1 || 'Ad'}`,
            content: JSON.stringify(variant),
            metadata: {
              platform: platformId,
              product: productId,
              angle: variant.angle,
              format: variant.format,
              compliance,
              imageSpecs: specs.imageSpecs,
            },
          });

          // Generate HTML mockup preview
          const mockupHtml = this.generateMockup(variant, platformId, productId, specs);

          // Submit for Tier 2 approval
          await this.submitForApproval({
            itemType: 'ad_creative',
            contentPreview: `[${product.name}/${platformId}/${variant.angle}] ${variant.copy?.headline || variant.copy?.title || variant.copy?.headline1 || 'Creative'}`,
            fullContent: {
              product: productId,
              productName: product.name,
              platform: platformId,
              format: variant.format,
              angle: variant.angle,
              copy: variant.copy,
              imagePrompts: variant.imagePrompts,
              videoConceptText: variant.videoConcept || null,
              compliance,
              mockupHtml,
              targetUrl: `https://${product.domain}?utm_source=${platformId}&utm_medium=paid&utm_campaign=${variant.angle}`,
            },
          });

          results.creativesGenerated++;
          results.byProduct[productId].total++;
          results.byProduct[productId].byPlatform[platformId] = (results.byProduct[productId].byPlatform[platformId] || 0) + 1;
          results.byPlatform[platformId] = (results.byPlatform[platformId] || 0) + 1;

          if (!compliance.pass) {
            results.complianceFlags.push({
              product: productId,
              platform: platformId,
              angle: variant.angle,
              issues: compliance.issues,
            });
            results.byProduct[productId].complianceFlags++;
          }
        }
      }

      // Generate one video ad concept per product per week
      const videoConcept = await this.generateVideoConcept(productId, performanceData);
      if (videoConcept) {
        await this.submitForApproval({
          itemType: 'ad_creative',
          contentPreview: `[${product.name}/video] ${videoConcept.title}`,
          fullContent: {
            product: productId,
            productName: product.name,
            platform: 'video',
            format: 'video_concept',
            angle: 'video',
            videoConcept,
            compliance: { pass: true, issues: [] },
            targetUrl: `https://${product.domain}?utm_source=video&utm_medium=paid`,
          },
        });
        results.videoConceptsGenerated++;
        results.byProduct[productId].videosConcepts++;
      }
    }

    this.itemsProduced = results.creativesGenerated + results.videoConceptsGenerated;
    return results;
  }

  // ── Performance data for creative strategy bias ─────────
  async getPerformanceData() {
    try {
      const { data } = await this.supabase
        .from('content_memory')
        .select('product, title, metadata_json, engagement_score')
        .eq('account_id', this.accountId)
        .eq('type', 'ad_creative')
        .not('engagement_score', 'is', null)
        .order('engagement_score', { ascending: false })
        .limit(20);

      return data || [];
    } catch {
      return [];
    }
  }

  // ── Generate 3-5 variants per platform per product ──────
  async generateVariants(productId, platformId, specs, performanceData) {
    const product = products[productId];
    const strategy = CREATIVE_STRATEGIES[productId];
    const copyFieldDescs = Object.entries(specs.copyFields)
      .map(([k, v]) => `${k}: ${v.label} (max ${v.maxChars} chars)`)
      .join('\n');

    // Build performance context if available
    let perfContext = '';
    const productPerf = performanceData.filter(p => p.product === productId);
    if (productPerf.length > 0) {
      perfContext = `\n\nTOP PERFORMING PAST ADS (bias toward these angles/hooks):
${productPerf.slice(0, 5).map(p => `- ${p.title} (score: ${p.engagement_score})`).join('\n')}`;
    }

    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });

      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 4000,
        system: this.brandVoice.buildSystemPrompt(productId, `Create ad creatives for ${platformId}`),
        messages: [{
          role: 'user',
          content: `Generate 4 ad creative variants for ${product.name} on ${platformId}.

PRODUCT: ${product.name} — ${product.description}
AUDIENCE: ${product.audience}
STRATEGY: ${strategy.approach} — ${strategy.hook}
HOOK STYLE: ${strategy.hookStyle}
VISUAL DIRECTION: ${strategy.visual}
BRAND COLORS: ${strategy.brandColors}
EMOTIONAL TONE: ${strategy.emotionalTone}
${perfContext}

PLATFORM: ${platformId}
COPY FIELDS (STRICT character limits — do NOT exceed):
${copyFieldDescs}

IMAGE SPECS:
${specs.imageSpecs.map(s => `- ${s.label}: ${s.width}x${s.height}`).join('\n') || 'No images for this format'}

Generate exactly 4 variants, one for each angle:
1. pain_point — Lead with the user's frustration or problem
2. curiosity — Tease an intriguing outcome or question
3. social_proof — Reference others who benefit / growing community
4. direct_benefit — State the clear value proposition

Return JSON array:
[
  {
    "angle": "pain_point|curiosity|social_proof|direct_benefit",
    "copy": { ${Object.keys(specs.copyFields).map(k => `"${k}": "..."`).join(', ')} },
    "imagePrompts": [
      {
        "spec": "${specs.imageSpecs[0]?.label || 'N/A'}",
        "width": ${specs.imageSpecs[0]?.width || 0},
        "height": ${specs.imageSpecs[0]?.height || 0},
        "prompt": "Detailed image generation prompt including style, composition, brand colors, emotional tone..."
      }
    ]
  }
]

CRITICAL: Every copy field MUST respect its character limit exactly. Count characters carefully.`,
        }],
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed
          .filter(v => v.angle && v.copy)
          .map(v => ({
            angle: v.angle,
            format: specs.formats[0],
            copy: this.enforceCharLimits(v.copy, specs.copyFields),
            imagePrompts: (v.imagePrompts || []).map(ip => ({
              spec: ip.spec || 'default',
              width: ip.width,
              height: ip.height,
              prompt: ip.prompt,
            })),
          }));
      }
    } catch (error) {
      this.logger.warn(`Claude ad generation failed for ${productId}/${platformId}: ${error.message}`, {
        agentId: this.agentId,
      });
    }

    // Fallback: generate basic variants
    return this.generateFallbackVariants(productId, platformId, specs);
  }

  enforceCharLimits(copy, copyFields) {
    const enforced = {};
    for (const [field, spec] of Object.entries(copyFields)) {
      enforced[field] = (copy[field] || '').slice(0, spec.maxChars);
    }
    return enforced;
  }

  generateFallbackVariants(productId, platformId, specs) {
    const product = products[productId];
    const strategy = CREATIVE_STRATEGIES[productId];

    return AD_ANGLES.map(angle => {
      const copy = {};
      for (const [field, spec] of Object.entries(specs.copyFields)) {
        let text;
        if (angle === 'pain_point') text = strategy.hook;
        else if (angle === 'curiosity') text = `Discover ${product.name}`;
        else if (angle === 'social_proof') text = `Join thousands using ${product.name}`;
        else text = product.description;
        copy[field] = text.slice(0, spec.maxChars);
      }

      return {
        angle,
        format: specs.formats[0],
        copy,
        imagePrompts: specs.imageSpecs.map(imgSpec => ({
          spec: imgSpec.label,
          width: imgSpec.width,
          height: imgSpec.height,
          prompt: `Professional ad image for ${product.name}. ${strategy.visual}. Brand colors: ${strategy.brandColors}. ${imgSpec.width}x${imgSpec.height}px. ${strategy.emotionalTone}. Clean, modern design. High-quality marketing asset.`,
        })),
      };
    });
  }

  // ── Video ad concept generation ─────────────────────────
  async generateVideoConcept(productId, performanceData) {
    const product = products[productId];
    const strategy = CREATIVE_STRATEGIES[productId];

    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });

      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 2000,
        system: this.brandVoice.buildSystemPrompt(productId, 'Create video ad concept'),
        messages: [{
          role: 'user',
          content: `Create a 15-second video ad concept for ${product.name}.

PRODUCT: ${product.name} — ${product.description}
AUDIENCE: ${product.audience}
STRATEGY: ${strategy.approach}
VISUAL DIRECTION: ${strategy.visual}
EMOTIONAL TONE: ${strategy.emotionalTone}

Structure: Problem → Agitation → Solution (PAS framework)
- Hook (first 3 seconds): Must stop the scroll
- Problem (seconds 3-7): Show the pain
- Solution (seconds 7-12): Demonstrate the product
- CTA (seconds 12-15): Clear call to action with end card

Return JSON:
{
  "title": "short concept name",
  "hook": "first 3 seconds — what viewers see/hear",
  "script": "full 15-second narration script",
  "storyboard": [
    { "seconds": "0-3", "scene": "visual description", "audio": "narration/SFX", "text_overlay": "on-screen text" },
    { "seconds": "3-7", "scene": "...", "audio": "...", "text_overlay": "..." },
    { "seconds": "7-12", "scene": "...", "audio": "...", "text_overlay": "..." },
    { "seconds": "12-15", "scene": "...", "audio": "...", "text_overlay": "..." }
  ],
  "endCardCta": "CTA text for the end card",
  "musicDirection": "background music style/mood"
}`,
        }],
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      this.logger.warn(`Video concept generation failed for ${productId}: ${error.message}`, {
        agentId: this.agentId,
      });
    }

    // Fallback video concept
    return {
      title: `${product.name} — 15s Ad`,
      hook: strategy.hook,
      script: `${strategy.hook} ${product.name} helps you ${product.description.toLowerCase()}. Try it free today.`,
      storyboard: [
        { seconds: '0-3', scene: 'Hook visual — attention grab', audio: strategy.hook, text_overlay: strategy.hook },
        { seconds: '3-7', scene: 'Problem visualization', audio: 'Show the pain point', text_overlay: 'The problem...' },
        { seconds: '7-12', scene: `${product.name} product demo`, audio: 'Product solves this', text_overlay: product.name },
        { seconds: '12-15', scene: 'End card with logo + CTA', audio: 'Try it free', text_overlay: `Try ${product.name} Free` },
      ],
      endCardCta: `Start Free with ${product.name}`,
      musicDirection: strategy.emotionalTone,
    };
  }

  // ── Compliance check via Claude ─────────────────────────
  async checkCompliance(variant, platformId, productId) {
    const issues = [];

    // First: hard check character limits
    const specs = PLATFORM_SPECS[platformId];
    if (specs?.copyFields && variant.copy) {
      for (const [field, spec] of Object.entries(specs.copyFields)) {
        if (variant.copy[field] && variant.copy[field].length > spec.maxChars) {
          issues.push({
            type: 'char_limit',
            field,
            message: `${spec.label} exceeds ${spec.maxChars} chars (is ${variant.copy[field].length})`,
            severity: 'error',
          });
        }
      }
    }

    // Claude-based compliance scan
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });

      const copyText = Object.values(variant.copy || {}).join(' | ');
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Check this ad creative for compliance issues on ${platformId}:
"${copyText}"

Check for:
1. Prohibited claims (guaranteed results, misleading statistics, false urgency)
2. Missing required disclosures
3. Platform-specific policy violations (${platformId === 'facebook' ? "Meta's ad policies" : platformId === 'linkedin' ? "LinkedIn's ad guidelines" : platformId.startsWith('google') ? "Google Ads policies" : "Reddit's ad policies"})
4. Deceptive language or clickbait
5. Any claims that need substantiation

Return JSON: { "issues": [{ "type": "...", "message": "...", "severity": "warning|error" }] }
If no issues, return: { "issues": [] }`,
        }],
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.issues?.length > 0) issues.push(...result.issues);
      }
    } catch (error) {
      this.logger.warn(`Compliance check failed: ${error.message}`, { agentId: this.agentId });
    }

    return {
      pass: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    };
  }

  // ── HTML Mockup Generator ───────────────────────────────
  generateMockup(variant, platformId, productId, specs) {
    const product = products[productId];
    const strategy = CREATIVE_STRATEGIES[productId];
    const copy = variant.copy || {};

    if (platformId === 'facebook') {
      return `<div style="max-width:500px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;border:1px solid #ddd;border-radius:8px;overflow:hidden;background:#fff">
  <div style="padding:12px 16px;display:flex;align-items:center;gap:8px">
    <div style="width:40px;height:40px;border-radius:50%;background:${strategy.brandColors.split(',')[0]};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">${product.name[0]}</div>
    <div><div style="font-weight:600;font-size:13px">${product.name}</div><div style="font-size:11px;color:#65676B">Sponsored</div></div>
  </div>
  <div style="padding:0 16px 12px;font-size:14px">${copy.primaryText || ''}</div>
  <div style="width:100%;height:280px;background:linear-gradient(135deg,${strategy.brandColors});display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:600;text-align:center;padding:20px">${copy.headline || product.name}</div>
  <div style="padding:12px 16px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:13px;font-weight:600">${copy.headline || ''}</div>
    <button style="background:${strategy.brandColors.split(',')[0]};color:#fff;border:none;border-radius:4px;padding:6px 16px;font-size:13px;font-weight:600">${copy.ctaButton || 'Learn More'}</button>
  </div>
</div>`;
    }

    if (platformId === 'reddit') {
      return `<div style="max-width:600px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;border:1px solid #ccc;border-radius:4px;background:#fff;padding:8px 12px">
  <div style="font-size:11px;color:#7c7c7c;margin-bottom:4px">Promoted &bull; ${product.name}</div>
  <div style="font-size:16px;font-weight:500;color:#1a1a1b;margin-bottom:8px">${copy.title || ''}</div>
  <div style="width:100%;height:200px;background:linear-gradient(135deg,${strategy.brandColors});border-radius:4px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600">${product.name}</div>
</div>`;
    }

    if (platformId === 'google_search') {
      return `<div style="max-width:600px;font-family:Arial,sans-serif;padding:16px">
  <div style="font-size:11px;color:#202124;margin-bottom:2px">Ad &bull; ${product.domain}</div>
  <div style="font-size:20px;color:#1a0dab;margin-bottom:4px;cursor:pointer">${copy.headline1 || ''} | ${copy.headline2 || ''} | ${copy.headline3 || ''}</div>
  <div style="font-size:14px;color:#4d5156;line-height:1.4">${copy.description1 || ''} ${copy.description2 || ''}</div>
</div>`;
    }

    if (platformId === 'google_display') {
      return `<div style="width:300px;height:250px;border:1px solid #ddd;border-radius:4px;overflow:hidden;font-family:Arial,sans-serif;background:linear-gradient(135deg,${strategy.brandColors});color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:16px">
  <div style="font-size:14px;font-weight:700">${copy.longHeadline || ''}</div>
  <div style="font-size:12px;opacity:0.9">${copy.description || ''}</div>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:11px;font-weight:600">${copy.shortHeadline || product.name}</span>
    <button style="background:#fff;color:${strategy.brandColors.split(',')[0]};border:none;border-radius:3px;padding:4px 12px;font-size:11px;font-weight:600">Learn More</button>
  </div>
</div>`;
    }

    if (platformId === 'linkedin') {
      return `<div style="max-width:550px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;border:1px solid #e0e0e0;border-radius:8px;background:#fff;overflow:hidden">
  <div style="padding:12px 16px;display:flex;align-items:center;gap:8px">
    <div style="width:48px;height:48px;border-radius:4px;background:${strategy.brandColors.split(',')[0]};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">${product.name[0]}</div>
    <div><div style="font-weight:600;font-size:14px">${product.name}</div><div style="font-size:12px;color:#666">Promoted</div></div>
  </div>
  <div style="padding:0 16px 12px;font-size:14px;color:#333">${copy.introText || ''}</div>
  <div style="width:100%;height:260px;background:linear-gradient(135deg,${strategy.brandColors});display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:600;text-align:center;padding:20px">${copy.headline || product.name}</div>
  <div style="padding:10px 16px;font-size:14px;font-weight:600;color:#333">${copy.headline || ''}</div>
</div>`;
    }

    return `<div style="padding:16px;border:1px solid #ddd;border-radius:8px;font-family:sans-serif">
  <div style="font-weight:600;margin-bottom:8px">${product.name} — ${platformId}</div>
  <pre style="font-size:12px;white-space:pre-wrap">${JSON.stringify(copy, null, 2)}</pre>
</div>`;
  }
}

module.exports = AdCreativeAgent;
