const BaseAgent = require('./base-agent');
const products = require('../config/products');

class UserLifecycleAgent extends BaseAgent {
  static agentId = 'user-lifecycle';
  static agentName = 'User Lifecycle Agent';

  constructor(accountId) {
    super(accountId, {
      agentId: 'user-lifecycle',
      agentName: 'User Lifecycle Agent',
      cycle: 'event-driven',
      defaultTier: 1,
    });

    this.dripSequence = {
      day1: {
        type: 'welcome',
        tier: 1,
        template: 'Welcome to {product}! Here\'s how to get started...',
      },
      day7: {
        type: 'followup',
        tier: 1,
        template: 'We wanted to check in — here\'s a special offer and what others are saying about {product}...',
      },
    };

    this.churnThresholdDays = 14;
    this.winbackMaxTouches = 3;
    this.reviewRequestAfterDays = 30;
    this.referralInviteAfterDays = 60;

    this.behaviorNudges = {
      chronostates: { trigger: 'never_started_scenario', nudge: 'Curated starter scenario' },
      budgeting_beacon: { trigger: 'never_added_bill', nudge: '5-minute setup guide' },
      payroll_beacon: { trigger: 'never_queried_data', nudge: 'Sample compliance query walkthrough' },
    };
  }

  async run() {
    const results = {
      welcomesSent: 0,
      followupsSent: 0,
      nudgesSent: 0,
      churnDetected: 0,
      winbacksSent: 0,
      reviewRequests: 0,
      referralInvites: 0,
    };

    // Process registration drips
    const dripResults = await this.processDripSequences();
    results.welcomesSent = dripResults.welcomes;
    results.followupsSent = dripResults.followups;

    // Behavior-based nudges
    results.nudgesSent = await this.processBehaviorNudges();

    // Churn detection and win-back
    const churnResults = await this.processChurnDetection();
    results.churnDetected = churnResults.detected;
    results.winbacksSent = churnResults.winbacks;

    // Review/testimonial requests
    results.reviewRequests = await this.processReviewRequests();

    // Referral invites
    results.referralInvites = await this.processReferralInvites();

    return results;
  }

  async processDripSequences() {
    const results = { welcomes: 0, followups: 0 };

    // Day 1: Welcome emails for new registrations
    const oneDayAgo = new Date(Date.now() - 86400000);
    const { data: newUsers } = await this.supabase
      .from('user_lifecycle')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('drip_stage', 'registered')
      .lte('registered_at', oneDayAgo.toISOString());

    for (const user of newUsers || []) {
      await this.sendDripEmail(user, 'day1');
      await this.supabase
        .from('user_lifecycle')
        .update({ drip_stage: 'welcome_sent', drip_last_sent: new Date().toISOString() })
        .eq('id', user.id);
      results.welcomes++;
    }

    // Day 7: Follow-up emails
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const { data: welcomedUsers } = await this.supabase
      .from('user_lifecycle')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('drip_stage', 'welcome_sent')
      .lte('registered_at', sevenDaysAgo.toISOString());

    for (const user of welcomedUsers || []) {
      await this.sendDripEmail(user, 'day7');
      await this.supabase
        .from('user_lifecycle')
        .update({ drip_stage: 'followup_sent', drip_last_sent: new Date().toISOString() })
        .eq('id', user.id);
      results.followups++;
    }

    return results;
  }

  async processBehaviorNudges() {
    let nudgesSent = 0;

    for (const [productId, nudge] of Object.entries(this.behaviorNudges)) {
      const { data: candidates } = await this.supabase
        .from('user_lifecycle')
        .select('*')
        .eq('account_id', this.accountId)
        .eq('product', productId)
        .eq('drip_stage', 'followup_sent')
        .eq('churned', false);

      for (const user of candidates || []) {
        const metadata = user.metadata || {};
        if (metadata[nudge.trigger]) continue;

        await this.submitForApproval({
          itemType: 'behavior_nudge',
          tier: 1,
          contentPreview: `[${productId}] Nudge to ${user.email}: ${nudge.nudge}`,
          fullContent: {
            product: productId,
            userId: user.user_id,
            email: user.email,
            nudgeType: nudge.trigger,
            nudgeContent: nudge.nudge,
          },
        });
        nudgesSent++;
      }
    }

    return nudgesSent;
  }

