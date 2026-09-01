// ══════════════════════════════════════════════════════════════════
// Growth Content Service
//
// Content sources and their generated derivatives. Reuses
// ContentMemoryService for deduplication rather than reimplementing
// similarity checks (spec §31).
//
// Every state change writes a growth_content_events row (spec §25) —
// status alone is not the record.
// ══════════════════════════════════════════════════════════════════

const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');
const ContentMemoryService = require('../content-memory');
const logger = require('../logger');

// Platforms that can never auto-publish (spec §12).
const MANUAL_ONLY_PLATFORMS = new Set(['linkedin_personal']);

const TERMINAL_STATUSES = new Set(['published', 'rejected', 'archived']);

class GrowthContentService {
  constructor(accountId) {
    this.accountId = accountId;
    this.contentMemory = new ContentMemoryService(accountId);
  }

  get db() {
    if (!isSupabaseConfigured()) throw new Error('Database not configured');
    return getSupabase();
  }

  // ── Sources ─────────────────────────────────────────────

  async createSource(source) {
    const record = {
      account_id: this.accountId,
      title: source.title,
      source_type: source.sourceType || 'manual_topic',
      source_url: source.sourceUrl || null,
      raw_text: source.rawText || null,
      summary: source.summary || null,
      topic: source.topic || null,
      category: source.category || null,
      target_audience: source.targetAudience || null,
      states: source.states || [],
      jurisdictions: source.jurisdictions || [],
      effective_date: source.effectiveDate || null,
      last_verified_at: source.lastVerifiedAt || null,
      // Spec §32: a compliance claim without provenance is not publishable.
      source_confidence: source.sourceConfidence || 'unverified',
      origin_agent: source.originAgent || null,
      status: source.status || 'new',
      metadata: source.metadata || {},
    };

    if (!record.title) throw new Error('Source title is required');

    const { data, error } = await this.db
      .from('content_sources')
      .insert(record)
      .select()
      .single();

    if (error) throw new Error(`Failed to create content source: ${error.message}`);
    return data;
  }

  async getSource(id) {
    const { data } = await this.db
      .from('content_sources')
      .select('*')
      .eq('id', id)
      .eq('account_id', this.accountId)
      .maybeSingle();
    return data;
  }

  async listSources({ status, sourceType, limit = 50, offset = 0 } = {}) {
    let q = this.db
      .from('content_sources')
      .select('*')
      .eq('account_id', this.accountId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) q = q.eq('status', status);
    if (sourceType) q = q.eq('source_type', sourceType);

    const { data } = await q;
    return data || [];
  }

  async updateSource(id, patch) {
    const { data, error } = await this.db
      .from('content_sources')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('account_id', this.accountId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update source: ${error.message}`);
    return data;
  }

  /**
   * Sources safe to generate from. A source whose compliance confidence
   * is 'needs_research' is deliberately excluded (spec §32).
   */
  async listPublishableSources({ limit = 20 } = {}) {
    const { data } = await this.db
      .from('content_sources')
      .select('*')
      .eq('account_id', this.accountId)
      .in('status', ['ready', 'new'])
      .neq('source_confidence', 'needs_research')
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  }

  // ── Content ─────────────────────────────────────────────

  async createContent(content) {
    if (!content.platform) throw new Error('platform is required');

    const requiresManual = MANUAL_ONLY_PLATFORMS.has(content.platform)
      || content.requiresManualPosting === true;

    const record = {
      account_id: this.accountId,
      source_id: content.sourceId || null,
      campaign_id: content.campaignId || null,
      platform: content.platform,
      content_type: content.contentType || 'post',
      title: content.title || null,
      body: content.body || null,
      metadata: content.metadata || {},
      asset_ids: content.assetIds || [],
      status: content.status || 'generated',
      requires_manual_posting: requiresManual,
      scheduled_for: content.scheduledFor || null,
      model: content.model || null,
      prompt_version: content.promptVersion || null,
    };

    const { data, error } = await this.db
      .from('growth_content')
      .insert(record)
      .select()
      .single();

    if (error) throw new Error(`Failed to create content: ${error.message}`);

    await this.logEvent(data.id, 'generated', {
      platform: data.platform,
      model: data.model,
      sourceId: data.source_id,
    });

    return data;
  }

  /**
   * Store into content_memory for dedup, then link it back.
   * Returns { contentMemoryId, duplicate } — a duplicate is reported,
   * not silently swallowed.
   */
  async linkToMemory(contentId, { product = 'payroll_beacon', platform, title, body, contentType }) {
    const duplicateCheck = await this.contentMemory.checkDuplicate(body || title || '', product);

    if (duplicateCheck.isDuplicate) {
      logger.info(`Content ${contentId} matches existing content (${duplicateCheck.matchType})`, {
        accountId: this.accountId,
        matchId: duplicateCheck.matchId,
      });
      return { contentMemoryId: null, duplicate: duplicateCheck };
    }

    const memoryId = await this.contentMemory.store({
      product,
      platform,
      contentType: contentType || 'growth_content',
      title,
      contentText: body,
      status: 'draft',
      metadata: { growthContentId: contentId },
    });

    await this.db
      .from('growth_content')
      .update({ content_memory_id: memoryId, updated_at: new Date().toISOString() })
      .eq('id', contentId)
      .eq('account_id', this.accountId);

    return { contentMemoryId: memoryId, duplicate: null };
  }

  async getContent(id) {
    const { data } = await this.db
      .from('growth_content')
      .select('*')
      .eq('id', id)
      .eq('account_id', this.accountId)
      .maybeSingle();
    return data;
  }

  async listContent({ status, platform, sourceId, campaignId, from, to, limit = 50, offset = 0 } = {}) {
    let q = this.db
      .from('growth_content')
      .select('*')
      .eq('account_id', this.accountId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) q = Array.isArray(status) ? q.in('status', status) : q.eq('status', status);
    if (platform) q = q.eq('platform', platform);
    if (sourceId) q = q.eq('source_id', sourceId);
    if (campaignId) q = q.eq('campaign_id', campaignId);
    if (from) q = q.gte('scheduled_for', from);
    if (to) q = q.lte('scheduled_for', to);

    const { data } = await q;
    return data || [];
  }

  /** Everything awaiting human review. */
  async listAwaitingApproval({ limit = 100 } = {}) {
    const { data } = await this.db
      .from('growth_content')
      .select('*')
      .eq('account_id', this.accountId)
      .in('status', ['generated', 'needs_review'])
      .order('created_at', { ascending: true })
      .limit(limit);
    return data || [];
  }

  async updateContent(id, patch, options) {
    const { event, eventMetadata } = options || {};
    const { data, error } = await this.db
      .from('growth_content')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('account_id', this.accountId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update content: ${error.message}`);
    if (event) await this.logEvent(id, event, eventMetadata || {});
    return data;
  }

