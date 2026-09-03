// ══════════════════════════════════════════════════════════════════
// Growth Settings
//
// Spec §29: hard limits are configurable by the user, but automations
// may not silently raise them. Writes made with source='automation'
// are rejected when they would increase a guarded limit.
// ══════════════════════════════════════════════════════════════════

const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');
const logger = require('../logger');

// ── Defaults ──────────────────────────────────────────────

const DEFAULT_LIMITS = {
  max_daily_cold_emails: 20,
  max_daily_linkedin_suggestions: 10,
  max_weekly_personal_linkedin_posts: 2,
  max_weekly_company_linkedin_posts: 3,
  max_weekly_facebook_posts: 4,
  max_weekly_instagram_posts: 4,
  max_weekly_blog_posts: 1,
  company_contact_cooldown_days: 30,
};

// Limits an automation may never increase on its own.
const GUARDED_LIMITS = new Set(Object.keys(DEFAULT_LIMITS));

// Spec §7 — total 100.
const DEFAULT_SCORING_WEIGHTS = {
  title_fit: 25,
  company_size: 20,
  multi_state: 15,
  distributed_workforce: 10,
  company_growth: 10,
  industry_complexity: 10,
  payroll_hiring: 5,
  linkedin_activity: 5,
};

const DEFAULT_FIT_BANDS = {
  priority: 80,
  good: 60,
  maybe: 40,
};

// Spec §6 — primary ICP. Secondary titles are kept separate on purpose.
const DEFAULT_ICP = {
  name: 'Multi-State Payroll Leaders',
  geography: ['United States'],
  employee_min: 200,
  employee_max: 5000,
  primary_titles: [
    'Payroll Manager', 'Senior Payroll Manager', 'Director of Payroll',
    'Senior Director of Payroll', 'VP Payroll', 'Head of Payroll',
    'Global Payroll Manager', 'Global Payroll Director',
    'Payroll Operations Manager', 'Payroll Operations Director',
  ],
  secondary_titles: [
    'HRIS Director', 'Total Rewards Director', 'VP Human Resources',
    'Controller', 'Finance Director',
  ],
  industries: [
    'Technology', 'Biotech', 'Pharmaceutical', 'Healthcare',
    'Financial Services', 'Professional Services', 'Manufacturing',
    'Retail', 'Hospitality',
  ],
  high_complexity_industries: [
    'Healthcare', 'Hospitality', 'Retail', 'Manufacturing',
  ],
};

// Spec §3 — default editorial cadence.
const DEFAULT_CADENCE = {
  monday: ['facebook', 'instagram', 'linkedin_company'],
  tuesday: ['linkedin_personal'],
  wednesday: ['facebook', 'instagram', 'linkedin_company'],
  thursday: [],
  friday: ['facebook', 'instagram', 'linkedin_company'],
  saturday: [],
  sunday: [],
};

// Spec §1 — avoided recurring cost.
const DEFAULT_SAVINGS = {
  content_creator_monthly: 285,
};

const DEFAULTS = {
  limits: DEFAULT_LIMITS,
  scoring_weights: DEFAULT_SCORING_WEIGHTS,
  fit_bands: DEFAULT_FIT_BANDS,
  icp: DEFAULT_ICP,
  cadence: DEFAULT_CADENCE,
  savings: DEFAULT_SAVINGS,
};

class GrowthSettingsService {
  /**
   * @param {string} accountId
   * @param {string|null} brandId  When given, brand rows override the
   *   account-wide rows for this account. Omitting it reads and writes
   *   only the account-wide layer — the behaviour before multi-brand.
   */
  constructor(accountId, brandId = null) {
    this.accountId = accountId;
    this.brandId = brandId || null;
    this._cache = new Map();
  }

  /** A settings service for the same account, scoped to one brand. */
  forBrand(brandId) {
    return new GrowthSettingsService(this.accountId, brandId);
  }

  /**
   * Read one settings key.
   *
   * Three layers, each overriding the last:
   *   module defaults -> account-wide row -> this brand's row
   *
   * A brand only has to state what differs from the account. That is
   * the point of the layering: the author brand shares the sending
   * limits but shares none of the ICP, and expressing that as a full
   * copy of every key would let the two drift silently.
   */
  async get(key) {
    if (this._cache.has(key)) return this._cache.get(key);

    const fallback = DEFAULTS[key] ?? {};
    if (!isSupabaseConfigured()) return { ...fallback };

    try {
      const sb = getSupabase();

      const accountRow = await sb
        .from('growth_settings')
        .select('value')
        .eq('account_id', this.accountId)
        .eq('key', key)
        .is('brand_id', null)
        .maybeSingle();

      let brandValue = {};
      if (this.brandId) {
        const brandRow = await sb
          .from('growth_settings')
          .select('value')
          .eq('account_id', this.accountId)
          .eq('key', key)
          .eq('brand_id', this.brandId)
          .maybeSingle();
        // An empty object is a placeholder seeded by migration 004 for
        // a key the owner has not configured yet. Spreading it is a
        // no-op, so the brand correctly inherits the layer below.
        brandValue = brandRow.data?.value || {};
      }

      const merged = { ...fallback, ...(accountRow.data?.value || {}), ...brandValue };
      this._cache.set(key, merged);
      return merged;
    } catch (err) {
      logger.warn(`Failed to read growth setting "${key}": ${err.message}`, {
        accountId: this.accountId, brandId: this.brandId,
      });
      return { ...fallback };
    }
  }

