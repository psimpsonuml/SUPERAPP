const BaseAgent = require('./base-agent');
const Anthropic = require('@anthropic-ai/sdk');
const https = require('https');
const config = require('../config');
const { searchOrEmpty } = require('../shared/search');
const { sendOutreach } = require('../shared/email');

// ── Product-specific prospect search config ──────────────────

const PRODUCT_SEARCH = {
  chronostates: {
    redditSubs: ['worldbuilding', 'interactivefiction', 'aistories', 'rpg', 'alternatehistory', 'WritingPrompts', 'proceduralgeneration', 'gamedev', 'indiegaming', 'aigaming'],
    redditKeywords: ['ai storytelling', 'alternate history game', 'interactive fiction', 'worldbuilding tool', 'ai game master', 'procedural narrative', 'historical simulation', 'choice based game', 'ai rpg', 'text adventure'],
    xKeywords: ['ai storytelling', 'alternate history', 'interactive fiction', 'worldbuilding', 'ai game', 'procedural narrative'],
    webSearchQueries: [
      'looking for alternate history game',
      'ai storytelling interactive fiction tool',
      'wish there was historical simulation game',
      'anyone know ai rpg worldbuilding',
    ],
    icpSignals: ['wish there was', 'anyone know', 'looking for', 'recommend me', 'just discovered', 'I want to play', 'something like', 'ai that does', 'game where you can'],
  },
  payroll_beacon: {
    redditSubs: ['payroll', 'humanresources', 'smallbusiness', 'Accounting', 'taxpros', 'cpa'],
    redditKeywords: ['multi-state payroll', 'payroll compliance', 'state tax withholding', 'payroll software frustration', 'hr director payroll', 'multistate employer', 'payroll headache', 'compliance nightmare', 'switching payroll'],
    linkedinQueries: [
      'site:linkedin.com/in payroll manager multi-state',
      'site:linkedin.com/in hr director payroll compliance',
      'site:linkedin.com/in cpa payroll services multi-state',
      'site:linkedin.com/in payroll specialist 50 employees',
    ],
    webSearchQueries: [
      'payroll manager multi-state compliance challenges',
      'hr director frustrated payroll software',
      'cpa multi-state payroll problems',
      'small business payroll 50 employees multiple states',
    ],
    icpSignals: ['compliance', 'multi-state', 'nightmare', 'frustrat', 'switch', 'hate our payroll', 'looking for better', 'any recommendations', 'worst part about', 'state by state'],
    icpTitles: ['Payroll Manager', 'HR Director', 'VP of HR', 'Payroll Administrator', 'CPA', 'Controller', 'HR Business Partner', 'People Operations'],
    companySizeRange: { min: 50, max: 500 },
  },
  budgeting_beacon: {
    redditSubs: ['personalfinance', 'budgeting', 'ynab', 'financialplanning', 'FinancialCareers', 'financialindependence', 'Frugal'],
    redditKeywords: ['budgeting tool', 'budget app alternative', 'financial coach', 'ynab alternative', 'personal finance app', 'budgeting software', 'expense tracker', 'money management'],
    xKeywords: ['budgeting app', 'personal finance tool', 'money management', 'financial coach', 'budget tracker', 'ynab alternative'],
    webSearchQueries: [
      'financial coach budgeting tools review',
      'personal finance content creator budget app',
      'fintech reviewer budgeting software',
      'looking for budgeting app alternative ynab',
    ],
    icpSignals: ['looking for', 'alternative to', 'switched from', 'any good', 'recommend', 'budget app', 'trying to find', 'need a tool', 'financial coach', 'content creator'],
  },
};

// ── Partnership search config (Payroll Beacon only) ──────────

const PARTNERSHIP_SEARCH = {
  searchQueries: [
    'payroll service bureau',
    'regional payroll company',
    'hr technology company payroll',
    'benefits administrator payroll',
    'peo professional employer organization',
    'payroll service bureau California',
    'payroll service bureau Texas',
    'payroll service bureau New York',
    'payroll service bureau Florida',
    'small payroll company multi-state',
    'site:linkedin.com/company payroll service bureau',
    'site:linkedin.com/company regional payroll',
  ],
  targetTypes: ['payroll_company', 'service_bureau', 'hr_tech', 'benefits_admin', 'peo'],
  valueProps: [
    '10,000+ compliance data points across all 50 states',
    'Real-time state law change tracking',
    'API-first integration for existing payroll platforms',
    'White-label compliance module option',
  ],
};