  async processChurnDetection() {
    const results = { detected: 0, winbacks: 0 };
    const churnCutoff = new Date(Date.now() - this.churnThresholdDays * 86400000);

    const { data: inactive } = await this.supabase
      .from('user_lifecycle')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('churned', false)
      .lt('last_active', churnCutoff.toISOString());

    for (const user of inactive || []) {
      if (user.winback_touches >= this.winbackMaxTouches) {
        // Mark as churned, stop outreach
        await this.supabase
          .from('user_lifecycle')
          .update({ churned: true, churn_detected_at: new Date().toISOString() })
          .eq('id', user.id);
        results.detected++;
        continue;
      }

      // Send win-back email
      await this.submitForApproval({
        itemType: 'winback_email',
        tier: 1,
        contentPreview: `[${user.product}] Win-back #${user.winback_touches + 1} to ${user.email}`,
        fullContent: {
          product: user.product,
          userId: user.user_id,
          email: user.email,
          touchNumber: user.winback_touches + 1,
        },
      });

      await this.supabase
        .from('user_lifecycle')
        .update({ winback_touches: user.winback_touches + 1, drip_last_sent: new Date().toISOString() })
        .eq('id', user.id);

      results.winbacks++;
    }

    return results;
  }

  async processReviewRequests() {
    let count = 0;
    const reviewCutoff = new Date(Date.now() - this.reviewRequestAfterDays * 86400000);

    const { data: candidates } = await this.supabase
      .from('user_lifecycle')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('review_requested', false)
      .eq('churned', false)
      .lte('registered_at', reviewCutoff.toISOString());

    for (const user of candidates || []) {
      await this.submitForApproval({
        itemType: 'review_request',
        tier: 2,
        contentPreview: `[${user.product}] Review request to ${user.email}`,
        fullContent: {
          product: user.product,
          userId: user.user_id,
          email: user.email,
        },
      });

      await this.supabase
        .from('user_lifecycle')
        .update({ review_requested: true })
        .eq('id', user.id);

      count++;
    }

    return count;
  }

  async processReferralInvites() {
    let count = 0;
    const referralCutoff = new Date(Date.now() - this.referralInviteAfterDays * 86400000);

    const { data: candidates } = await this.supabase
      .from('user_lifecycle')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('referral_invited', false)
      .eq('churned', false)
      .lte('registered_at', referralCutoff.toISOString());

    for (const user of candidates || []) {
      const referralCode = `REF-${user.product.slice(0, 3).toUpperCase()}-${user.user_id.slice(0, 8)}`;

      await this.submitForApproval({
        itemType: 'referral_invite',
        tier: 1,
        contentPreview: `[${user.product}] Referral invite to ${user.email} (${referralCode})`,
        fullContent: {
          product: user.product,
          userId: user.user_id,
          email: user.email,
          referralCode,
        },
      });

      await this.supabase
        .from('user_lifecycle')
        .update({ referral_invited: true, referral_code: referralCode })
        .eq('id', user.id);

      count++;
    }

    return count;
  }

  async sendDripEmail(user, stage) {
    const drip = this.dripSequence[stage];
    const product = products[user.product];
    const content = drip.template.replace('{product}', product?.name || user.product);

    await this.submitForApproval({
      itemType: `drip_${stage}`,
      tier: drip.tier,
      contentPreview: `[${user.product}] ${drip.type} email to ${user.email}`,
      fullContent: {
        product: user.product,
        userId: user.user_id,
        email: user.email,
        subject: `${drip.type === 'welcome' ? 'Welcome to' : 'Check in from'} ${product?.name || user.product}`,
        body: content,
      },
    });
  }
}

module.exports = UserLifecycleAgent;
