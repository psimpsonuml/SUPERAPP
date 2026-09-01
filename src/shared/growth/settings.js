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
  constructor(accountId) {
    this.accountId = accountId;
    this._cache = new Map();
  }

  /** Read one settings key, merged over its defaults. */
  async get(key) {
    if (this._cache.has(key)) return this._cache.get(key);

    const fallback = DEFAULTS[key] ?? {};
    if (!isSupabaseConfigured()) return { ...fallback };

    try {
      const { data } = await getSupabase()
        .from('growth_settings')
        .select('value')
        .eq('account_id', this.accountId)
        .eq('key', key)
        .maybeSingle();

      const merged = { ...fallback, ...(data?.value || {}) };
      this._cache.set(key, merged);
      return merged;
    } catch (err) {
      logger.warn(`Failed to read growth setting "${key}": ${err.message}`, {
        accountId: this.accountId,
      });
      return { ...fallback };
    }
  }

  async all() {
    const keys = Object.keys(DEFAULTS);
    const entries = await Promise.all(keys.map(async k => [k, await this.get(k)]));
    return Object.fromEntries(entries);
  }

  /**
   * Write a settings key.
   * @param {string} source 'user' | 'automation' | 'system'
   * Automation writes that would raise a guarded limit are refused.
   */
  async set(key, value, { source = 'user' } = {}) {
    if (!isSupabaseConfigured()) throw new Error('Database not configured');
    if (!DEFAULTS[key]) throw new Error(`Unknown settings key: ${key}`);

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

    if (key === 'scoring_weights') {
      const merged = { ...DEFAULT_SCORING_WEIGHTS, ...value };
      const total = Object.values(merged).reduce((s, n) => s + Number(n || 0), 0);
      if (total !== 100) {
        throw new Error(`Scoring weights must total 100 (got ${total})`);
      }
    }

    const current = await this.get(key);
    const next = { ...current, ...value };

    const { data, error } = await getSupabase()
      .from('growth_settings')
      .upsert({
        account_id: this.accountId,
        key,
        value: next,
        updated_by: source,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,key' })
      .select()
      .single();

    if (error) throw new Error(`Failed to save setting "${key}": ${error.message}`);

    this._cache.set(key, next);
    logger.info(`Growth setting "${key}" updated by ${source}`, { accountId: this.accountId });
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