  /**
   * Which layer actually supplied each key, for the settings UI.
   * Without this the owner cannot tell an inherited value from one
   * they set deliberately, which is how a brand ends up running on
   * another brand's ICP without anyone noticing.
   */
  async provenance(key) {
    const fallback = DEFAULTS[key] ?? {};
    if (!isSupabaseConfigured()) {
      return Object.fromEntries(Object.keys(fallback).map(k => [k, 'default']));
    }

    const sb = getSupabase();
    const accountRow = await sb.from('growth_settings').select('value')
      .eq('account_id', this.accountId).eq('key', key).is('brand_id', null).maybeSingle();

    let brandValue = {};
    if (this.brandId) {
      const r = await sb.from('growth_settings').select('value')
        .eq('account_id', this.accountId).eq('key', key)
        .eq('brand_id', this.brandId).maybeSingle();
      brandValue = r.data?.value || {};
    }
    const accountValue = accountRow.data?.value || {};

    const keys = new Set([
      ...Object.keys(fallback), ...Object.keys(accountValue), ...Object.keys(brandValue),
    ]);
    const out = {};
    for (const k of keys) {
      if (k in brandValue) out[k] = 'brand';
      else if (k in accountValue) out[k] = 'account';
      else out[k] = 'default';
    }
    return out;
  }

  async all() {
    const keys = Object.keys(DEFAULTS);
    const entries = await Promise.all(keys.map(async k => [k, await this.get(k)]));
    return Object.fromEntries(entries);
  }

  /**
   * Write a settings key.
   *
   * @param {string} source 'user' | 'automation' | 'system'
   *   Automation writes that would raise a guarded limit are refused.
   * @param {string} scope 'brand' | 'account'
   *   Defaults to 'brand' when this service is brand-scoped. A brand
   *   write stores only the keys given, so the rest keeps inheriting;
   *   storing the merged effective value instead would freeze a copy
   *   of the account config into the brand and the two would drift.
   */
  async set(key, value, options) {
    const { source = 'user', scope } = options || {};
    if (!isSupabaseConfigured()) throw new Error('Database not configured');
    if (!DEFAULTS[key]) throw new Error(`Unknown settings key: ${key}`);

    const target = scope || (this.brandId ? 'brand' : 'account');
    if (target !== 'brand' && target !== 'account') {
      throw new Error(`Unknown settings scope: ${target}`);
    }
    if (target === 'brand' && !this.brandId) {
      throw new Error('Cannot write a brand-scoped setting without a brand');
    }
    const brandId = target === 'brand' ? this.brandId : null;

    // Guard against the effective value, not the stored layer — an
    // automation lowering a brand override while the account limit is
    // higher is still a lowering, and raising it is still a raise.
    if (key === 'limits' && source === 'automation') {
      const current = await this.get('limits');
      const raised = Object.entries(value)
        .filter(([k, v]) => GUARDED_LIMITS.has(k) && Number(v) > Number(current[k]))
        .map(([k, v]) => `${k}: ${current[k]} -> ${v}`);

      if (raised.length > 0) {
        throw new Error(
          `Automation may not raise guarded limits (${raised.join('; ')}). `
          + 'Change these deliberately as a user.'
        );
      }
    }

    const sb = getSupabase();

    // Read the row for this exact layer, so the merge stays within it.
    let existing = sb.from('growth_settings')
      .select('id, value')
      .eq('account_id', this.accountId)
      .eq('key', key);
    existing = brandId ? existing.eq('brand_id', brandId) : existing.is('brand_id', null);

    const { data: row, error: readErr } = await existing.maybeSingle();
    if (readErr) throw new Error(`Failed to read setting "${key}": ${readErr.message}`);

    const next = { ...(row?.value || {}), ...value };

    // Weights must total 100 *as they will be applied*, which for a
    // brand means after inheritance — a partial brand override of two
    // weights is otherwise rejected for not summing to 100 on its own.
    if (key === 'scoring_weights') {
      const effective = { ...(await this.get(key)), ...next };
      const total = Object.values(effective).reduce((s, n) => s + Number(n || 0), 0);
      if (total !== 100) {
        throw new Error(`Scoring weights must total 100 (got ${total})`);
      }
    }

    const payload = {
      account_id: this.accountId,
      brand_id: brandId,
      key,
      value: next,
      updated_by: source,
      updated_at: new Date().toISOString(),
    };

    // Explicit insert-or-update rather than upsert: after migration 004
    // uniqueness lives in two *partial* indexes, and PostgREST's
    // onConflict cannot name a partial index's predicate.
    const { data, error } = row
      ? await sb.from('growth_settings').update(payload).eq('id', row.id).select().single()
      : await sb.from('growth_settings').insert(payload).select().single();

    if (error) throw new Error(`Failed to save setting "${key}": ${error.message}`);

    this._cache.delete(key);
    logger.info(`Growth setting "${key}" updated by ${source} (${target} scope)`, {
      accountId: this.accountId, brandId,
    });
    return data;
  }

  /** Remaining headroom against a limit, given usage so far. */
  async remaining(limitKey, usedCount) {
    const limits = await this.get('limits');
    const cap = limits[limitKey];
    if (cap === undefined) throw new Error(`Unknown limit: ${limitKey}`);
    return Math.max(cap - usedCount, 0);
  }

  clearCache() {
    this._cache.clear();
  }
}

module.exports = GrowthSettingsService;
module.exports.DEFAULTS = DEFAULTS;
module.exports.DEFAULT_LIMITS = DEFAULT_LIMITS;
module.exports.DEFAULT_SCORING_WEIGHTS = DEFAULT_SCORING_WEIGHTS;
module.exports.DEFAULT_FIT_BANDS = DEFAULT_FIT_BANDS;
module.exports.DEFAULT_ICP = DEFAULT_ICP;
module.exports.GUARDED_LIMITS = GUARDED_LIMITS;
