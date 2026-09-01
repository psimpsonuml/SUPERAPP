// ══════════════════════════════════════════════════════════════════
// Growth Prospects Service
//
// Deduplication (spec §30), Payroll Beacon fit scoring (spec §7),
// event logging (spec §24), and the company-contact cooldown.
//
// Every write path checks suppression before a prospect can become
// contactable (spec §13).
// ══════════════════════════════════════════════════════════════════

const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');
const GrowthSettingsService = require('./settings');
const SuppressionService = require('../suppression');
const logger = require('../logger');

const SENIOR_TITLE_PATTERNS = [
  /\bvp\b/i, /vice president/i, /\bhead of\b/i, /\bdirector\b/i,
  /\bchief\b/i, /\bsenior manager\b/i, /\bmanager\b/i,
];

const PAYROLL_TITLE_PATTERNS = [/payroll/i, /people operations/i, /\bhris\b/i];

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase() || null;
}

function normalizeDomain(input) {
  if (!input) return null;
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0] || null;
}

class GrowthProspectsService {
  constructor(accountId) {
    this.accountId = accountId;
    this.settings = new GrowthSettingsService(accountId);
    this.suppression = new SuppressionService(accountId);
  }

  get db() {
    if (!isSupabaseConfigured()) throw new Error('Database not configured');
    return getSupabase();
  }

  // ── Deduplication (spec §30) ────────────────────────────
  // Order matters: external id is the strongest signal, then email,
  // then LinkedIn URL, then name+company as the weakest fallback.

  async findExisting(input) {
    const email = normalizeEmail(input.email);
    const linkedin = input.linkedinUrl || input.linkedin_url || null;
    const sourceId = input.sourceId || input.source_id || null;
    const source = input.source || 'apollo';

    if (sourceId) {
      const { data } = await this.db
        .from('growth_prospects').select('*')
        .eq('account_id', this.accountId).eq('source', source).eq('source_id', sourceId)
        .maybeSingle();
      if (data) return { prospect: data, matchedOn: 'source_id' };
    }

    if (email) {
      const { data } = await this.db
        .from('growth_prospects').select('*')
        .eq('account_id', this.accountId).eq('email', email)
        .maybeSingle();
      if (data) return { prospect: data, matchedOn: 'email' };
    }

    if (linkedin) {
      const { data } = await this.db
        .from('growth_prospects').select('*')
        .eq('account_id', this.accountId).eq('linkedin_url', linkedin)
        .maybeSingle();
      if (data) return { prospect: data, matchedOn: 'linkedin_url' };
    }

    const fullName = (input.fullName || input.full_name || '').trim();
    const company = (input.companyName || input.company_name || '').trim();
    if (fullName && company) {
      const { data } = await this.db
        .from('growth_prospects').select('*')
        .eq('account_id', this.accountId)
        .ilike('full_name', fullName)
        .ilike('company_name', company)
        .maybeSingle();
      if (data) return { prospect: data, matchedOn: 'name_company' };
    }

    return { prospect: null, matchedOn: null };
  }

