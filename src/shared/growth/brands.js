// ══════════════════════════════════════════════════════════════════
// Growth Brands
//
// One engine, several brands. A brand is the answer to "who is this
// content for, whose voice is it in, and which ICP scores it" — the
// things Payroll Beacon and the author business do not share.
//
// Two rules this module exists to enforce:
//
//   1. Resolution never guesses. Asking for an unknown brand slug is
//      an error, not a silent fall-through to the default. Writing
//      payroll outreach to a reader list because a slug was typo'd is
//      exactly the failure worth being loud about.
//
//   2. Voice and positioning are never invented. A brand with no
//      positioning configured reports `configured: false`, and callers
//      that generate copy are expected to refuse rather than improvise
//      claims about a business they have no facts for.
// ══════════════════════════════════════════════════════════════════

const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');
const logger = require('../logger');

class UnknownBrandError extends Error {
  constructor(slugOrId) {
    super(`Unknown brand: ${slugOrId}`);
    this.name = 'UnknownBrandError';
    this.code = 'unknown_brand';
    this.status = 404;
  }
}

class BrandsUnavailableError extends Error {
  constructor(detail) {
    super(`Brand table unavailable: ${detail}`);
    this.name = 'BrandsUnavailableError';
    this.code = 'brands_unavailable';
    this.status = 503;
  }
}

const SELECT = 'id, account_id, slug, name, description, product, positioning, '
  + 'voice, channels, website_url, is_default, status, created_at, updated_at';

class BrandService {
  constructor(accountId) {
    this.accountId = accountId;
    this._byId = new Map();
    this._bySlug = new Map();
    this._loadedAll = false;
  }

  /** Every brand on the account, default first. */
  async list({ includeArchived = false } = {}) {
    if (!isSupabaseConfigured()) {
      throw new BrandsUnavailableError('Supabase is not configured');
    }

    let query = getSupabase()
      .from('growth_brands')
      .select(SELECT)
      .eq('account_id', this.accountId)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (!includeArchived) query = query.neq('status', 'archived');

    const { data, error } = await query;
    if (error) throw new BrandsUnavailableError(error.message);

    const brands = (data || []).map(decorate);
    for (const b of brands) {
      this._byId.set(b.id, b);
      this._bySlug.set(b.slug, b);
    }
    if (includeArchived) this._loadedAll = true;
    return brands;
  }

  /**
   * Resolve a brand from an id, a slug, or nothing.
   *
   * Passing null/undefined returns the account's default brand — that
   * is the documented "no brand specified" behaviour. Passing a value
   * that does not resolve throws; it means the caller believed it had
   * a brand and was wrong.
   */
  async resolve(idOrSlug) {
    if (idOrSlug === null || idOrSlug === undefined || idOrSlug === '') {
      return this.getDefault();
    }

    const key = String(idOrSlug);
    if (this._byId.has(key)) return this._byId.get(key);
    if (this._bySlug.has(key)) return this._bySlug.get(key);

    if (!isSupabaseConfigured()) {
      throw new BrandsUnavailableError('Supabase is not configured');
    }

    const column = isUuid(key) ? 'id' : 'slug';
    const { data, error } = await getSupabase()
      .from('growth_brands')
      .select(SELECT)
      .eq('account_id', this.accountId)
      .eq(column, key)
      .maybeSingle();

    if (error) throw new BrandsUnavailableError(error.message);
    if (!data) throw new UnknownBrandError(key);

    const brand = decorate(data);
    this._byId.set(brand.id, brand);
    this._bySlug.set(brand.slug, brand);
    return brand;
  }