// ── Daily limits ─────────────────────────────────────────────

const DAILY_LIMITS = {
  emailsPerProduct: 30,
  partnershipPitches: 10,
};

class OutreachProspectorAgent extends BaseAgent {
  static agentId = 'outreach-prospector';
  static agentName = 'Outreach Prospector';

  constructor(accountId) {
    super(accountId, {
      agentId: 'outreach-prospector',
      agentName: 'Outreach Prospector',
      cycle: 'daily',
      defaultTier: 2,
    });
    this.anthropic = new Anthropic({ apiKey: config.llm.anthropic.apiKey });
  }

  async run() {
    const results = {
      prospectsFound: 0,
      emailsDrafted: 0,
      partnershipPitches: 0,
      byProduct: {},
      errors: [],
    };

    // ── Track A: End-user outreach per product ───────────
    for (const productId of Object.keys(PRODUCT_SEARCH)) {
      const productResults = { found: 0, drafted: 0 };

      try {
        // Check how many we've already drafted today
        const todayCount = await this.getTodayDraftCount(productId, 'user');
        const remaining = DAILY_LIMITS.emailsPerProduct - todayCount;

        if (remaining <= 0) {
          this.logger.info(`Daily limit reached for ${productId} (${todayCount}/${DAILY_LIMITS.emailsPerProduct})`, { agentId: this.agentId });
          results.byProduct[productId] = productResults;
          continue;
        }

        // Discover prospects from multiple sources
        const prospects = await this.discoverProspects(productId, remaining);
        productResults.found = prospects.length;
        results.prospectsFound += prospects.length;

        // Score, store, and draft emails for qualifying prospects
        for (const prospect of prospects) {
          try {
            // Check for duplicate
            const isDupe = await this.isDuplicate(prospect);
            if (isDupe) continue;

            // Score ICP fit with Claude
            const scored = await this.scoreProspect(prospect, productId);
            prospect.icp_score = scored.score;
            prospect.notes = scored.reasoning;

            // Store in pipeline
            const prospectId = await this.storeProspect(prospect, productId, 'user');

            // Draft email for 7+ scores
            if (scored.score >= 7) {
              const draft = await this.draftOutreachEmail(prospect, productId);
              await this.updateDraftedEmail(prospectId, draft);

              await this.submitForApproval({
                itemType: 'outreach_email',
                tier: 2,
                contentPreview: `[${productId}] To: ${prospect.name || 'Unknown'} — ${draft.subject}`,
                fullContent: {
                  product: productId,
                  track: 'user',
                  prospectId,
                  prospect,
                  email: draft,
                },
              });

              productResults.drafted++;
              results.emailsDrafted++;
            }
          } catch (err) {
            this.logger.error(`Error processing prospect: ${err.message}`, { agentId: this.agentId });
            results.errors.push(`${productId}: ${err.message}`);
          }
        }
      } catch (err) {
        this.logger.error(`Track A error for ${productId}: ${err.message}`, { agentId: this.agentId });
        results.errors.push(`Track A ${productId}: ${err.message}`);
      }

      results.byProduct[productId] = productResults;
    }

    // ── Track B: Partnership outreach (Payroll Beacon) ───
    try {
      const todayPartnerCount = await this.getTodayDraftCount('payroll_beacon', 'partner');
      const partnerRemaining = DAILY_LIMITS.partnershipPitches - todayPartnerCount;

      if (partnerRemaining > 0) {
        const partners = await this.discoverPartners(partnerRemaining);

        for (const partner of partners) {
          try {
            const isDupe = await this.isDuplicate(partner);
            if (isDupe) continue;

            const scored = await this.scorePartner(partner);
            partner.icp_score = scored.score;
            partner.notes = scored.reasoning;

            const prospectId = await this.storeProspect(partner, 'payroll_beacon', 'partner');

            if (scored.score >= 6) {
              const pitch = await this.draftPartnershipPitch(partner);
              await this.updateDraftedEmail(prospectId, pitch);

              await this.submitForApproval({
                itemType: 'partnership_pitch',
                tier: 2,
                contentPreview: `[Partnership] ${partner.name} (${partner.company || 'Unknown'}) — ${pitch.subject}`,
                fullContent: {
                  product: 'payroll_beacon',
                  track: 'partner',
                  prospectId,
                  partner,
                  pitch,
                },
              });

              results.partnershipPitches++;
            }
          } catch (err) {
            this.logger.error(`Partner prospect error: ${err.message}`, { agentId: this.agentId });
            results.errors.push(`Partnership: ${err.message}`);
          }
        }
      }
    } catch (err) {
      this.logger.error(`Track B error: ${err.message}`, { agentId: this.agentId });
      results.errors.push(`Track B: ${err.message}`);
    }

    this.itemsProduced = results.prospectsFound + results.emailsDrafted + results.partnershipPitches;
    return results;
  }

