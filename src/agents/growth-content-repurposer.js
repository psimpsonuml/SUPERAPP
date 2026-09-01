const BaseAgent = require('./base-agent');
const GrowthContentService = require('../shared/growth/content');
const GrowthSettingsService = require('../shared/growth/settings');
const GrowthCostService = require('../shared/growth/cost');
const ContentGenerator = require('../shared/growth/generator');

// ══════════════════════════════════════════════════════════════════
// Worker 2 — Content Repurposer (spec §20)
//
// One source item in, a platform-specific package out.
//
// Refuses to generate past the §29 weekly caps, and never invents a
// source just to fill a slot: with no ready sources it returns having
// done nothing rather than manufacturing filler (spec §3).
// ══════════════════════════════════════════════════════════════════

// Which platforms a package covers by default, and their weekly cap key.
const PACKAGE_PLATFORMS = [
  { platform: 'blog', limitKey: 'max_weekly_blog_posts' },
  { platform: 'facebook', limitKey: 'max_weekly_facebook_posts' },
  { platform: 'instagram', limitKey: 'max_weekly_instagram_posts' },
  { platform: 'linkedin_company', limitKey: 'max_weekly_company_linkedin_posts' },
  { platform: 'linkedin_personal', limitKey: 'max_weekly_personal_linkedin_posts' },
];

class GrowthContentRepurposerAgent extends BaseAgent {
  static agentId = 'growth-content-repurposer';
  static agentName = 'Growth Content Repurposer';

  constructor(accountId) {
    super(accountId, {
      agentId: 'growth-content-repurposer',
      agentName: 'Growth Content Repurposer',
      cycle: 'weekly',
      defaultTier: 2,
    });

    this.content = new GrowthContentService(accountId);
    this.settings = new GrowthSettingsService(accountId);
    this.cost = new GrowthCostService(accountId);
    this.generator = new ContentGenerator(accountId, { costService: this.cost });
  }

  async run(options = {}) {
    const results = {
      sourcesProcessed: 0,
      contentGenerated: 0,
      skippedAtCap: [],
      failures: [],
      byPlatform: {},
    };

    const sources = options.sourceId
      ? [await this.content.getSource(options.sourceId)].filter(Boolean)
      : await this.content.listPublishableSources({ limit: options.maxSources || 2 });

    if (sources.length === 0) {
      this.logger.info('No publishable sources — generating nothing', { agentId: this.agentId });
      return results;
    }

    // Which platforms still have headroom this week
    const platforms = await this.platformsWithHeadroom(results);
    if (platforms.length === 0) {
      this.logger.info('All platforms at their weekly cap', { agentId: this.agentId });
      return results;
    }

    for (const source of sources) {
      try {
        const produced = await this.processSource(source, platforms, results);
        results.sourcesProcessed++;
        results.contentGenerated += produced;
      } catch (err) {
        this.logger.warn(`Failed to process source ${source.id}: ${err.message}`, {
          agentId: this.agentId,
        });
        results.failures.push({ sourceId: source.id, error: err.message });
        this.errors.push({ message: `Source ${source.id}: ${err.message}` });
      }
    }

    this.itemsProduced = results.contentGenerated;
    return results;
  }

  /** Platforms under their weekly cap. Spec §29 — never silently exceed. */
  async platformsWithHeadroom(results) {
    const limits = await this.settings.get('limits');
    const available = [];

    for (const { platform, limitKey } of PACKAGE_PLATFORMS) {
      const cap = limits[limitKey];
      const used = await this.content.countThisWeek(platform);

      if (cap !== undefined && used >= cap) {
        results.skippedAtCap.push({ platform, used, cap });
        continue;
      }
      available.push(platform);
    }

    return available;
  }

  async processSource(source, platforms, results) {
    // §31 — give the generator recent content to avoid repeating
    const recentContent = await this.content.listContent({
      status: ['approved', 'scheduled', 'published'],
      limit: 12,
    });

    const pkg = await this.generator.generatePackage({
      source, platforms, recentContent,
    });

    let stored = 0;

    for (const item of pkg.generated) {
      const { title, body } = ContentGenerator.flatten(item.platform, item.content);

      if (!body || body.trim().length === 0) {
        results.failures.push({ platform: item.platform, error: 'empty_body' });
        continue;
      }

      const record = await this.content.createContent({
        sourceId: source.id,
        platform: item.platform,
        contentType: item.platform === 'blog' ? 'article' : 'post',
        title,
        body,
        metadata: {
          raw: item.content,
          sourceTitle: source.title,
          sourceConfidence: source.source_confidence,
        },
        status: 'needs_review',
        requiresManualPosting: item.requiresManualPosting,
        model: item.model,
        promptVersion: 'v1',
      });

      // §31 — dedup against content_memory. A duplicate is flagged for
      // review rather than silently kept or silently dropped.
      const { duplicate } = await this.content.linkToMemory(record.id, {
        platform: item.platform,
        title,
        body,
        contentType: item.platform === 'blog' ? 'blog_post' : 'social_post',
      });

      if (duplicate) {
        await this.content.updateContent(record.id, {
          metadata: { ...record.metadata, duplicateOf: duplicate.matchId, matchType: duplicate.matchType },
        });
        this.logger.info(`Content ${record.id} flagged as near-duplicate`, {
          agentId: this.agentId, matchType: duplicate.matchType,
        });
      }

      // Queue for human review
      await this.submitForApproval({
        itemType: item.platform === 'linkedin_personal' ? 'linkedin_personal_post' : 'growth_content',
        tier: item.platform === 'linkedin_personal' ? 3 : 2,
        contentPreview: `[${item.platform}] ${title || body.slice(0, 80)}`,
        fullContent: {
          growthContentId: record.id,
          platform: item.platform,
          title,
          body,
          raw: item.content,
          requiresManualPosting: item.requiresManualPosting,
        },
      });

      results.byPlatform[item.platform] = (results.byPlatform[item.platform] || 0) + 1;
      stored++;
    }

    for (const failure of pkg.failed) {
      results.failures.push({ sourceId: source.id, ...failure });
    }

    // Mark the source used only if something actually came out of it
    if (stored > 0) {
      await this.content.updateSource(source.id, { status: 'used' });
    }

    return stored;
  }
}

module.exports = GrowthContentRepurposerAgent;
module.exports.PACKAGE_PLATFORMS = PACKAGE_PLATFORMS;