  /**
   * Insert or update. Returns { prospect, created, matchedOn }.
   * Enrichment never overwrites a non-null field with null.
   */
  async upsert(input) {
    const fullName = (input.fullName || input.full_name
      || [input.firstName || input.first_name, input.lastName || input.last_name]
        .filter(Boolean).join(' ')).trim();

    if (!fullName) throw new Error('full_name is required');

    const { prospect: existing, matchedOn } = await this.findExisting({ ...input, fullName });

    const fields = {
      first_name: input.firstName ?? input.first_name ?? null,
      last_name: input.lastName ?? input.last_name ?? null,
      full_name: fullName,
      title: input.title ?? null,
      seniority: input.seniority ?? null,
      email: normalizeEmail(input.email),
      email_status: input.emailStatus ?? input.email_status ?? (input.email ? 'guessed' : 'unknown'),
      linkedin_url: input.linkedinUrl ?? input.linkedin_url ?? null,
      sales_nav_url: input.salesNavUrl ?? input.sales_nav_url ?? null,
      company_name: input.companyName ?? input.company_name ?? null,
      company_domain: normalizeDomain(input.companyDomain ?? input.company_domain),
      company_size: input.companySize ?? input.company_size ?? null,
      industry: input.industry ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country ?? 'United States',
      source: input.source ?? 'apollo',
      source_id: input.sourceId ?? input.source_id ?? null,
      campaign_id: input.campaignId ?? input.campaign_id ?? null,
      metadata: input.metadata ?? {},
    };

    if (existing) {
      // Enrich: fill gaps, never blank out known values
      const patch = { updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(fields)) {
        if (v !== null && v !== undefined && v !== '' && !existing[k]) patch[k] = v;
      }
      if (fields.metadata && Object.keys(fields.metadata).length > 0) {
        patch.metadata = { ...(existing.metadata || {}), ...fields.metadata };
      }

      const { data, error } = await this.db
        .from('growth_prospects')
        .update(patch)
        .eq('id', existing.id).eq('account_id', this.accountId)
        .select().single();

      if (error) throw new Error(`Failed to enrich prospect: ${error.message}`);
      await this.logEvent(data.id, 'enriched', { matchedOn, fieldsFilled: Object.keys(patch) });
      return { prospect: data, created: false, matchedOn };
    }

    const { data, error } = await this.db
      .from('growth_prospects')
      .insert({ account_id: this.accountId, ...fields })
      .select().single();

    if (error) throw new Error(`Failed to create prospect: ${error.message}`);
    await this.logEvent(data.id, 'imported', { source: fields.source, sourceId: fields.source_id });
    return { prospect: data, created: true, matchedOn: null };
  }

  async bulkUpsert(inputs) {
    const results = { created: 0, enriched: 0, failed: 0, prospects: [], errors: [] };
    for (const input of inputs || []) {
      try {
        const { prospect, created } = await this.upsert(input);
        results.prospects.push(prospect);
        if (created) results.created++; else results.enriched++;
      } catch (err) {
        results.failed++;
        results.errors.push({ input: input.email || input.full_name || 'unknown', error: err.message });
      }
    }
    return results;
  }

  // ── Fit scoring (spec §7) ───────────────────────────────

  async score(prospect) {
    const weights = await this.settings.get('scoring_weights');
    const bands = await this.settings.get('fit_bands');
    const icp = await this.settings.get('icp');

    const breakdown = {};
    const meta = prospect.metadata || {};
    const title = prospect.title || '';

    // Title fit — must be payroll-specific AND senior
    const isPayrollTitle = PAYROLL_TITLE_PATTERNS.some(p => p.test(title));
    const isSenior = SENIOR_TITLE_PATTERNS.some(p => p.test(title));
    const titleListed = (icp.primary_titles || []).some(
      t => title.toLowerCase().includes(t.toLowerCase())
    );
    breakdown.title_fit = (titleListed || (isPayrollTitle && isSenior)) ? weights.title_fit : 0;

    // Company size — the sweet spot band
    const size = prospect.company_size || 0;
    breakdown.company_size = (size >= 500 && size <= 5000) ? weights.company_size
      : (size >= icp.employee_min && size <= icp.employee_max) ? Math.round(weights.company_size / 2)
      : 0;

    // Multi-state complexity
    const stateCount = meta.state_count || (meta.states?.length ?? 0);
    breakdown.multi_state = (meta.multi_state === true || stateCount > 1) ? weights.multi_state : 0;

    // Distributed workforce
    breakdown.distributed_workforce = (meta.remote_friendly === true || meta.distributed === true)
      ? weights.distributed_workforce : 0;

    // Headcount growth
    breakdown.company_growth = (meta.headcount_growth_pct || 0) >= 20 ? weights.company_growth : 0;

    // Industry complexity
    breakdown.industry_complexity =
      (icp.high_complexity_industries || []).includes(prospect.industry)
        ? weights.industry_complexity : 0;

    // Currently hiring payroll/HR
    breakdown.payroll_hiring = meta.hiring_payroll === true ? weights.payroll_hiring : 0;

    // LinkedIn activity
    breakdown.linkedin_activity = meta.linkedin_active === true ? weights.linkedin_activity : 0;

    const total = Object.values(breakdown).reduce((s, n) => s + n, 0);
    const capped = Math.max(0, Math.min(100, total));

    const band = capped >= bands.priority ? 'priority'
      : capped >= bands.good ? 'good'
      : capped >= bands.maybe ? 'maybe'
      : 'ignore';

    return {
      payroll_fit_score: capped,
      fit_band: band,
      score_breakdown: breakdown,
      multi_state_score: breakdown.multi_state,
      remote_score: breakdown.distributed_workforce,
      growth_score: breakdown.company_growth,
      complexity_score: breakdown.industry_complexity,
      fit_reason: this.buildFitReason(breakdown, prospect),
    };
  }

