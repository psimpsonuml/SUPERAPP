// ══════════════════════════════════════════════════════════════════
// Community Planner
//
// Rule parsing + content-calendar generation. Formerly the standalone
// "community-strategist" agent; now phase 2 of Community Scout.
// Not a registered agent — instantiated by CommunityScoutAgent.
// ══════════════════════════════════════════════════════════════════

const https = require('https');
const Anthropic = require('@anthropic-ai/sdk');
const products = require('../config/products');

const CLASSIFICATIONS = ['open_to_marketing', 'designated_threads_only', 'value_only', 'unclear'];

// Days-of-week for calendar generation
const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Warmup period: 2 weeks of pure engagement before any content posting
const WARMUP_ENGAGEMENTS = 14;

class CommunityPlanner {
  constructor({ accountId, supabase, logger }) {
    this.accountId = accountId;
    this.supabase = supabase;
    this.logger = logger;
    this.agentId = 'community-scout';
    this.anthropic = new Anthropic();
  }

  // ── Main planning pass ─────────────────────────────────
  async plan() {
    const results = {
      communitiesAnalyzed: 0,
      calendarEntriesCreated: 0,
      flaggedForReview: 0,
      warmupScheduled: 0,
    };

    // Get all communities — re-analyze discovered or stale ones
    const { data: communities } = await this.supabase
      .from('community_profiles')
      .select('*')
      .eq('account_id', this.accountId)
      .order('overall_score', { ascending: false });

    if (!communities || communities.length === 0) {
      this.logger.info('No communities to analyze', { agentId: this.agentId });
      return results;
    }

    // Clear next week's scheduled entries (regenerate fresh)
    const nextMonday = this.getNextMonday();
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextSunday.getDate() + 6);
    await this.supabase
      .from('content_calendar')
      .delete()
      .eq('account_id', this.accountId)
      .eq('status', 'scheduled')
      .gte('date', nextMonday.toISOString().slice(0, 10))
      .lte('date', nextSunday.toISOString().slice(0, 10));

    for (const community of communities) {
      try {
        // Step 1: Fetch and parse rules
        const rulesData = await this.fetchRules(community);

        // Step 2: Analyze rules with Claude
        const analysis = await this.analyzeRulesWithClaude(community, rulesData);

        // Step 3: Update community_profiles with parsed rules and classification
        await this.supabase
          .from('community_profiles')
          .update({
            rules_json: {
              ...community.rules_json,
              parsed: analysis,
              raw_rules: rulesData,
            },
            classification: analysis.classification,
            rule_friendliness: this.mapClassificationToFriendliness(analysis.classification),
            last_scanned: new Date().toISOString(),
          })
          .eq('id', community.id);

        if (analysis.classification === 'unclear') {
          results.flaggedForReview++;
        }

        // Step 4: Generate calendar entries
        const entries = this.generateCalendar(community, analysis, nextMonday);

        for (const entry of entries) {
          await this.supabase.from('content_calendar').insert({
            account_id: this.accountId,
            date: entry.date,
            product: entry.product,
            platform: community.platform,
            community_id: community.id,
            community_name: community.name,
            post_type: entry.postType,
            content_theme: entry.theme,
            rules_summary: analysis.summary,
            status: 'scheduled',
            approval_tier: entry.tier,
            metadata_json: {
              classification: analysis.classification,
              frequency_limit: analysis.posting_frequency_limit,
              designated_days: analysis.designated_promo_days,
            },
          });
          results.calendarEntriesCreated++;
          if (entry.postType.startsWith('warmup_')) results.warmupScheduled++;
        }

        results.communitiesAnalyzed++;
      } catch (err) {
        this.logger.warn(`Failed to analyze ${community.name}`, {
          error: err.message,
          agentId: this.agentId,
        });
      }
    }