  async approve(id, options) {
    const { scheduledFor } = options || {};
    const existing = await this.getContent(id);
    if (!existing) throw new Error('Content not found');
    if (TERMINAL_STATUSES.has(existing.status)) {
      throw new Error(`Cannot approve content in status "${existing.status}"`);
    }

    const patch = { status: scheduledFor ? 'scheduled' : 'approved' };
    if (scheduledFor) patch.scheduled_for = scheduledFor;

    const updated = await this.updateContent(id, patch, {
      event: 'approved',
      eventMetadata: { scheduledFor: scheduledFor || null },
    });

    if (scheduledFor) await this.logEvent(id, 'scheduled', { scheduledFor });
    return updated;
  }

  async reject(id, reason) {
    return this.updateContent(id, { status: 'rejected', failure_reason: reason || null }, {
      event: 'rejected',
      eventMetadata: { reason: reason || null },
    });
  }

  async markPublished(id, publishedUrl) {
    const updated = await this.updateContent(id, {
      status: 'published',
      published_at: new Date().toISOString(),
      published_url: publishedUrl || null,
    }, { event: 'published', eventMetadata: { publishedUrl: publishedUrl || null } });

    if (updated.content_memory_id) {
      await this.contentMemory.markPublished(updated.content_memory_id);
    }
    return updated;
  }

  /** A failure must be recorded as a failure — never quietly retried away. */
  async markFailed(id, reason) {
    return this.updateContent(id, { status: 'failed', failure_reason: reason }, {
      event: 'failed',
      eventMetadata: { reason },
    });
  }

  // ── Events ──────────────────────────────────────────────

  async logEvent(contentId, eventType, metadata = {}) {
    try {
      await this.db.from('growth_content_events').insert({
        account_id: this.accountId,
        content_id: contentId,
        event_type: eventType,
        metadata,
      });
    } catch (err) {
      logger.warn(`Failed to log content event ${eventType}: ${err.message}`, {
        accountId: this.accountId, contentId,
      });
    }
  }

  async getEvents(contentId, { limit = 100 } = {}) {
    const { data } = await this.db
      .from('growth_content_events')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('content_id', contentId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  }

  // ── Cadence guard ───────────────────────────────────────

  /**
   * How many posts already exist for a platform this week.
   * Used to enforce the §29 weekly caps before generating more.
   */
  async countThisWeek(platform) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const { data } = await this.db
      .from('growth_content')
      .select('id')
      .eq('account_id', this.accountId)
      .eq('platform', platform)
      .in('status', ['approved', 'scheduled', 'published'])
      .gte('created_at', weekStart.toISOString());

    return (data || []).length;
  }
}

module.exports = GrowthContentService;
module.exports.MANUAL_ONLY_PLATFORMS = MANUAL_ONLY_PLATFORMS;