  buildFitReason(breakdown, prospect) {
    const reasons = [];
    if (breakdown.title_fit) reasons.push(`${prospect.title} owns payroll`);
    if (breakdown.company_size) reasons.push(`${prospect.company_size} employees`);
    if (breakdown.multi_state) reasons.push('operates across multiple states');
    if (breakdown.distributed_workforce) reasons.push('distributed workforce');
    if (breakdown.company_growth) reasons.push('growing headcount');
    if (breakdown.industry_complexity) reasons.push(`${prospect.industry} complexity`);
    if (breakdown.payroll_hiring) reasons.push('hiring payroll/HR');
    return reasons.length > 0 ? reasons.join('; ') : 'No strong fit signals';
  }

  async scoreAndSave(prospectId) {
    const prospect = await this.get(prospectId);
    if (!prospect) throw new Error('Prospect not found');

    const scored = await this.score(prospect);
    const { data, error } = await this.db
      .from('growth_prospects')
      .update({ ...scored, updated_at: new Date().toISOString() })
      .eq('id', prospectId).eq('account_id', this.accountId)
      .select().single();

    if (error) throw new Error(`Failed to save score: ${error.message}`);
    await this.logEvent(prospectId, 'scored', {
      score: scored.payroll_fit_score, band: scored.fit_band,
    });
    return data;
  }

  // ── Reads ───────────────────────────────────────────────

  async get(id) {
    const { data } = await this.db
      .from('growth_prospects').select('*')
      .eq('id', id).eq('account_id', this.accountId).maybeSingle();
    return data;
  }

  async list({ status, band, minScore, campaignId, limit = 50, offset = 0 } = {}) {
    let q = this.db
      .from('growth_prospects').select('*')
      .eq('account_id', this.accountId)
      .order('payroll_fit_score', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) q = Array.isArray(status) ? q.in('status', status) : q.eq('status', status);
    if (band) q = Array.isArray(band) ? q.in('fit_band', band) : q.eq('fit_band', band);
    if (minScore) q = q.gte('payroll_fit_score', minScore);
    if (campaignId) q = q.eq('campaign_id', campaignId);

    const { data } = await q;
    return data || [];
  }

  /** Priority prospects that are contactable and not yet contacted. */
  async listPriorityQueue({ limit = 25 } = {}) {
    const candidates = await this.list({
      band: 'priority',
      status: ['new', 'researching', 'ready'],
      limit: limit * 3,
    });

    const { allowed } = await this.suppression.filterContactable(candidates);

    const contactable = [];
    for (const prospect of allowed) {
      if (await this.isCompanyOnCooldown(prospect)) continue;
      contactable.push(prospect);
      if (contactable.length >= limit) break;
    }
    return contactable;
  }

  async listFollowupsDue({ limit = 50 } = {}) {
    const { data } = await this.db
      .from('growth_prospects').select('*')
      .eq('account_id', this.accountId)
      .not('next_followup_at', 'is', null)
      .lte('next_followup_at', new Date().toISOString())
      .not('status', 'in', '("converted","disqualified","do_not_contact","negative")')
      .order('next_followup_at', { ascending: true })
      .limit(limit);
    return data || [];
  }