    return results;
  }

  // ── Fetch rules for a community ────────────────────────
  async fetchRules(community) {
    const rulesData = {
      description: community.description || '',
      existingRules: community.rules_json?.rules || [],
      sidebar: '',
      wiki: '',
      pinnedPosts: [],
    };

    if (community.platform === 'reddit') {
      const subName = (community.name || '').replace('r/', '');
      if (!subName) return rulesData;

      // Fetch sidebar / about
      try {
        const about = await this.fetchJson(
          `https://www.reddit.com/r/${subName}/about.json`,
          { 'User-Agent': 'BeaconOps/2.0 Community Scout' }
        );
        rulesData.sidebar = (about?.data?.description || '').slice(0, 3000);
        rulesData.description = about?.data?.public_description || rulesData.description;
      } catch (e) { /* optional */ }

      // Fetch rules page
      try {
        const rules = await this.fetchJson(
          `https://www.reddit.com/r/${subName}/about/rules.json`,
          { 'User-Agent': 'BeaconOps/2.0 Community Scout' }
        );
        rulesData.existingRules = (rules?.rules || []).map(r => ({
          title: r.short_name,
          description: (r.description || '').slice(0, 500),
          kind: r.kind,
        }));
      } catch (e) { /* optional */ }

      // Fetch wiki rules page
      try {
        const wiki = await this.fetchJson(
          `https://www.reddit.com/r/${subName}/wiki/rules.json`,
          { 'User-Agent': 'BeaconOps/2.0 Community Scout' }
        );
        rulesData.wiki = (wiki?.data?.content_md || '').slice(0, 3000);
      } catch (e) { /* optional */ }

      // Fetch pinned/stickied posts
      try {
        const hot = await this.fetchJson(
          `https://www.reddit.com/r/${subName}/hot.json?limit=5`,
          { 'User-Agent': 'BeaconOps/2.0 Community Scout' }
        );
        rulesData.pinnedPosts = (hot?.data?.children || [])
          .filter(c => c.data?.stickied)
          .map(c => ({
            title: c.data.title,
            text: (c.data.selftext || '').slice(0, 500),
            flair: c.data.link_flair_text,
          }));
      } catch (e) { /* optional */ }

      await this.sleep(1500); // Rate limit
    }

    // For non-Reddit: use stored description and rules from Scout
    return rulesData;
  }

  // ── Claude rule analysis ───────────────────────────────
  async analyzeRulesWithClaude(community, rulesData) {
    const fallback = {
      classification: 'unclear',
      self_promo_policy: 'unclear',
      posting_frequency_limit: null,
      flair_requirements: [],
      link_restrictions: 'unknown',
      participation_ratio: null,
      designated_promo_days: [],
      required_formats: [],
      summary: 'Could not analyze rules',
    };

    const rulesText = [
      rulesData.description && `Description: ${rulesData.description}`,
      rulesData.sidebar && `Sidebar: ${rulesData.sidebar}`,
      rulesData.existingRules?.length > 0 && `Rules:\n${rulesData.existingRules.map(r => `- ${r.title}: ${r.description}`).join('\n')}`,
      rulesData.wiki && `Wiki rules page: ${rulesData.wiki}`,
      rulesData.pinnedPosts?.length > 0 && `Pinned posts:\n${rulesData.pinnedPosts.map(p => `- ${p.title}${p.flair ? ` [${p.flair}]` : ''}: ${p.text}`).join('\n')}`,
    ].filter(Boolean).join('\n\n');

    if (!rulesText || rulesText.length < 20) {
      return { ...fallback, summary: 'No rules text available' };
    }

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Analyze these community rules for "${community.name}" on ${community.platform} and extract structured data.

${rulesText}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "classification": "open_to_marketing|designated_threads_only|value_only|unclear",
  "self_promo_policy": "allowed|designated_threads_only|prohibited|unclear",
  "posting_frequency_limit": "string like '1 per week' or null",
  "flair_requirements": ["list of required/available flairs"],
  "link_restrictions": "links_allowed|text_only|domain_whitelist|unknown",
  "participation_ratio": "string like '9:1' or null",
  "designated_promo_days": ["list like 'Self-Promo Saturday'"],
  "required_formats": ["list of format requirements"],
  "summary": "2-3 sentence summary of what's allowed and what's not"
}