  // ════════════════════════════════════════════════════════════
  //  PROSPECT DISCOVERY
  // ════════════════════════════════════════════════════════════

  async discoverProspects(productId, limit) {
    const searchConfig = PRODUCT_SEARCH[productId];
    const allProspects = [];

    // 1. Reddit search
    const redditProspects = await this.searchReddit(searchConfig, productId);
    allProspects.push(...redditProspects);

    // 2. X/Twitter search (via web search proxy)
    const xProspects = await this.searchX(searchConfig, productId);
    allProspects.push(...xProspects);

    // 3. LinkedIn search (Payroll Beacon — via web search)
    if (searchConfig.linkedinQueries) {
      const linkedinProspects = await this.searchLinkedIn(searchConfig, productId);
      allProspects.push(...linkedinProspects);
    }

    // 4. Web search for intent signals
    const webProspects = await this.searchWeb(searchConfig, productId);
    allProspects.push(...webProspects);

    // Deduplicate by source_url
    const seen = new Set();
    const unique = allProspects.filter(p => {
      const key = p.source_url || `${p.name}-${p.platform}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.slice(0, limit);
  }

  async searchReddit(searchConfig, productId) {
    const prospects = [];

    for (const sub of (searchConfig.redditSubs || []).slice(0, 5)) {
      for (const keyword of (searchConfig.redditKeywords || []).slice(0, 3)) {
        try {
          const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(keyword)}&restrict_sr=1&sort=new&limit=10&t=week`;
          const data = await this.httpGet(url, {
            'User-Agent': 'BeaconOps/1.0 (Outreach Prospector)',
          });

          const posts = data?.data?.children || [];
          for (const post of posts) {
            const d = post.data;
            if (!d || d.author === '[deleted]' || d.author === 'AutoModerator') continue;

            // Check for ICP signals in the post
            const text = `${d.title || ''} ${d.selftext || ''}`.toLowerCase();
            const hasSignal = (searchConfig.icpSignals || []).some(sig => text.includes(sig.toLowerCase()));
            if (!hasSignal && d.score < 5) continue;

            prospects.push({
              name: d.author,
              platform: 'reddit',
              source: `r/${sub}`,
              source_url: `https://reddit.com${d.permalink}`,
              context: (d.title || '').slice(0, 300),
              postText: (d.selftext || '').slice(0, 500),
              postScore: d.score,
              subreddit: sub,
            });
          }

          await sleep(1200);
        } catch (err) {
          this.logger.debug(`Reddit search error r/${sub}: ${err.message}`, { agentId: this.agentId });
        }
      }
    }

