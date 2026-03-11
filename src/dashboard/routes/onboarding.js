const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try {
    return await queryFn(getSupabase());
  } catch (err) {
    return { data: [], error: err };
  }
}

// ── Platform and product config ─────────────────────────────────

const PRODUCTS = [
  { id: 'chronostates', name: 'ChronoStates.io', voice: 'epic, mysterious, historical gaming', colors: '#1a1a2e, #e94560, #0f3460', style: 'dark, atmospheric, cinematic' },
  { id: 'payroll_beacon', name: 'Payroll Beacon', voice: 'professional, trustworthy, data-driven, enterprise', colors: '#1e40af, #3b82f6, #f8fafc', style: 'clean, corporate, modern' },
  { id: 'budgeting_beacon', name: 'Budgeting Beacon', voice: 'friendly, empowering, clear, approachable', colors: '#059669, #34d399, #f0fdf4', style: 'warm, inviting, personal finance' },
];

const PLATFORMS = [
  { id: 'reddit', name: 'Reddit', nameMax: 20, bioMax: 500, nameRules: 'underscores ok, no spaces', signupUrl: 'https://www.reddit.com/register', settingsUrl: 'https://www.reddit.com/settings' },
  { id: 'facebook', name: 'Facebook Page', bioMax: 255, signupUrl: 'https://www.facebook.com/pages/create', settingsUrl: 'https://www.facebook.com/pages/?category=your_pages' },
  { id: 'instagram', name: 'Instagram', nameMax: 30, bioMax: 150, nameRules: 'periods and underscores ok', signupUrl: 'https://www.instagram.com/accounts/emailsignup/', settingsUrl: 'https://www.instagram.com/accounts/edit/' },
  { id: 'linkedin', name: 'LinkedIn', bioMax: 2000, signupUrl: 'https://www.linkedin.com/company/setup/new/', settingsUrl: 'https://www.linkedin.com/company/' },
  { id: 'discord', name: 'Discord', bioMax: 300, signupUrl: 'https://discord.com/register', settingsUrl: 'https://discord.com/channels/@me', bannerSize: '960x540' },
  { id: 'tiktok', name: 'TikTok', nameMax: 24, bioMax: 80, signupUrl: 'https://www.tiktok.com/signup', settingsUrl: 'https://www.tiktok.com/setting' },
  { id: 'youtube', name: 'YouTube', bioMax: 1000, signupUrl: 'https://www.youtube.com/channel', settingsUrl: 'https://studio.youtube.com/', bannerSize: '2560x1440' },
  { id: 'substack', name: 'Substack', bioMax: 500, signupUrl: 'https://substack.com/signup', settingsUrl: 'https://substack.com/settings' },
  { id: 'x_twitter', name: 'X / Twitter', nameMax: 15, bioMax: 160, nameRules: 'no spaces, alphanumeric + underscore', signupUrl: 'https://x.com/i/flow/signup', settingsUrl: 'https://x.com/settings/profile', bannerSize: '1500x500' },
];

const ASSET_TYPES = ['account_names', 'bio', 'profile_image_prompt', 'banner_image_prompt', 'initial_content', 'settings_checklist'];

// ── GET /onboarding — full onboarding state ──────────────────