Classification guide:
- open_to_marketing: Self-promotion is allowed within rate limits
- designated_threads_only: Self-promotion only in specific threads/days
- value_only: No marketing. Engage only by answering questions and providing value
- unclear: Rules are ambiguous — needs manual review`,
        }],
      });

      const text = (response.content[0]?.text || '').trim();
      const parsed = JSON.parse(text);

      // Validate classification
      if (!CLASSIFICATIONS.includes(parsed.classification)) {
        parsed.classification = 'unclear';
      }

      return parsed;
    } catch (err) {
      this.logger.warn(`Claude rule analysis failed for ${community.name}`, { error: err.message });
      return { ...fallback, summary: `Analysis failed: ${err.message}` };
    }
  }

  // ── Calendar generation ────────────────────────────────
  generateCalendar(community, analysis, weekStart) {
    const entries = [];
    const product = community.product;
    const weekDates = this.getWeekDates(weekStart);

    // Check if warmup is needed
    const needsWarmup = !community.warmup_complete &&
      (community.engagement_count || 0) < WARMUP_ENGAGEMENTS;

    if (needsWarmup) {
      return this.generateWarmupSchedule(community, product, weekDates);
    }

    switch (analysis.classification) {
      case 'open_to_marketing':
        return this.scheduleOpenMarketing(community, product, analysis, weekDates);
      case 'designated_threads_only':
        return this.scheduleDesignatedThreads(community, product, analysis, weekDates);
      case 'value_only':
        return this.scheduleValueOnly(community, product, weekDates);
      case 'unclear':
        entries.push({
          date: weekDates[0],
          product,
          postType: 'manual_review',
          theme: `Review rules for ${community.name} — classification unclear`,
          tier: 3,
        });
        return entries;
      default:
        return entries;
    }
  }

  // ── Warmup schedule: pure engagement, no posting ───────
  generateWarmupSchedule(community, product, weekDates) {
    const entries = [];
    // 3 engagements per week during warmup
    const engagementDays = [weekDates[1], weekDates[3], weekDates[5]]; // Tue, Thu, Sat

    for (const date of engagementDays) {
      entries.push({
        date,
        product,
        postType: 'warmup_comment',
        theme: `Warmup: Comment on popular post in ${community.name} — provide genuine value, no product mentions`,
        tier: 1,
      });
    }

    return entries;
  }

  // ── Open marketing: post within rate limits ────────────
  scheduleOpenMarketing(community, product, analysis, weekDates) {
    const entries = [];
    const limit = this.parseFrequencyLimit(analysis.posting_frequency_limit);

    // Default: 2 posts per week for open communities
    const postsPerWeek = Math.min(limit || 2, 3);

    // Spread posts across the week
    const postDays = postsPerWeek === 1 ? [weekDates[2]]
      : postsPerWeek === 2 ? [weekDates[1], weekDates[4]]
      : [weekDates[1], weekDates[3], weekDates[5]];

    for (let i = 0; i < postDays.length; i++) {
      // Alternate between value posts and posts with subtle product mention
      const postType = i === 0 ? 'value_post_with_mention' : 'value_post';
      const productName = products[product]?.name || product;

      entries.push({
        date: postDays[i],
        product,
        postType,
        theme: postType === 'value_post_with_mention'
          ? `Share insight related to ${productName} in ${community.name}`
          : `Value post in ${community.name} — establish expertise`,
        tier: 2,
      });
    }

    // Add 1 engagement action
    entries.push({
      date: weekDates[0],
      product,
      postType: 'comment_engagement',
      theme: `Comment on active thread in ${community.name} — build visibility`,
      tier: 1,
    });

    return entries;
  }

  // ── Designated threads only ────────────────────────────
  scheduleDesignatedThreads(community, product, analysis, weekDates) {
    const entries = [];
    const promoDays = analysis.designated_promo_days || [];

    if (promoDays.length > 0) {
      // Map promo day names to actual dates
      for (const promoDay of promoDays) {
        const dayName = promoDay.toLowerCase();
        const dayIndex = DOW.findIndex(d => dayName.includes(d));
        if (dayIndex >= 0) {
          const targetDate = weekDates.find(d => new Date(d).getDay() === dayIndex);
          if (targetDate) {
            entries.push({
              date: targetDate,
              product,
              postType: 'promo_thread_entry',
              theme: `Post in ${promoDay} thread in ${community.name}`,
              tier: 2,
            });
          }
        }
      }
    } else {
      // No specific days known — schedule one mid-week check
      entries.push({
        date: weekDates[2],
        product,
        postType: 'promo_thread_entry',
        theme: `Find and post in promo thread in ${community.name}`,
        tier: 2,
      });
    }

    // Add engagement on non-promo days
    entries.push({
      date: weekDates[1],
      product,
      postType: 'question_answer',
      theme: `Answer a question in ${community.name} — build reputation`,
      tier: 1,
    });

    return entries;
  }

  // ── Value only: no marketing, just engagement ──────────
  scheduleValueOnly(community, product, weekDates) {
    const entries = [];

    // 3 engagement actions per week
    entries.push({
      date: weekDates[1],
      product,
      postType: 'question_answer',
      theme: `Find unanswered question in ${community.name} — provide expert answer`,
      tier: 1,
    });

    entries.push({
      date: weekDates[3],
      product,
      postType: 'comment_engagement',
      theme: `Comment on popular post in ${community.name} — share genuine insight`,
      tier: 1,
    });

    entries.push({
      date: weekDates[5],
      product,
      postType: 'value_post',
      theme: `Share helpful content in ${community.name} — no product mention`,
      tier: 1,
    });

    return entries;
  }

  // ── Helpers ────────────────────────────────────────────
  parseFrequencyLimit(limitStr) {
    if (!limitStr) return null;
    const match = limitStr.match(/(\d+)\s*per\s*(day|week|month)/i);
    if (!match) return null;
    const count = parseInt(match[1], 10);
    const period = match[2].toLowerCase();
    if (period === 'day') return count * 7;
    if (period === 'week') return count;
    if (period === 'month') return Math.max(1, Math.round(count / 4));
    return count;
  }

  mapClassificationToFriendliness(classification) {
    const map = {
      open_to_marketing: 'promotion_friendly',
      designated_threads_only: 'limited_promotion',
      value_only: 'no_marketing',
      unclear: 'unknown',
    };
    return map[classification] || 'unknown';
  }

  getNextMonday() {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  getWeekDates(monday) {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }

  fetchJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: { Accept: 'application/json', ...headers },
        timeout: 10000,
      };
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error(`Invalid JSON from ${parsedUrl.hostname}`)); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      req.end();
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CommunityPlanner;
