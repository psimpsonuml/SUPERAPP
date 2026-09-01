// ══════════════════════════════════════════════════════════════════
// Growth content publishing
//
// The single path from an approved growth_content row to a live post.
//
// Every outcome is recorded on the content record and in its event log.
// A publish that could not run marks the content 'failed' with a named
// reason — it never stays silently 'approved' looking like it worked.
// ══════════════════════════════════════════════════════════════════

const GrowthContentService = require('./content');
const GrowthAttributionService = require('./attribution');
const { contentUrl } = require('./attribution');
const publishers = require('./publishers');
const logger = require('../logger');

/**
 * Publish one growth_content row.
 * @returns {Promise<{ok, platform, postId?, postUrl?, reason?, detail?}>}
 */
async function publishGrowthContent(accountId, contentId) {
  const service = new GrowthContentService(accountId);
  const content = await service.getContent(contentId);

  if (!content) {
    return { ok: false, reason: 'content_not_found' };
  }
  if (content.status === 'published') {
    return { ok: true, alreadyPublished: true, postUrl: content.published_url, platform: content.platform };
  }

  const platform = content.platform;

  // Manual platforms are not failures — they are waiting for a human.
  if (content.requires_manual_posting || !publishers.canAutoPublish(platform)) {
    return {
      ok: false,
      platform,
      reason: 'manual_posting_required',
      detail: publishers.manualReason(platform),
    };
  }

  const publisher = publishers.getPublisher(platform);
  if (!publisher.isConfigured()) {
    const reason = 'publisher_not_configured';
    await service.markFailed(contentId, `${reason}: missing ${publisher.missingEnv().join(', ')}`);
    return {
      ok: false, platform, reason,
      detail: `Missing environment variables: ${publisher.missingEnv().join(', ')}`,
    };
  }

  // Attribution link so a click can be traced back to this post
  const linkUrl = contentUrl({
    platform,
    campaign: content.campaign_id ? String(content.campaign_id) : 'content',
    contentSlug: contentId,
  });

  const raw = content.metadata?.raw || {};

  const payload = {
    title: content.title,
    body: content.body,
    linkUrl,
    // Only a genuinely hosted image — never a prompt or a placeholder.
    imageUrl: content.metadata?.imageUrl || raw.image_url || null,
    hashtags: raw.hashtags || null,
  };

  // Ask the publisher whether this is publishable before spending a call
  const check = publisher.canPublish(payload);
  if (!check.publishable) {
    await service.markFailed(contentId, `${check.reason}${check.detail ? `: ${check.detail}` : ''}`);
    logger.warn(`Cannot publish ${contentId} to ${platform}: ${check.reason}`, { accountId });
    return { ok: false, platform, reason: check.reason, detail: check.detail };
  }

  const result = await publisher.publish(payload);

  if (!result.ok) {
    await service.markFailed(contentId, `${result.reason}${result.detail ? `: ${result.detail}` : ''}`);
    logger.warn(`Publish failed for ${contentId} on ${platform}: ${result.reason}`, {
      accountId, detail: result.detail,
    });
    return { ok: false, platform, ...result };
  }

  await service.markPublished(contentId, result.postUrl);

  // Record the publish so attribution has something to join clicks to
  try {
    const attribution = new GrowthAttributionService(accountId);
    await attribution.record({
      eventType: 'click',
      utmSource: platform,
      utmMedium: 'organic_social',
      utmCampaign: 'content',
      utmContent: contentId,
      contentId,
      landingUrl: linkUrl,
      metadata: { published: true, postUrl: result.postUrl, postId: result.postId },
    });
  } catch (err) {
    logger.warn(`Published but failed to record attribution: ${err.message}`, { accountId, contentId });
  }

  logger.info(`Published ${contentId} to ${platform}`, { accountId, postUrl: result.postUrl });

  return {
    ok: true,
    platform,
    contentId,
    postId: result.postId,
    postUrl: result.postUrl,
  };
}

/**
 * Publish everything whose scheduled time has arrived.
 * Used by the publish-dispatcher agent.
 */
async function publishDueContent(accountId, { limit = 10 } = {}) {
  const service = new GrowthContentService(accountId);

  const due = await service.listContent({
    status: ['approved', 'scheduled'],
    to: new Date().toISOString(),
    limit,
  });

  const results = { attempted: 0, published: 0, failed: 0, manual: 0, outcomes: [] };

  for (const content of due) {
    if (!content.scheduled_for) continue;

    results.attempted++;
    const result = await publishGrowthContent(accountId, content.id);

    if (result.ok) results.published++;
    else if (result.reason === 'manual_posting_required') results.manual++;
    else results.failed++;

    results.outcomes.push({
      contentId: content.id,
      platform: content.platform,
      ok: result.ok,
      reason: result.reason || null,
    });
  }

  return results;
}

module.exports = { publishGrowthContent, publishDueContent };