  async getDefault() {
    if (!isSupabaseConfigured()) {
      throw new BrandsUnavailableError('Supabase is not configured');
    }

    const { data, error } = await getSupabase()
      .from('growth_brands')
      .select(SELECT)
      .eq('account_id', this.accountId)
      .eq('is_default', true)
      .maybeSingle();

    if (error) throw new BrandsUnavailableError(error.message);
    if (!data) {
      // Migration 004 seeds one. Its absence means the migration did
      // not run, and every brand-scoped write below would land on the
      // wrong rows — better to stop here than to pick one arbitrarily.
      throw new BrandsUnavailableError(
        'No default brand for this account. Run migration 004_multi_brand.sql.'
      );
    }
    return decorate(data);
  }

  async create({ slug, name, description, product, positioning, voice, channels, websiteUrl }) {
    if (!isSupabaseConfigured()) throw new BrandsUnavailableError('Supabase is not configured');
    if (!slug || !/^[a-z0-9_]+$/.test(slug)) {
      throw new Error('Brand slug must be lowercase letters, digits and underscores');
    }
    if (!name) throw new Error('Brand name is required');

    const { data, error } = await getSupabase()
      .from('growth_brands')
      .insert({
        account_id: this.accountId,
        slug,
        name,
        description: description || null,
        product: product || slug,
        positioning: positioning || {},
        voice: voice || {},
        channels: channels || [],
        website_url: websiteUrl || null,
      })
      .select(SELECT)
      .single();

    if (error) throw new Error(`Failed to create brand: ${error.message}`);
    logger.info(`Brand created: ${slug}`, { accountId: this.accountId });
    this._byId.clear(); this._bySlug.clear();
    return decorate(data);
  }

  async update(idOrSlug, patch) {
    const brand = await this.resolve(idOrSlug);
    const allowed = ['name', 'description', 'product', 'positioning', 'voice',
      'channels', 'website_url', 'status'];

    const update = {};
    for (const k of allowed) {
      if (patch[k] !== undefined) update[k] = patch[k];
    }
    if (Object.keys(update).length === 0) return brand;
    update.updated_at = new Date().toISOString();

    const { data, error } = await getSupabase()
      .from('growth_brands')
      .update(update)
      .eq('id', brand.id)
      .eq('account_id', this.accountId)
      .select(SELECT)
      .single();

    if (error) throw new Error(`Failed to update brand: ${error.message}`);
    this._byId.clear(); this._bySlug.clear();
    return decorate(data);
  }

  /**
   * Move the default flag. The partial unique index allows only one
   * default per account, so the old one is cleared first.
   */
  async setDefault(idOrSlug) {
    const brand = await this.resolve(idOrSlug);
    const sb = getSupabase();

    const { error: clearErr } = await sb
      .from('growth_brands')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('account_id', this.accountId)
      .eq('is_default', true);
    if (clearErr) throw new Error(`Failed to clear current default: ${clearErr.message}`);

    const { data, error } = await sb
      .from('growth_brands')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', brand.id)
      .select(SELECT)
      .single();
    if (error) throw new Error(`Failed to set default brand: ${error.message}`);

    this._byId.clear(); this._bySlug.clear();
    return decorate(data);
  }
}

// ── Helpers ───────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) { return UUID_RE.test(v); }

/**
 * Add the derived flags callers need to decide whether they may write
 * copy for this brand, or publish it.
 *
 * `configured` is false when nothing has been said about who the brand
 * is. Generators must treat that as a refusal condition rather than
 * writing generic marketing prose — the alternative is inventing
 * claims about a real business.
 */
function decorate(row) {
  const positioning = row.positioning || {};
  const voice = row.voice || {};
  const channels = Array.isArray(row.channels) ? row.channels : [];

  const missing = [];
  if (!positioning.audience) missing.push('positioning.audience');
  if (!positioning.offer && !positioning.summary) missing.push('positioning.offer');
  if (!voice.tone) missing.push('voice.tone');

  return {
    ...row,
    positioning,
    voice,
    channels,
    configured: missing.length === 0,
    missing_config: missing,
    can_auto_publish: channels.length > 0,
  };
}

module.exports = BrandService;
module.exports.UnknownBrandError = UnknownBrandError;
module.exports.BrandsUnavailableError = BrandsUnavailableError;