  // ── Company cooldown (spec §30) ─────────────────────────

  /**
   * True when someone else at this company was contacted inside the
   * cooldown window. Prevents blanketing one account with outreach.
   */
  async isCompanyOnCooldown(prospect) {
    const domain = prospect.company_domain;
    if (!domain) return false;

    const limits = await this.settings.get('limits');
    const days = limits.company_contact_cooldown_days ?? 30;
    if (days <= 0) return false;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { data } = await this.db
      .from('growth_prospects')
      .select('id, last_contacted_at')
      .eq('account_id', this.accountId)
      .eq('company_domain', domain)
      .neq('id', prospect.id)
      .not('last_contacted_at', 'is', null)
      .gte('last_contacted_at', cutoff.toISOString())
      .limit(1);

    return (data || []).length > 0;
  }

  // ── Status transitions ──────────────────────────────────

  async setStatus(id, status, options) {
    const { event, metadata = {} } = options || {};
    const patch = { status, updated_at: new Date().toISOString() };

    if (status === 'contacted') {
      patch.last_contacted_at = new Date().toISOString();
    }
    if (status === 'do_not_contact') {
      const prospect = await this.get(id);
      if (prospect?.email) {
        await this.suppression.add({
          email: prospect.email, prospectId: id,
          reason: 'requested_no_contact', source: 'status_change',
        });
      }
    }

    const { data, error } = await this.db
      .from('growth_prospects').update(patch)
      .eq('id', id).eq('account_id', this.accountId)
      .select().single();

    if (error) throw new Error(`Failed to set status: ${error.message}`);
    if (event) await this.logEvent(id, event, metadata);
    return data;
  }

  async scheduleFollowup(id, daysFromNow) {
    const when = new Date();
    when.setDate(when.getDate() + daysFromNow);
    const { data, error } = await this.db
      .from('growth_prospects')
      .update({ next_followup_at: when.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id).eq('account_id', this.accountId)
      .select().single();
    if (error) throw new Error(`Failed to schedule followup: ${error.message}`);
    return data;
  }

  async recordContact(id) {
    const prospect = await this.get(id);
    if (!prospect) throw new Error('Prospect not found');

    const { data, error } = await this.db
      .from('growth_prospects')
      .update({
        status: 'contacted',
        last_contacted_at: new Date().toISOString(),
        touch_count: (prospect.touch_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id).eq('account_id', this.accountId)
      .select().single();

    if (error) throw new Error(`Failed to record contact: ${error.message}`);
    await this.logEvent(id, 'email_sent', { touchCount: data.touch_count });
    return data;
  }

  // ── Events (spec §24) ───────────────────────────────────

  async logEvent(prospectId, eventType, metadata = {}) {
    try {
      await this.db.from('growth_prospect_events').insert({
        account_id: this.accountId,
        prospect_id: prospectId,
        event_type: eventType,
        metadata,
      });
    } catch (err) {
      logger.warn(`Failed to log prospect event ${eventType}: ${err.message}`, {
        accountId: this.accountId, prospectId,
      });
    }
  }

  async getEvents(prospectId, { limit = 100 } = {}) {
    const { data } = await this.db
      .from('growth_prospect_events').select('*')
      .eq('account_id', this.accountId).eq('prospect_id', prospectId)
      .order('created_at', { ascending: false }).limit(limit);
    return data || [];
  }

  // ── Funnel counts ───────────────────────────────────────

  async funnelCounts() {
    const { data } = await this.db
      .from('growth_prospects').select('status, fit_band')
      .eq('account_id', this.accountId);

    const byStatus = {};
    const byBand = {};
    for (const row of data || []) {
      byStatus[row.status] = (byStatus[row.status] || 0) + 1;
      byBand[row.fit_band] = (byBand[row.fit_band] || 0) + 1;
    }
    return { total: (data || []).length, byStatus, byBand };
  }
}

module.exports = GrowthProspectsService;
module.exports.normalizeDomain = normalizeDomain;
module.exports.normalizeEmail = normalizeEmail;