    return prospects;
  }

  async searchX(searchConfig, productId) {
    const prospects = [];
    const keywords = searchConfig.xKeywords || searchConfig.redditKeywords || [];

    for (const keyword of keywords.slice(0, 3)) {
      try {
        const query = encodeURIComponent(`"${keyword}" site:x.com OR site:twitter.com`);
        const results = await this.webSearch(query);

        for (const result of results.slice(0, 5)) {
          const urlMatch = (result.url || '').match(/(?:x\.com|twitter\.com)\/([^\/\?]+)/);
          if (!urlMatch) continue;
          const handle = urlMatch[1];
          if (['search', 'explore', 'hashtag', 'i', 'home'].includes(handle)) continue;

          prospects.push({
            name: `@${handle}`,
            platform: 'x',
            source: 'X/Twitter',
            source_url: result.url,
            context: (result.title || '').slice(0, 300),
            postText: (result.snippet || '').slice(0, 500),
          });
        }

        await sleep(1500);
      } catch (err) {
        this.logger.debug(`X search error: ${err.message}`, { agentId: this.agentId });
      }
    }

    return prospects;
  }

  async searchLinkedIn(searchConfig, productId) {
    const prospects = [];

    for (const query of (searchConfig.linkedinQueries || []).slice(0, 4)) {
      try {
        const results = await this.webSearch(query);

        for (const result of results.slice(0, 5)) {
          if (!(result.url || '').includes('linkedin.com/in/')) continue;

          // Extract name from title (usually "Name - Title - Company | LinkedIn")
          const titleParts = (result.title || '').split(/\s*[-–|]\s*/);
          const name = titleParts[0]?.trim() || 'Unknown';
          const title = titleParts[1]?.trim() || '';
          const company = titleParts[2]?.replace(/\s*\|?\s*LinkedIn\s*$/i, '').trim() || '';

          prospects.push({
            name,
            title,
            company,
            platform: 'linkedin',
            source: 'LinkedIn',
            source_url: result.url,
            linkedin_url: result.url,
            context: (result.snippet || '').slice(0, 300),
          });
        }

        await sleep(1500);
      } catch (err) {
        this.logger.debug(`LinkedIn search error: ${err.message}`, { agentId: this.agentId });
      }
    }

    return prospects;
  }

  async searchWeb(searchConfig, productId) {
    const prospects = [];

    for (const query of (searchConfig.webSearchQueries || []).slice(0, 3)) {
      try {
        const results = await this.webSearch(query);

        for (const result of results.slice(0, 5)) {
          // Skip generic results — we want forum posts, personal sites, social profiles
          const url = result.url || '';
          if (url.includes('wikipedia.org') || url.includes('amazon.com')) continue;

          const isReddit = url.includes('reddit.com');
          const isLinkedIn = url.includes('linkedin.com');
          const isForum = url.includes('forum') || url.includes('community') || url.includes('discuss');

          if (!isReddit && !isLinkedIn && !isForum) continue;

          prospects.push({
            name: this.extractNameFromResult(result),
            platform: isReddit ? 'reddit' : isLinkedIn ? 'linkedin' : 'forum',
            source: new URL(url).hostname,
            source_url: url,
            context: (result.title || '').slice(0, 300),
            postText: (result.snippet || '').slice(0, 500),
          });
        }

        await sleep(1500);
      } catch (err) {
        this.logger.debug(`Web search error: ${err.message}`, { agentId: this.agentId });
      }
    }

    return prospects;
  }

  // ════════════════════════════════════════════════════════════
  //  PARTNERSHIP DISCOVERY (Track B)
  // ════════════════════════════════════════════════════════════

  async discoverPartners(limit) {
    const partners = [];

    for (const query of PARTNERSHIP_SEARCH.searchQueries.slice(0, 8)) {
      try {
        const results = await this.webSearch(query);

        for (const result of results.slice(0, 5)) {
          const url = result.url || '';
          const title = result.title || '';
          const snippet = result.snippet || '';

          // Extract company info
          const isLinkedIn = url.includes('linkedin.com/company');
          const company = isLinkedIn
            ? title.split(/\s*[-–|]\s*/)[0]?.trim()
            : title.split(/\s*[-–|:]\s*/)[0]?.trim();

          if (!company || company.length < 3) continue;

          // Classify partner type
          const combined = `${title} ${snippet}`.toLowerCase();
          let partnerType = 'payroll_company';
          if (combined.includes('service bureau')) partnerType = 'service_bureau';
          else if (combined.includes('hr tech') || combined.includes('hris') || combined.includes('human capital')) partnerType = 'hr_tech';
          else if (combined.includes('benefits admin') || combined.includes('benefits broker')) partnerType = 'benefits_admin';
          else if (combined.includes('peo') || combined.includes('professional employer')) partnerType = 'peo';

          partners.push({
            name: company,
            company,
            platform: isLinkedIn ? 'linkedin' : 'web',
            source: isLinkedIn ? 'LinkedIn' : new URL(url).hostname,
            source_url: url,
            linkedin_url: isLinkedIn ? url : null,
            context: snippet.slice(0, 300),
            partnerType,
          });
        }

        await sleep(1500);
      } catch (err) {
        this.logger.debug(`Partner search error: ${err.message}`, { agentId: this.agentId });
      }
    }

    // Deduplicate by company name (case-insensitive)
    const seen = new Set();
    return partners.filter(p => {
      const key = p.company.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
  }

  // ════════════════════════════════════════════════════════════
  //  ICP SCORING (Claude)
  // ════════════════════════════════════════════════════════════

  async scoreProspect(prospect, productId) {
    const searchConfig = PRODUCT_SEARCH[productId];
    const titleMatch = (searchConfig.icpTitles || []).some(t =>
      (prospect.title || '').toLowerCase().includes(t.toLowerCase())
    );

    const prompt = `Score this prospect for ${productId} on a 1-10 ICP fit scale.

Prospect:
- Name: ${prospect.name || 'Unknown'}
- Title: ${prospect.title || 'Unknown'}
- Company: ${prospect.company || 'Unknown'}
- Platform: ${prospect.platform}
- Context: ${prospect.context || ''}
- Post content: ${prospect.postText || ''}
${titleMatch ? '- NOTE: Title matches ICP definition' : ''}

Product context:
${productId === 'chronostates' ? 'ChronoStates.io — AI-powered alternate history simulation game' : ''}
${productId === 'payroll_beacon' ? 'Payroll Beacon — Multi-state payroll compliance platform for companies with 50-500 employees' : ''}
${productId === 'budgeting_beacon' ? 'Budgeting Beacon — Personal finance and budgeting tool' : ''}

ICP signals to look for: ${(searchConfig.icpSignals || []).join(', ')}

Respond with JSON only: {"score": <1-10>, "reasoning": "<brief explanation>"}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0]?.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch?.[0] || '{"score": 3, "reasoning": "Could not parse"}');
    } catch (err) {
      this.logger.error(`Scoring error: ${err.message}`, { agentId: this.agentId });
      return { score: titleMatch ? 6 : 3, reasoning: 'Fallback score — API error' };
    }
  }

  async scorePartner(partner) {
    const prompt = `Score this potential partnership prospect for Payroll Beacon on a 1-10 fit scale.

Payroll Beacon is a multi-state payroll compliance platform with 10,000+ compliance data points across all 50 states. We're looking for partners who would benefit from integrating our compliance data.

Prospect:
- Company: ${partner.company || 'Unknown'}
- Type: ${partner.partnerType || 'Unknown'}
- Source: ${partner.source}
- Context: ${partner.context || ''}

Ideal partners: Regional payroll firms (not ADP/Paychex scale), payroll service bureaus, HR technology companies, benefits administrators, PEOs.

Respond with JSON only: {"score": <1-10>, "reasoning": "<brief explanation>"}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0]?.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch?.[0] || '{"score": 3, "reasoning": "Could not parse"}');
    } catch (err) {
      this.logger.error(`Partner scoring error: ${err.message}`, { agentId: this.agentId });
      return { score: 4, reasoning: 'Fallback score — API error' };
    }
  }

  // ════════════════════════════════════════════════════════════
  //  EMAIL DRAFTING (Claude + Brand Voice)
  // ════════════════════════════════════════════════════════════

  async draftOutreachEmail(prospect, productId) {
    const voicePrompt = await this.brandVoice.buildSystemPrompt(
      productId,
      'Draft a cold outreach email'
    );

    const prompt = `Draft a personalized cold outreach email to this person. Reference something specific from their post or profile. Keep it to 4-5 sentences max. Genuine value proposition, not salesy. Include a clear CTA.

Prospect:
- Name: ${prospect.name || 'there'}
- Title: ${prospect.title || ''}
- Company: ${prospect.company || ''}
- Platform: ${prospect.platform}
- Their post/context: ${prospect.context || ''} ${prospect.postText || ''}

${productId === 'chronostates' ? 'Product: ChronoStates.io — an AI-powered alternate history game where players create and explore what-if scenarios. Free to start.' : ''}
${productId === 'payroll_beacon' ? 'Product: Payroll Beacon — a multi-state payroll compliance platform. 10,000+ data points, all 50 states, real-time law tracking. Free trial available.' : ''}
${productId === 'budgeting_beacon' ? 'Product: Budgeting Beacon — a smart budgeting tool for people who want clarity and control over their finances. Free tier available.' : ''}

Respond with JSON: {"subject": "<email subject>", "body": "<email body>"}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: voicePrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0]?.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch?.[0] || '{"subject": "Quick question", "body": "Hi there"}');
    } catch (err) {
      this.logger.error(`Draft email error: ${err.message}`, { agentId: this.agentId });
      return {
        subject: `Quick question about ${prospect.context?.slice(0, 30) || 'your post'}`,
        body: `Hi ${prospect.name || 'there'}, I noticed your post and thought you might be interested in what we're building.`,
      };
    }
  }

  async draftPartnershipPitch(partner) {
    const voicePrompt = await this.brandVoice.buildSystemPrompt(
      'payroll_beacon',
      'Draft a partnership pitch email'
    );

    const prompt = `Draft a partnership pitch email to a payroll/HR company. This is a B2B partnership email, not cold sales. Position Payroll Beacon's compliance database as a complement to their existing service.

Company: ${partner.company || 'Unknown'}
Type: ${partner.partnerType || 'payroll company'}
Context: ${partner.context || ''}

Key value props to weave in naturally:
- 10,000+ compliance data points across all 50 states
- Real-time state law change tracking
- API-first integration for existing payroll platforms
- White-label compliance module option

Keep it professional but warm. 4-5 sentences. Suggest a quick 15-minute call to explore integration or white-label opportunities.

Respond with JSON: {"subject": "<email subject>", "body": "<email body>"}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: voicePrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0]?.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch?.[0] || '{"subject": "Partnership inquiry", "body": "Hello"}');
    } catch (err) {
      this.logger.error(`Draft partnership error: ${err.message}`, { agentId: this.agentId });
      return {
        subject: `Compliance data partnership — ${partner.company || 'Payroll Beacon'}`,
        body: `Hello, I'm reaching out from Payroll Beacon to explore a potential compliance data integration.`,
      };
    }
  }

  // ════════════════════════════════════════════════════════════
  //  EMAIL SENDING (Resend — only after Tier 2 approval)
  // ════════════════════════════════════════════════════════════

  // Sends via the shared email service, which enforces the suppression
  // list (fails closed) and mailbox rotation with per-day volume caps.
  // Returns a structured result — the dispatcher distinguishes a policy
  // refusal from a transport failure.
  async sendApprovedEmail(prospectId, emailDraft) {
    const { data: prospect } = await this.supabase
      .from('prospect_pipeline')
      .select('*')
      .eq('id', prospectId)
      .single();

    if (!prospect) {
      return { sent: false, reason: 'prospect_not_found' };
    }
    if (!prospect.email) {
      this.logger.warn(`No email address for prospect ${prospectId}`, { agentId: this.agentId });
      return { sent: false, reason: 'prospect_has_no_email' };
    }
    if (prospect.do_not_contact) {
      return { sent: false, reason: 'suppressed', suppressionReason: 'requested_no_contact' };
    }

    const result = await sendOutreach({
      accountId: this.accountId,
      to: prospect.email,
      subject: emailDraft.subject,
      text: emailDraft.body,
      product: prospect.product,
      unsubscribeUrl: this.buildUnsubscribeUrl(prospectId),
    });

    if (!result.sent) {
      this.logger.warn(`Outreach not sent to ${prospect.email}: ${result.reason}`, {
        agentId: this.agentId,
        prospectId,
      });
      return result;
    }

    await this.supabase
      .from('prospect_pipeline')
      .update({
        stage: prospect.track === 'partner' ? 'pitched' : 'contacted',
        last_contacted: new Date().toISOString(),
        touch_count: (prospect.touch_count || 0) + 1,
        sent_via: result.mailbox.email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', prospectId);

    await this.supabase.from('outreach_sends').insert({
      account_id: this.accountId,
      prospect_id: prospectId,
      product: prospect.product,
      track: prospect.track,
      mailbox_email: result.mailbox.email,
      message_id: result.messageId,
      subject: emailDraft.subject,
      sent_at: new Date().toISOString(),
    });

    return { sent: true, messageId: result.messageId, mailbox: result.mailbox.email };
  }

  buildUnsubscribeUrl(prospectId) {
    const base = config.urls?.base || 'http://localhost:3000';
    return `${base}/api/growth/unsubscribe?p=${encodeURIComponent(prospectId)}`;
  }

  // ════════════════════════════════════════════════════════════
  //  PIPELINE HELPERS
  // ════════════════════════════════════════════════════════════

  async getTodayDraftCount(productId, track) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count } = await this.supabase
      .from('prospect_pipeline')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', this.accountId)
      .eq('product', productId)
      .eq('track', track)
      .gte('created_at', todayStart.toISOString());

    return count || 0;
  }

  async isDuplicate(prospect) {
    // Check by source_url
    if (prospect.source_url) {
      const { count } = await this.supabase
        .from('prospect_pipeline')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', this.accountId)
        .eq('source_url', prospect.source_url);

      if (count > 0) return true;
    }

    // Check by name + platform (fuzzy)
    if (prospect.name && prospect.platform) {
      const { count } = await this.supabase
        .from('prospect_pipeline')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', this.accountId)
        .eq('platform', prospect.platform)
        .ilike('name', prospect.name);

      if (count > 0) return true;
    }

    return false;
  }

  async storeProspect(prospect, productId, track) {
    const stage = track === 'partner' ? 'identified' : 'discovered';

    const { data, error } = await this.supabase
      .from('prospect_pipeline')
      .insert({
        account_id: this.accountId,
        name: prospect.name || 'Unknown',
        email: prospect.email || null,
        linkedin_url: prospect.linkedin_url || null,
        company: prospect.company || null,
        title: prospect.title || null,
        product: productId,
        icp_score: prospect.icp_score || 0,
        track,
        stage,
        source: prospect.source || prospect.platform,
        source_url: prospect.source_url || null,
        platform: prospect.platform || null,
        notes: prospect.notes || null,
        metadata: {
          context: prospect.context,
          postText: prospect.postText,
          postScore: prospect.postScore,
          subreddit: prospect.subreddit,
          partnerType: prospect.partnerType,
        },
      })
      .select('id')
      .single();

    if (error) throw new Error(`Store prospect failed: ${error.message}`);
    return data.id;
  }

  async updateDraftedEmail(prospectId, draft) {
    const newStage = await this.getTrack(prospectId) === 'partner' ? 'pitch_drafted' : 'email_drafted';

    await this.supabase
      .from('prospect_pipeline')
      .update({
        drafted_email: draft,
        stage: newStage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', prospectId);
  }

  async getTrack(prospectId) {
    const { data } = await this.supabase
      .from('prospect_pipeline')
      .select('track')
      .eq('id', prospectId)
      .single();

    return data?.track || 'user';
  }

  // ════════════════════════════════════════════════════════════
  //  WEB SEARCH & HTTP HELPERS
  // ════════════════════════════════════════════════════════════

  // Real web search via the shared provider. This previously
  // regex-scraped html.duckduckgo.com as its primary path whenever
  // Google CSE keys were absent — brittle, and silently returned
  // nothing when the markup changed.
  async webSearch(query) {
    return searchOrEmpty(query, { limit: 10 }, this.logger);
  }

  extractNameFromResult(result) {
    const url = result.url || '';
    const title = result.title || '';

    // Reddit: extract username from URL
    const redditMatch = url.match(/reddit\.com\/u(?:ser)?\/([^\/\?]+)/);
    if (redditMatch) return redditMatch[1];

    // LinkedIn: first part of title
    if (url.includes('linkedin.com')) {
      return title.split(/\s*[-–|]\s*/)[0]?.trim() || 'Unknown';
    }

    // Forum: try title
    return title.split(/\s*[-–|:]\s*/)[0]?.trim().slice(0, 60) || 'Unknown';
  }

  httpGet(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...headers,
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
      req.end();
    });
  }

  httpGetText(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'Accept': 'text/html',
          ...headers,
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve(body));
      });

      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
      req.end();
    });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = OutreachProspectorAgent;
