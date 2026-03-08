const BaseAgent = require('./base-agent');

class CommunityStrategistAgent extends BaseAgent {
  static agentId = 'community-strategist';
  static agentName = 'Community Strategist';

  constructor(accountId) {
    super(accountId, {
      agentId: 'community-strategist',
      agentName: 'Community Strategist',
      cycle: 'weekly',
      defaultTier: 2,
    });

    this.classifications = ['open_to_marketing', 'designated_threads_only', 'no_marketing', 'unclear'];
  }

  async run() {
    const results = { communitiesAnalyzed: 0, calendarEntriesCreated: 0 };

    // Get all communities that need rule analysis
    const { data: communities } = await this.supabase
      .from('community_profiles')
      .select('*')
      .eq('account_id', this.accountId)
      .or('classification.eq.unknown,last_scanned.is.null');

    for (const community of communities || []) {
      const rules = await this.fetchAndParseRules(community);
      const classification = await this.classifyCommunity(rules);

      await this.supabase
        .from('community_profiles')
        .update({
          rules_json: rules,
          classification,
          self_promo_policy: rules.selfPromoPolicy || null,
          frequency_limits: rules.frequencyLimits || {},
          last_scanned: new Date().toISOString(),
        })
        .eq('id', community.id);

      // Generate calendar entries based on classification
      const calendarEntries = await this.generateCalendarEntries(community, classification, rules);
      for (const entry of calendarEntries) {
        await this.supabase.from('content_calendar').insert({
          account_id: this.accountId,
          scheduled_date: entry.date,
          product: entry.product,
          platform: community.platform,
          community_id: community.id,
          post_type: entry.postType,
          content_preview: entry.preview,
          status: 'scheduled',
          approval_tier: entry.tier,
        });
        results.calendarEntriesCreated++;
      }

      results.communitiesAnalyzed++;
    }

    return results;
  }

  async fetchAndParseRules(community) {
    // TODO: Platform API to fetch rules/guidelines
    // Parse into structured format
    return {
      selfPromoPolicy: null,
      frequencyLimits: {},
      flairRequirements: [],
      linkRestrictions: [],
      participationRatio: null,
      promoSchedules: [],
      raw: community.rules_json,
    };
  }

  async classifyCommunity(rules) {
    // TODO: LLM-based classification of community rules
    // Returns one of this.classifications
    if (rules.selfPromoPolicy === 'allowed') return 'open_to_marketing';
    if (rules.promoSchedules?.length > 0) return 'designated_threads_only';
    return 'unclear';
  }

  async generateCalendarEntries(community, classification, rules) {
    const entries = [];
    const products = community.products_relevant || [];
    const nextWeek = this.getNextWeekDates();

    for (const product of products) {
      switch (classification) {
        case 'open_to_marketing':
          entries.push({
            date: nextWeek[1],
            product,
            postType: 'value_post_with_mention',
            preview: `[${product}] Value post in ${community.name}`,
            tier: 2,
          });
          break;
        case 'designated_threads_only':
          // Find promo thread schedule and add entry
          entries.push({
            date: nextWeek[0],
            product,
            postType: 'promo_thread_entry',
            preview: `[${product}] Promo thread in ${community.name}`,
            tier: 2,
          });
          break;
        case 'no_marketing':
          entries.push({
            date: nextWeek[2],
            product,
            postType: 'value_engagement',
            preview: `[${product}] Value-only engagement in ${community.name}`,
            tier: 1,
          });
          break;
      }
    }

    return entries;
  }

  getNextWeekDates() {
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }
}

module.exports = CommunityStrategistAgent;