router.get('/', async (req, res) => {
  try {
    const [assetsResult, statusResult, connectionsResult] = await Promise.all([
      safeQuery(sb => sb.from('onboarding_assets').select('*').eq('account_id', req.accountId)),
      safeQuery(sb => sb.from('onboarding_status').select('*').eq('account_id', req.accountId)),
      safeQuery(sb => sb.from('social_connections').select('platform, status').eq('account_id', req.accountId)),
    ]);

    const assets = assetsResult.data || [];
    const statuses = statusResult.data || [];
    const connections = connectionsResult.data || [];

    // Build structured response by product > platform
    const structured = {};
    for (const p of PRODUCTS) {
      structured[p.id] = { product: p, platforms: {} };
      for (const pl of PLATFORMS) {
        const platAssets = {};
        for (const a of assets.filter(a => a.product === p.id && a.platform === pl.id)) {
          platAssets[a.asset_type] = a.content;
        }
        const status = statuses.find(s => s.product === p.id && s.platform === pl.id);
        const conn = connections.find(c => c.platform === pl.id && c.status === 'connected');
        structured[p.id].platforms[pl.id] = {
          platform: pl,
          assets: platAssets,
          status: conn ? 'connected' : (status?.status || 'not_started'),
          connectedAt: conn ? status?.connected_at : null,
        };
      }
    }

    // Progress stats
    const totalSlots = PRODUCTS.length * PLATFORMS.length;
    const connected = Object.values(structured).reduce((sum, p) =>
      sum + Object.values(p.platforms).filter(pl => pl.status === 'connected').length, 0);
    const inProgress = Object.values(structured).reduce((sum, p) =>
      sum + Object.values(p.platforms).filter(pl => pl.status === 'in_progress').length, 0);
    const hasAssets = Object.values(structured).reduce((sum, p) =>
      sum + Object.values(p.platforms).filter(pl => Object.keys(pl.assets).length > 0).length, 0);

    res.json({
      structured,
      products: PRODUCTS,
      platforms: PLATFORMS,
      progress: { total: totalSlots, connected, inProgress, hasAssets, pct: Math.round((connected / totalSlots) * 100) },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /onboarding/generate — generate assets for a product+platform ──

router.post('/generate', async (req, res) => {
  try {
    const { product: productId, platform: platformId } = req.body;
    const product = PRODUCTS.find(p => p.id === productId);
    const platform = PLATFORMS.find(p => p.id === platformId);
    if (!product || !platform) return res.status(400).json({ error: 'Invalid product or platform' });

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [{
        role: 'user',
        content: `Generate platform setup assets for "${product.name}" on "${platform.name}".

Brand voice: ${product.voice}
Brand colors: ${product.colors}
Style: ${product.style}

Platform constraints:
- Username max length: ${platform.nameMax || 'no strict limit'} chars${platform.nameRules ? `, rules: ${platform.nameRules}` : ''}
- Bio max length: ${platform.bioMax} chars
${platform.bannerSize ? `- Banner dimensions: ${platform.bannerSize}` : ''}

Generate ALL of the following as a JSON object:

1. "account_names": Array of 3 username suggestions. Follow platform naming conventions. Keep consistent with "${product.name}" brand but adapted to ${platform.name} culture.

2. "bio": The bio/description text. Exactly within ${platform.bioMax} char limit. Match ${platform.name} tone — ${platform.id === 'instagram' ? 'emoji-friendly, punchy' : platform.id === 'x_twitter' ? 'punchy, memorable' : platform.id === 'linkedin' ? 'professional, comprehensive' : platform.id === 'tiktok' ? 'casual, fun' : 'clear, engaging'}.

3. "profile_image_prompt": AI image generation prompt for a square 400x400 profile image. Include brand colors (${product.colors}), style direction, what the image conveys. ${product.id === 'chronostates' ? 'Epic/historical/mysterious feel.' : product.id === 'payroll_beacon' ? 'Professional/trustworthy/data-driven.' : 'Friendly/empowering/clear.'}

4. "banner_image_prompt": AI image generation prompt for a banner/header image${platform.bannerSize ? ` at ${platform.bannerSize} dimensions` : ''}. Brand-appropriate, platform-specific dimensions.

5. "initial_content": First post/message draft for this platform. ${platform.id === 'reddit' ? 'Introduction post for relevant subreddits.' : platform.id === 'youtube' ? 'Channel trailer script (60-90 seconds).' : platform.id === 'discord' ? 'Welcome message + channel structure suggestion.' : platform.id === 'substack' ? 'Welcome email for new subscribers.' : platform.id === 'x_twitter' ? 'Pinned tweet.' : platform.id === 'tiktok' ? 'First video concept with hook.' : platform.id === 'instagram' ? 'First image post caption with hashtags.' : 'Launch/introduction post.'}

6. "settings_checklist": Array of 4-6 specific settings to configure on ${platform.name} after account creation. Include actionable steps.${platform.id === 'instagram' ? ' Include: switch to business account, connect Facebook page, enable insights.' : ''}${platform.id === 'youtube' ? ' Include: verify channel, set default upload settings, add channel keywords.' : ''}${platform.id === 'discord' ? ' Include: set up roles, channels, welcome message, bot permissions.' : ''}

Respond with ONLY the JSON object, no markdown fences.`,
      }],
    });

    let parsed;
    try {
      const text = response.content[0]?.text || '{}';
      parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    // Store each asset type
    const stored = [];
    for (const assetType of ASSET_TYPES) {
      if (!parsed[assetType]) continue;
      const content = typeof parsed[assetType] === 'string' ? { text: parsed[assetType] } : (Array.isArray(parsed[assetType]) ? { items: parsed[assetType] } : parsed[assetType]);

      await safeQuery(sb =>
        sb.from('onboarding_assets').upsert({
          account_id: req.accountId,
          product: productId,
          platform: platformId,
          asset_type: assetType,
          content,
          generated_at: new Date().toISOString(),
        }, { onConflict: 'account_id,product,platform,asset_type' })
      );
      stored.push(assetType);
    }

    // Update status to in_progress
    await safeQuery(sb =>
      sb.from('onboarding_status').upsert({
        account_id: req.accountId,
        product: productId,
        platform: platformId,
        status: 'in_progress',
      }, { onConflict: 'account_id,product,platform' })
    );

    res.json({ assets: parsed, stored, product: productId, platform: platformId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /onboarding/generate-all — generate for all platforms for a product ──

router.post('/generate-all', async (req, res) => {
  try {
    const { product: productId } = req.body;
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return res.status(400).json({ error: 'Invalid product' });

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic();

    const results = {};
    // Process sequentially to avoid rate limits
    for (const platform of PLATFORMS) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1800,
          messages: [{
            role: 'user',
            content: `Generate setup assets for "${product.name}" on "${platform.name}".
Brand: ${product.voice}. Colors: ${product.colors}. Style: ${product.style}.
Username max: ${platform.nameMax || 'flexible'}. Bio max: ${platform.bioMax} chars.${platform.bannerSize ? ` Banner: ${platform.bannerSize}.` : ''}

Return JSON with: account_names (3 usernames), bio (text), profile_image_prompt, banner_image_prompt, initial_content (first post), settings_checklist (4-6 items array).
JSON only, no fences.`,
          }],
        });

        let parsed;
        try {
          const text = response.content[0]?.text || '{}';
          parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
        } catch { parsed = {}; }

        for (const assetType of ASSET_TYPES) {
          if (!parsed[assetType]) continue;
          const content = typeof parsed[assetType] === 'string' ? { text: parsed[assetType] } : (Array.isArray(parsed[assetType]) ? { items: parsed[assetType] } : parsed[assetType]);

          await safeQuery(sb =>
            sb.from('onboarding_assets').upsert({
              account_id: req.accountId,
              product: productId,
              platform: platform.id,
              asset_type: assetType,
              content,
              generated_at: new Date().toISOString(),
            }, { onConflict: 'account_id,product,platform,asset_type' })
          );
        }

        await safeQuery(sb =>
          sb.from('onboarding_status').upsert({
            account_id: req.accountId,
            product: productId,
            platform: platform.id,
            status: 'in_progress',
          }, { onConflict: 'account_id,product,platform' })
        );

        results[platform.id] = parsed;
      } catch (err) {
        results[platform.id] = { error: err.message };
      }
    }

    res.json({ product: productId, results, platformCount: Object.keys(results).length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /onboarding/regenerate — regenerate a single asset ──

router.post('/regenerate', async (req, res) => {
  try {
    const { product: productId, platform: platformId, assetType } = req.body;
    const product = PRODUCTS.find(p => p.id === productId);
    const platform = PLATFORMS.find(p => p.id === platformId);
    if (!product || !platform || !ASSET_TYPES.includes(assetType)) {
      return res.status(400).json({ error: 'Invalid product, platform, or asset type' });
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic();

    const prompts = {
      account_names: `Generate 3 NEW username suggestions for "${product.name}" on "${platform.name}". Max ${platform.nameMax || 'flexible'} chars. ${platform.nameRules || ''}. Brand voice: ${product.voice}. Return JSON: {"items": ["name1", "name2", "name3"]}`,
      bio: `Write a NEW bio for "${product.name}" on "${platform.name}". Max ${platform.bioMax} chars. Brand: ${product.voice}. Return JSON: {"text": "the bio"}`,
      profile_image_prompt: `Write a NEW AI image generation prompt for "${product.name}" profile picture. 400x400 square. Colors: ${product.colors}. Style: ${product.style}. Return JSON: {"text": "the prompt"}`,
      banner_image_prompt: `Write a NEW AI image generation prompt for "${product.name}" banner on "${platform.name}". ${platform.bannerSize || 'standard'} dimensions. Colors: ${product.colors}. Style: ${product.style}. Return JSON: {"text": "the prompt"}`,
      initial_content: `Write a NEW first post for "${product.name}" on "${platform.name}". Brand: ${product.voice}. Return JSON: {"text": "the post"}`,
      settings_checklist: `List 4-6 specific settings to configure for "${product.name}" on "${platform.name}". Return JSON: {"items": ["setting1", "setting2", ...]}`,
    };

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompts[assetType] + ' JSON only, no fences.' }],
    });

    let parsed;
    try {
      const text = response.content[0]?.text || '{}';
      parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    await safeQuery(sb =>
      sb.from('onboarding_assets').upsert({
        account_id: req.accountId,
        product: productId,
        platform: platformId,
        asset_type: assetType,
        content: parsed,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,product,platform,asset_type' })
    );

    res.json({ assetType, content: parsed, product: productId, platform: platformId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /onboarding/status — update platform status ──

router.put('/status', async (req, res) => {
  try {
    const { product, platform, status } = req.body;
    if (!product || !platform || !['not_started', 'in_progress', 'connected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid product, platform, or status' });
    }

    const { data, error } = await safeQuery(sb =>
      sb.from('onboarding_status').upsert({
        account_id: req.accountId,
        product,
        platform,
        status,
        connected_at: status === 'connected' ? new Date().toISOString() : null,
      }, { onConflict: 'account_id,product,platform' }).select().single()
    );

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /onboarding/satellites — generate satellite blog/tool assets ──

router.post('/satellites', async (req, res) => {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Generate onboarding assets for satellite blogs and vertical tools for a SaaS business with 3 products: ChronoStates.io (historical strategy game), Payroll Beacon (payroll software), Budgeting Beacon (budgeting app).

For each product, suggest:
1. 2 satellite blog ideas: domain suggestion, title, tagline, 3 initial content outlines
2. 1 vertical tool idea: domain, title, description, deployment checklist (5 steps)

Return as JSON:
{
  "chronostates": { "blogs": [...], "tools": [...] },
  "payroll_beacon": { "blogs": [...], "tools": [...] },
  "budgeting_beacon": { "blogs": [...], "tools": [...] }
}
JSON only, no fences.`,
      }],
    });

    let parsed;
    try {
      const text = response.content[0]?.text || '{}';
      parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    // Store as a special asset
    await safeQuery(sb =>
      sb.from('onboarding_assets').upsert({
        account_id: req.accountId,
        product: 'all',
        platform: 'satellites',
        asset_type: 'satellite_assets',
        content: parsed,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,product,platform,asset_type' })
    );

    res.json({ satellites: parsed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /onboarding/email-domains — generate email domain setup checklist ──

router.post('/email-domains', async (req, res) => {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Generate a checklist for setting up 5 secondary email domains for outreach for a SaaS business (products: ChronoStates.io, Payroll Beacon, Budgeting Beacon).

For each of 5 domains, provide:
- Suggested domain name
- Purpose (which product/outreach type)
- DNS setup steps: MX, SPF, DKIM, DMARC records (specific values)
- Mailbox creation steps
- Warmup configuration (daily send limits, ramp schedule)

Return as JSON array of 5 domain objects.
JSON only, no fences.`,
      }],
    });

    let parsed;
    try {
      const text = response.content[0]?.text || '[]';
      parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    await safeQuery(sb =>
      sb.from('onboarding_assets').upsert({
        account_id: req.accountId,
        product: 'all',
        platform: 'email_domains',
        asset_type: 'domain_setup',
        content: { domains: parsed },
        generated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,product,platform,asset_type' })
    );

    res.json({ domains: parsed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
