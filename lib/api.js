const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `API error ${res.status}`);
  }
  return res.json();
}

// ── Approvals ──────────────────────────────────────────────
export function fetchApprovalQueue(filters = {}) {
  const params = new URLSearchParams();
  if (filters.agent) params.set('agent', filters.agent);
  if (filters.tier) params.set('tier', filters.tier);
  if (filters.limit) params.set('limit', filters.limit);
  const qs = params.toString();
  return apiFetch(`/api/approval${qs ? `?${qs}` : ''}`);
}

export function fetchApprovalStats() {
  return apiFetch('/api/approval/stats');
}

export function fetchOverdueItems() {
  return apiFetch('/api/approval/overdue');
}

export function approveItem(id, notes) {
  return apiFetch(`/api/approval/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export function rejectItem(id, notes) {
  return apiFetch(`/api/approval/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export function batchAction(action, ids, notes) {
  return apiFetch('/api/approval/batch', {
    method: 'POST',
    body: JSON.stringify({ action, ids, notes }),
  });
}

// ── Settings ───────────────────────────────────────────────
export function fetchSettings() {
  return apiFetch('/api/settings');
}

export function fetchSlider() {
  return apiFetch('/api/settings/slider');
}

export function updateSlider(position) {
  return apiFetch('/api/settings/slider', {
    method: 'PATCH',
    body: JSON.stringify({ position }),
  });
}

export function updateReducedOps(enabled) {
  return apiFetch('/api/settings/reduced-ops', {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

export function fetchBrandProfiles() {
  return apiFetch('/api/settings/brand-profiles');
}

export function updateBrandProfile(product, data) {
  return apiFetch(`/api/settings/brand-profiles/${product}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ── Reports ────────────────────────────────────────────────
export function fetchDailyReport() {
  return apiFetch('/api/reports/daily');
}

export function fetchContentPerformance(product, days = 30) {
  return apiFetch(`/api/reports/content-performance?product=${encodeURIComponent(product)}&days=${days}`);
}

export function fetchHealthReport() {
  return apiFetch('/api/reports/health');
}

export function fetchPainPoints(days = 30) {
  return apiFetch(`/api/reports/pain-points?days=${days}`);
}

export function fetchPainPointsToday() {
  return apiFetch('/api/reports/pain-points-today');
}

export function fetchPipeline(track = 'user') {
  return apiFetch(`/api/reports/pipeline?track=${encodeURIComponent(track)}`);
}

export function fetchProductIntelligence({ tab, product, rec_type, status, days } = {}) {
  const params = new URLSearchParams();
  if (tab) params.set('tab', tab);
  if (product) params.set('product', product);
  if (rec_type) params.set('rec_type', rec_type);
  if (status) params.set('status', status);
  if (days) params.set('days', days);
  const qs = params.toString();
  return apiFetch(`/api/reports/product-intelligence${qs ? `?${qs}` : ''}`);
}

export function acceptRecommendation(id) {
  return apiFetch(`/api/reports/product-intelligence/${id}/accept`, { method: 'PATCH' });
}

export function rejectRecommendation(id) {
  return apiFetch(`/api/reports/product-intelligence/${id}/reject`, { method: 'PATCH' });
}

export function snoozeRecommendation(id, days = 30) {
  return apiFetch(`/api/reports/product-intelligence/${id}/snooze`, {
    method: 'PATCH',
    body: JSON.stringify({ days }),
  });
}

export function fetchAdCreatives({ product, platform, status, days } = {}) {
  const params = new URLSearchParams();
  if (product) params.set('product', product);
  if (platform) params.set('platform', platform);
  if (status) params.set('status', status);
  if (days) params.set('days', days);
  const qs = params.toString();
  return apiFetch(`/api/reports/ad-creatives${qs ? `?${qs}` : ''}`);
}

export function markCreativeUsed(id, performanceUrl) {
  return apiFetch(`/api/reports/ad-creatives/${id}/used`, {
    method: 'PATCH',
    body: JSON.stringify({ performanceUrl }),
  });
}

export function fetchQaPlaytest(days = 30) {
  return apiFetch(`/api/reports/qa-playtest?days=${days}`);
}

export function fetchContentLibrary(days = 30) {
  return apiFetch(`/api/reports/content-library?days=${days}`);
}

export function fetchQaPlaytestDay(date) {
  return apiFetch(`/api/reports/qa-playtest/${date}`);
}

export function fetchIntelligenceBriefing({ days = 7, category, product, status } = {}) {
  const params = new URLSearchParams({ days });
  if (category) params.set('category', category);
  if (product) params.set('product', product);
  if (status) params.set('status', status);
  return apiFetch(`/api/reports/intelligence?${params}`);
}

export function updateIntelligenceStatus(id, status) {
  return apiFetch(`/api/reports/intelligence/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// ── Agents ─────────────────────────────────────────────────
export function fetchAgents() {
  return apiFetch('/api/agents');
}

export function fetchAgentRuns(agentId, limit = 20) {
  return apiFetch(`/api/agents/${encodeURIComponent(agentId)}/runs?limit=${limit}`);
}

export function triggerAgent(agentId) {
  return apiFetch(`/api/agents/${encodeURIComponent(agentId)}/trigger`, {
    method: 'POST',
  });
}

// ── Settings: Sending Domains ─────────────────────────────
export function fetchSendingDomains() {
  return apiFetch('/api/settings/sending-domains');
}

// ── Personal Module ───────────────────────────────────────
export function fetchEntertainmentRatings() {
  return apiFetch('/api/personal/entertainment/ratings');
}

export function rateEntertainment(data) {
  return apiFetch('/api/personal/entertainment/rate', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchCascadeScores() {
  return apiFetch('/api/personal/entertainment/cascade');
}

export function fetchReminders() {
  return apiFetch('/api/personal/reminders');
}

export function createReminder(data) {
  return apiFetch('/api/personal/reminders', { method: 'POST', body: JSON.stringify(data) });
}

export function completeReminder(id) {
  return apiFetch(`/api/personal/reminders/${id}/complete`, { method: 'PATCH' });
}

export function fetchFamilyLog() {
  return apiFetch('/api/personal/family-log');
}

export function addFamilyEntry(data) {
  return apiFetch('/api/personal/family-log', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchQuizQuestions(category) {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiFetch(`/api/quiz/questions${qs}`);
}

export function fetchQuizAnswers() {
  return apiFetch('/api/quiz/answers');
}

export function submitQuizAnswer(data) {
  return apiFetch('/api/quiz/answer', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchQuizProfile() {
  return apiFetch('/api/quiz/profile');
}

export function fetchQuizCategories() {
  return apiFetch('/api/quiz/categories');
}

export function fetchQuizUnanswered(category, limit = 1) {
  const params = new URLSearchParams({ limit });
  if (category) params.set('category', category);
  return apiFetch(`/api/quiz/unanswered?${params}`);
}

export function fetchQuizReask() {
  return apiFetch('/api/quiz/reask');
}

export function fetchQuizChanges() {
  return apiFetch('/api/quiz/changes');
}

// ── Life Manager ─────────────────────────────────────────
export function fetchLifeReminders() {
  return apiFetch('/api/life/reminders');
}

export function createLifeReminder(data) {
  return apiFetch('/api/life/reminders', { method: 'POST', body: JSON.stringify(data) });
}

export function updateLifeReminder(id, data) {
  return apiFetch(`/api/life/reminders/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deleteLifeReminder(id) {
  return apiFetch(`/api/life/reminders/${id}`, { method: 'DELETE' });
}

export function completeLifeReminder(id) {
  return apiFetch(`/api/life/reminders/${id}/complete`, { method: 'POST' });
}

export function fetchLifeUpcoming() {
  return apiFetch('/api/life/upcoming');
}

export function fetchLifeStreaks() {
  return apiFetch('/api/life/streaks');
}

export function fetchLifeFamily(filters = {}) {
  const params = new URLSearchParams();
  if (filters.child) params.set('child', filters.child);
  if (filters.category) params.set('category', filters.category);
  if (filters.month) params.set('month', filters.month);
  if (filters.search) params.set('search', filters.search);
  const qs = params.toString();
  return apiFetch(`/api/life/family${qs ? `?${qs}` : ''}`);
}

export function addLifeFamilyEntry(data) {
  return apiFetch('/api/life/family', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchLifeFamilySummary(month) {
  return apiFetch(`/api/life/family/summary?month=${encodeURIComponent(month)}`);
}

export function fetchLearningQueue() {
  return apiFetch('/api/personal/learning');
}

export function addLearningItem(data) {
  return apiFetch('/api/personal/learning', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchPersonalHealth(days = 30) {
  return apiFetch(`/api/personal/health?days=${days}`);
}

export function addHealthMetric(data) {
  return apiFetch('/api/personal/health/manual', { method: 'POST', body: JSON.stringify(data) });
}

export function importHealthData(data) {
  return apiFetch('/api/personal/health/import', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchHealthImports() {
  return apiFetch('/api/personal/health/imports');
}

export function fetchHealthTargets() {
  return apiFetch('/api/personal/health/targets');
}

export function setHealthTarget(data) {
  return apiFetch('/api/personal/health/targets', { method: 'PUT', body: JSON.stringify(data) });
}

export function fetchHealthWorkouts(days = 90, type) {
  const params = new URLSearchParams({ days });
  if (type) params.set('type', type);
  return apiFetch(`/api/personal/health/workouts?${params}`);
}

export function fetchHealthCorrelations() {
  return apiFetch('/api/personal/health/correlations');
}

export function generateHealthCorrelations() {
  return apiFetch('/api/personal/health/correlations/generate', { method: 'POST' });
}

export function fetchHealthDigest() {
  return apiFetch('/api/personal/health/digest');
}

export function generateHealthDigest() {
  return apiFetch('/api/personal/health/digest/generate', { method: 'POST' });
}

export function deleteHealthData() {
  return apiFetch('/api/personal/health', { method: 'DELETE' });
}

export function fetchNewsFeed({ topic, saved, sort, limit } = {}) {
  const params = new URLSearchParams();
  if (topic && topic !== 'all') params.set('topic', topic);
  if (saved) params.set('saved', 'true');
  if (sort) params.set('sort', sort);
  if (limit) params.set('limit', limit);
  const qs = params.toString();
  return apiFetch(`/api/personal/news${qs ? `?${qs}` : ''}`);
}

export function saveNewsItem(itemId, saved = true) {
  return apiFetch('/api/personal/news/save', { method: 'POST', body: JSON.stringify({ itemId, saved }) });
}

export function fetchMorningBriefing(refresh = false) {
  return apiFetch(`/api/personal/news/briefing${refresh ? '?refresh=true' : ''}`);
}

export function fetchNewsFeedPreferences() {
  return apiFetch('/api/personal/news/preferences');
}

export function updateNewsFeedPreferences(prefs) {
  return apiFetch('/api/personal/news/preferences', { method: 'PUT', body: JSON.stringify(prefs) });
}

export function fetchTopStories() {
  return apiFetch('/api/personal/news/top-stories');
}

export function fetchReleases() {
  return apiFetch('/api/personal/releases');
}

// ── Facebook Archaeologist ──────────────────────────────
export function fetchFbStatus() {
  return apiFetch('/api/personal/facebook/status');
}

export function uploadFbData(files, includeMessages = false) {
  return apiFetch('/api/personal/facebook/upload', {
    method: 'POST',
    body: JSON.stringify({ files, includeMessages }),
  });
}

export function fetchFbData(type) {
  const qs = type ? `?type=${type}` : '';
  return apiFetch(`/api/personal/facebook/data${qs}`);
}

export function fetchFbAnalysis(type) {
  const qs = type ? `?type=${type}` : '';
  return apiFetch(`/api/personal/facebook/analysis${qs}`);
}

export function runFbAnalysis(analysisType) {
  return apiFetch('/api/personal/facebook/analyze', {
    method: 'POST',
    body: JSON.stringify({ analysisType }),
  });
}

export function deleteFbData() {
  return apiFetch('/api/personal/facebook/data', { method: 'DELETE' });
}

export function fetchReleaseWeek(offset = 0) {
  return apiFetch(`/api/releases/week?offset=${offset}`);
}

export function fetchReleaseGenres() {
  return apiFetch('/api/releases/genres');
}

// ── Infrastructure ───────────────────────────────────────
export function fetchInfraStatus() {
  return apiFetch('/api/infrastructure/status');
}

export function fetchInfraUptime(service, period = '24h') {
  const params = new URLSearchParams({ period });
  if (service) params.set('service', service);
  return apiFetch(`/api/infrastructure/uptime?${params}`);
}

export function fetchInfraAlerts({ resolved, severity } = {}) {
  const params = new URLSearchParams();
  if (resolved != null) params.set('resolved', resolved);
  if (severity) params.set('severity', severity);
  const qs = params.toString();
  return apiFetch(`/api/infrastructure/alerts${qs ? `?${qs}` : ''}`);
}

export function resolveInfraAlert(id) {
  return apiFetch(`/api/infrastructure/alerts/${id}/resolve`, { method: 'POST' });
}

// ── Community Scout ──────────────────────────────────────
export function fetchCommunityReport(days = 7) {
  return apiFetch(`/api/reports/communities?days=${days}`);
}

// ── Content Calendar ─────────────────────────────────────
export function fetchCalendarWeek(offset = 0) {
  return apiFetch(`/api/calendar/week?offset=${offset}`);
}

export function fetchCalendarEntry(id) {
  return apiFetch(`/api/calendar/entry/${id}`);
}

export function updateCalendarEntryStatus(id, status) {
  return apiFetch(`/api/calendar/entry/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export function fetchCalendarStats() {
  return apiFetch('/api/calendar/stats');
}

// ── SEO/AEO Writer ──────────────────────────────────────
export function fetchSeoPostsToday() {
  return apiFetch('/api/reports/seo-posts-today');
}

// ── Outreach Prospector ─────────────────────────────────
export function fetchOutreachReport() {
  return apiFetch('/api/reports/outreach');
}

// ── Builder Community ────────────────────────────────────
// ── Substack Publisher ──────────────────────────────────
export function fetchNewsletterReport(days = 7) {
  return apiFetch(`/api/reports/newsletter?days=${days}`);
}

export function updateNewsletterStats(id, { open_rate, subscriber_count }) {
  return apiFetch(`/api/reports/newsletter/${id}/stats`, {
    method: 'PATCH',
    body: JSON.stringify({ open_rate, subscriber_count }),
  });
}

// ── Video Producer ──────────────────────────────────────
export function fetchVideoProductionReport({ days = 1, product } = {}) {
  const params = new URLSearchParams({ days });
  if (product) params.set('product', product);
  return apiFetch(`/api/reports/video-production?${params}`);
}

// ── Social Distributor ──────────────────────────────────
export function fetchSocialReport() {
  return apiFetch('/api/reports/social');
}

// ── Connected Accounts ──────────────────────────────────
export function fetchConnectedAccounts() {
  return apiFetch('/api/settings/connected-accounts');
}

export function connectPlatform(platform, data) {
  return apiFetch(`/api/settings/connected-accounts/${encodeURIComponent(platform)}/connect`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function disconnectPlatform(platform, product) {
  return apiFetch(`/api/settings/connected-accounts/${encodeURIComponent(platform)}/disconnect`, {
    method: 'POST',
    body: JSON.stringify({ product }),
  });
}

export function testPlatformConnection(platform) {
  return apiFetch(`/api/settings/connected-accounts/${encodeURIComponent(platform)}/test`);
}

// ── TMDB / Entertainment Browse ──────────────────────────
export function tmdbDiscover({ feed = 'popular', page = 1, genre, media_type = 'movie', year, decade, language } = {}) {
  const params = new URLSearchParams({ feed, page, media_type });
  if (genre) params.set('genre', genre);
  if (year) params.set('year', year);
  if (decade) params.set('decade', decade);
  if (language) params.set('language', language);
  return apiFetch(`/api/tmdb/discover?${params}`);
}

export function tmdbSearch(q, { page = 1, media_type = 'movie' } = {}) {
  return apiFetch(`/api/tmdb/search?q=${encodeURIComponent(q)}&page=${page}&media_type=${media_type}`);
}

export function tmdbCredits(tmdbId, media_type = 'movie') {
  return apiFetch(`/api/tmdb/credits/${tmdbId}?media_type=${media_type}`);
}

export function tmdbGenres(media_type = 'movie') {
  return apiFetch(`/api/tmdb/genres?media_type=${media_type}`);
}

export function tmdbDetail(tmdbId, media_type = 'movie') {
  return apiFetch(`/api/tmdb/detail/${tmdbId}?media_type=${media_type}`);
}

export function tmdbRate(data) {
  return apiFetch('/api/tmdb/rate', { method: 'POST', body: JSON.stringify(data) });
}

export function tmdbRatedIds() {
  return apiFetch('/api/tmdb/rated-ids');
}

// ── Growth: Satellite Blogs ─────────────────────────────
export function fetchSatelliteBlogs() {
  return apiFetch('/api/reports/satellite-blogs');
}

export function createSatelliteBlog(data) {
  return apiFetch('/api/reports/satellite-blogs', { method: 'POST', body: JSON.stringify(data) });
}

export function updateSatelliteBlog(id, data) {
  return apiFetch(`/api/reports/satellite-blogs/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

// ── Growth: Vertical Tools ──────────────────────────────
export function fetchVerticalTools() {
  return apiFetch('/api/reports/vertical-tools');
}

export function createVerticalTool(data) {
  return apiFetch('/api/reports/vertical-tools', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchDiscountCodes({ tool_id, status } = {}) {
  const params = new URLSearchParams();
  if (tool_id) params.set('tool_id', tool_id);
  if (status) params.set('status', status);
  const qs = params.toString();
  return apiFetch(`/api/reports/discount-codes${qs ? `?${qs}` : ''}`);
}

// ── Onboarding Agent ──────────────────────────────────────────

export function fetchOnboarding() {
  return apiFetch('/api/onboarding');
}

export function generateOnboardingAssets(data) {
  return apiFetch('/api/onboarding/generate', { method: 'POST', body: JSON.stringify(data) });
}

export function generateAllOnboardingAssets(data) {
  return apiFetch('/api/onboarding/generate-all', { method: 'POST', body: JSON.stringify(data) });
}

export function regenerateOnboardingAsset(data) {
  return apiFetch('/api/onboarding/regenerate', { method: 'POST', body: JSON.stringify(data) });
}

export function updateOnboardingStatus(data) {
  return apiFetch('/api/onboarding/status', { method: 'PUT', body: JSON.stringify(data) });
}

export function generateSatelliteAssets() {
  return apiFetch('/api/onboarding/satellites', { method: 'POST' });
}

export function generateEmailDomainSetup() {
  return apiFetch('/api/onboarding/email-domains', { method: 'POST' });
}

// ── Revenue ─────────────────────────────────────────────────
export function fetchRevenue() {
  return apiFetch('/api/revenue');
}

export function fetchRevenueChart(months = 6) {
  return apiFetch(`/api/revenue/chart?months=${months}`);
}

export function fetchRevenueSubscriptions() {
  return apiFetch('/api/revenue/subscriptions');
}

export function fetchRevenueNew() {
  return apiFetch('/api/revenue/new');
}

export function fetchRevenueChurn() {
  return apiFetch('/api/revenue/churn');
}

export function fetchRevenueFailed() {
  return apiFetch('/api/revenue/failed');
}

export function fetchRevenueBySource() {
  return apiFetch('/api/revenue/by-source');
}

export function fetchRevenueForecast(months = 6) {
  return apiFetch(`/api/revenue/forecast?months=${months}`);
}

export function refreshRevenue() {
  return apiFetch('/api/revenue/refresh', { method: 'POST' });
}

// ── Recommendations & Watch Parties ──────────────────────
export function fetchRecLists(accountId) {
  return apiFetch(`/api/recommendations/lists?account_id=${accountId}`);
}

export function fetchRecList(id) {
  return apiFetch(`/api/recommendations/lists/${id}`);
}

export function createRecList(data) {
  return apiFetch('/api/recommendations/lists', { method: 'POST', body: JSON.stringify(data) });
}

export function updateRecList(id, data) {
  return apiFetch(`/api/recommendations/lists/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteRecList(id) {
  return apiFetch(`/api/recommendations/lists/${id}`, { method: 'DELETE' });
}

export function autoGenerateRecList(data) {
  return apiFetch('/api/recommendations/lists/auto-generate', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchWatchParties(accountId) {
  return apiFetch(`/api/recommendations/parties?account_id=${accountId}`);
}

export function createWatchParty(data) {
  return apiFetch('/api/recommendations/parties', { method: 'POST', body: JSON.stringify(data) });
}

export function updateWatchParty(id, data) {
  return apiFetch(`/api/recommendations/parties/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteWatchParty(id) {
  return apiFetch(`/api/recommendations/parties/${id}`, { method: 'DELETE' });
}

export function generateRecommendation(data) {
  return apiFetch('/api/recommendations/recommend', { method: 'POST', body: JSON.stringify(data) });
}

// ── Podcasts ──────────────────────────────────────────────
export function searchPodcasts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  const qs = params.toString();
  return apiFetch(`/api/podcasts/search${qs ? `?${qs}` : ''}`);
}

export function fetchPodcastSubscriptions() {
  return apiFetch('/api/podcasts/subscriptions');
}

export function subscribePodcast(body) {
  return apiFetch('/api/podcasts/subscriptions', { method: 'POST', body: JSON.stringify(body) });
}

export function unsubscribePodcast(podcastId) {
  return apiFetch(`/api/podcasts/subscriptions/${podcastId}`, { method: 'DELETE' });
}

export function fetchPodcastEpisodes(filters = {}) {
  const params = new URLSearchParams();
  if (filters.podcast_id) params.set('podcast_id', filters.podcast_id);
  if (filters.page) params.set('page', filters.page);
  if (filters.limit) params.set('limit', filters.limit);
  const qs = params.toString();
  return apiFetch(`/api/podcasts/episodes${qs ? `?${qs}` : ''}`);
}

export function fetchPodcastEpisode(id) {
  return apiFetch(`/api/podcasts/episodes/${id}`);
}

export function ratePodcastEpisode(episodeId, body) {
  return apiFetch(`/api/podcasts/episodes/${episodeId}/rate`, { method: 'POST', body: JSON.stringify(body) });
}

export function fetchPodcastRatings(filters = {}) {
  const params = new URLSearchParams();
  if (filters.show) params.set('show', filters.show);
  if (filters.min_score) params.set('min_score', filters.min_score);
  if (filters.max_score) params.set('max_score', filters.max_score);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const qs = params.toString();
  return apiFetch(`/api/podcasts/ratings${qs ? `?${qs}` : ''}`);
}

export function fetchPodcastHosts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.order) params.set('order', filters.order);
  const qs = params.toString();
  return apiFetch(`/api/podcasts/hosts${qs ? `?${qs}` : ''}`);
}

export function fetchPodcastHostDetail(name) {
  return apiFetch(`/api/podcasts/hosts/${encodeURIComponent(name)}`);
}

export function fetchPodcastQueue() {
  return apiFetch('/api/podcasts/queue');
}

export function fetchPodcastStats() {
  return apiFetch('/api/podcasts/stats');
}

export function fetchPodcastRecommendations() {
  return apiFetch('/api/podcasts/recommendations');
}

// ── Knowledge Base ──────────────────────────────────────────

export function fetchKbArticles({ product, status, search, sort, page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (product) params.set('product', product);
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  if (sort) params.set('sort', sort);
  return apiFetch(`/api/kb?${params}`);
}

export function fetchKbArticle(id) {
  return apiFetch(`/api/kb/${id}`);
}

export function createKbArticle(data) {
  return apiFetch('/api/kb/articles', { method: 'POST', body: JSON.stringify(data) });
}

export function updateKbArticle(id, data) {
  return apiFetch(`/api/kb/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function markKbHelpful(id) {
  return apiFetch(`/api/kb/articles/${id}/helpful`, { method: 'POST' });
}

export function markKbNotHelpful(id) {
  return apiFetch(`/api/kb/articles/${id}/not-helpful`, { method: 'POST' });
}

export function fetchKbQuestions(product) {
  const qs = product ? `?product=${encodeURIComponent(product)}` : '';
  return apiFetch(`/api/kb/questions${qs}`);
}

export function logKbQuestion(data) {
  return apiFetch('/api/kb/questions', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchKbGaps() {
  return apiFetch('/api/kb/gaps');
}

export function exportKb(format = 'md') {
  return apiFetch(`/api/kb/export?format=${format}`);
}

export function generateKbArticle(data) {
  return apiFetch('/api/kb/generate', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchKbAnalytics() {
  return apiFetch('/api/kb/analytics');
}

// ── Testimonials ──────────────────────────────────────────

export function fetchTestimonials({ product, source, tag, rating, approved, category, page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (product) params.set('product', product);
  if (source) params.set('source', source);
  if (tag) params.set('tag', tag);
  if (rating) params.set('rating', rating);
  if (approved != null) params.set('approved', approved);
  if (category) params.set('category', category);
  return apiFetch(`/api/testimonials?${params}`);
}

export function fetchTestimonialStats() {
  return apiFetch('/api/testimonials/stats');
}

export function createTestimonial(data) {
  return apiFetch('/api/testimonials', { method: 'POST', body: JSON.stringify(data) });
}

export function updateTestimonial(id, data) {
  return apiFetch(`/api/testimonials/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteTestimonial(id) {
  return apiFetch(`/api/testimonials/${id}`, { method: 'DELETE' });
}

export function approveTestimonial(id) {
  return apiFetch(`/api/testimonials/${id}/approve`, { method: 'POST' });
}

export function generateTestimonialSocial(id) {
  return apiFetch(`/api/testimonials/${id}/social`, { method: 'POST' });
}

export function exportTestimonials() {
  return apiFetch('/api/testimonials/export');
}

// ── Partners ──────────────────────────────────────────────

export function fetchPartners({ type, status, product } = {}) {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (status) params.set('status', status);
  if (product) params.set('product', product);
  const qs = params.toString();
  return apiFetch(`/api/partners${qs ? `?${qs}` : ''}`);
}

export function fetchPartnerDetail(id) {
  return apiFetch(`/api/partners/${id}`);
}

export function createPartner(data) {
  return apiFetch('/api/partners', { method: 'POST', body: JSON.stringify(data) });
}

export function updatePartner(id, data) {
  return apiFetch(`/api/partners/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deletePartner(id) {
  return apiFetch(`/api/partners/${id}`, { method: 'DELETE' });
}

export function fetchPartnerReferrals(id) {
  return apiFetch(`/api/partners/${id}/referrals`);
}

export function addPartnerReferral(id, data) {
  return apiFetch(`/api/partners/${id}/referrals`, { method: 'POST', body: JSON.stringify(data) });
}

export function fetchPartnerPayments(id) {
  return apiFetch(`/api/partners/${id}/payments`);
}

export function addPartnerPayment(id, data) {
  return apiFetch(`/api/partners/${id}/payments`, { method: 'POST', body: JSON.stringify(data) });
}

export function updateReferralStatus(refId, status) {
  return apiFetch(`/api/partners/referrals/${refId}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
}

export function fetchCommissionSummary() {
  return apiFetch('/api/partners/summary/commissions');
}

export function draftPartnerUpdate(id) {
  return apiFetch(`/api/partners/${id}/draft-update`, { method: 'POST' });
}

export function exportPartnerCommissions() {
  return apiFetch('/api/partners/export');
}

// ── Journal ──────────────────────────────────────────────

export function fetchJournalEntries({ type, startDate, endDate, search, page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (type) params.set('type', type);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (search) params.set('search', search);
  return apiFetch(`/api/journal?${params}`);
}

export function fetchJournalEntry(id) {
  return apiFetch(`/api/journal/entry/${id}`);
}

export function createJournalEntry(data) {
  return apiFetch('/api/journal', { method: 'POST', body: JSON.stringify(data) });
}

export function updateJournalEntry(id, data) {
  return apiFetch(`/api/journal/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteJournalEntry(id) {
  return apiFetch(`/api/journal/${id}`, { method: 'DELETE' });
}

export function fetchJournalStreak() {
  return apiFetch('/api/journal/streak');
}

export function fetchJournalCalendar(month) {
  const qs = month ? `?month=${month}` : '';
  return apiFetch(`/api/journal/calendar${qs}`);
}

export function fetchJournalPrompt() {
  return apiFetch('/api/journal/prompt');
}

export function fetchJournalReflections() {
  return apiFetch('/api/journal/reflections');
}

export function generateMonthlyReflection() {
  return apiFetch('/api/journal/monthly-reflection', { method: 'POST' });
}

export function searchJournal(q) {
  return apiFetch(`/api/journal/search?q=${encodeURIComponent(q)}`);
}

// ── Goals ──────────────────────────────────────────────────

export function fetchGoals({ category, status } = {}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (status) params.set('status', status);
  const qs = params.toString();
  return apiFetch(`/api/goals${qs ? `?${qs}` : ''}`);
}

export function fetchGoalDetail(id) {
  return apiFetch(`/api/goals/${id}`);
}

export function createGoal(data) {
  return apiFetch('/api/goals', { method: 'POST', body: JSON.stringify(data) });
}

export function updateGoal(id, data) {
  return apiFetch(`/api/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteGoal(id) {
  return apiFetch(`/api/goals/${id}`, { method: 'DELETE' });
}

export function addGoalMilestone(goalId, data) {
  return apiFetch(`/api/goals/${goalId}/milestones`, { method: 'POST', body: JSON.stringify(data) });
}

export function updateGoalMilestone(mid, data) {
  return apiFetch(`/api/goals/milestones/${mid}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteGoalMilestone(mid) {
  return apiFetch(`/api/goals/milestones/${mid}`, { method: 'DELETE' });
}

export function fetchGoalTimeline() {
  return apiFetch('/api/goals/timeline');
}

export function submitWeeklyCheckin(data) {
  return apiFetch('/api/goals/weekly-checkin', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchGoalStats() {
  return apiFetch('/api/goals/stats');
}

// ── Nostalgia Engine ──────────────────────────────────────

export function fetchNostalgiaToday() {
  return apiFetch('/api/nostalgia/today');
}

export function fetchNostalgiaDate(date) {
  return apiFetch(`/api/nostalgia/date/${date}`);
}

export function fetchNostalgiaWeek() {
  return apiFetch('/api/nostalgia/week');
}

export function fetchNostalgiaCalendar(month) {
  const qs = month ? `?month=${month}` : '';
  return apiFetch(`/api/nostalgia/calendar${qs}`);
}

export function fetchNostalgiaBrowse({ source_module, year, page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (source_module) params.set('source_module', source_module);
  if (year) params.set('year', year);
  return apiFetch(`/api/nostalgia/browse?${params}`);
}

export function rebuildNostalgiaCache() {
  return apiFetch('/api/nostalgia/rebuild', { method: 'POST' });
}

export function shareNostalgiaMemory(id) {
  return apiFetch('/api/nostalgia/share', { method: 'POST', body: JSON.stringify({ id }) });
}

export function fetchNostalgiaStats() {
  return apiFetch('/api/nostalgia/stats');
}

// ── Wrestling Tracker ───────────────────────────────────────

export function fetchWrestlingFavorites() {
  return apiFetch('/api/wrestling/favorites');
}

export function addWrestlingFavorite(data) {
  return apiFetch('/api/wrestling/favorites', { method: 'POST', body: JSON.stringify(data) });
}

export function removeWrestlingFavorite(id) {
  return apiFetch(`/api/wrestling/favorites/${id}`, { method: 'DELETE' });
}

export function fetchWrestlingEvents({ promotion, event_type, limit } = {}) {
  const params = new URLSearchParams();
  if (promotion) params.set('promotion', promotion);
  if (event_type) params.set('event_type', event_type);
  if (limit) params.set('limit', limit);
  return apiFetch(`/api/wrestling/events?${params}`);
}

export function fetchWrestlingMatches({ promotion, event_id, title_match, page, limit } = {}) {
  const params = new URLSearchParams();
  if (promotion) params.set('promotion', promotion);
  if (event_id) params.set('event_id', event_id);
  if (title_match) params.set('title_match', 'true');
  if (page) params.set('page', page);
  if (limit) params.set('limit', limit);
  return apiFetch(`/api/wrestling/matches?${params}`);
}

export function fetchWrestlingRatings({ promotion, min_score, page, limit } = {}) {
  const params = new URLSearchParams();
  if (promotion) params.set('promotion', promotion);
  if (min_score) params.set('min_score', min_score);
  if (page) params.set('page', page);
  if (limit) params.set('limit', limit);
  return apiFetch(`/api/wrestling/ratings?${params}`);
}

export function rateWrestlingMatch(data) {
  return apiFetch('/api/wrestling/ratings', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchWrestlingWrestlers({ promotion, page, limit } = {}) {
  const params = new URLSearchParams();
  if (promotion) params.set('promotion', promotion);
  if (page) params.set('page', page);
  if (limit) params.set('limit', limit);
  return apiFetch(`/api/wrestling/wrestlers?${params}`);
}

export function fetchWrestlingWrestlerDetail(name) {
  return apiFetch(`/api/wrestling/wrestlers/${encodeURIComponent(name)}`);
}

export function fetchWrestlingStats() {
  return apiFetch('/api/wrestling/stats');
}

export function fetchWrestlingMyStats() {
  return apiFetch('/api/wrestling/my-stats');
}

export function fetchWrestlingPromotions() {
  return apiFetch('/api/wrestling/promotions');
}

// ── Pets ──────────────────────────────────────────────────

export function fetchPets() {
  return apiFetch('/api/pets');
}

export function fetchPetDetail(id) {
  return apiFetch(`/api/pets/${id}`);
}

export function createPet(data) {
  return apiFetch('/api/pets', { method: 'POST', body: JSON.stringify(data) });
}

export function updatePet(id, data) {
  return apiFetch(`/api/pets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deletePet(id) {
  return apiFetch(`/api/pets/${id}`, { method: 'DELETE' });
}

export function fetchPetHealth(petId, type) {
  const qs = type ? `?type=${type}` : '';
  return apiFetch(`/api/pets/${petId}/health${qs}`);
}

export function addPetHealth(petId, data) {
  return apiFetch(`/api/pets/${petId}/health`, { method: 'POST', body: JSON.stringify(data) });
}

export function updatePetHealth(recordId, data) {
  return apiFetch(`/api/pets/health/${recordId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function fetchPetMemories(petId) {
  return apiFetch(`/api/pets/${petId}/memories`);
}

export function addPetMemory(petId, data) {
  return apiFetch(`/api/pets/${petId}/memories`, { method: 'POST', body: JSON.stringify(data) });
}

export function fetchPetWeightHistory(petId) {
  return apiFetch(`/api/pets/${petId}/weight-history`);
}

export function fetchPetUpcoming(petId) {
  return apiFetch(`/api/pets/${petId}/upcoming`);
}

export function fetchPetExpenses(petId) {
  return apiFetch(`/api/pets/${petId}/expenses`);
}

export function fetchPetEmergencyCard(petId) {
  return apiFetch(`/api/pets/${petId}/emergency-card`);
}

export function fetchPetExpenseSummary() {
  return apiFetch('/api/pets/expenses/summary');
}

// ── Live Events ──────────────────────────────────────────

export function fetchLiveEvents({ type, city, year, page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (type) params.set('type', type);
  if (city) params.set('city', city);
  if (year) params.set('year', year);
  return apiFetch(`/api/events?${params}`);
}

export function fetchLiveEventsUpcoming() {
  return apiFetch('/api/events/upcoming');
}

export function fetchLiveEventDetail(id) {
  return apiFetch(`/api/events/${id}`);
}

export function createLiveEvent(data) {
  return apiFetch('/api/events', { method: 'POST', body: JSON.stringify(data) });
}

export function updateLiveEvent(id, data) {
  return apiFetch(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteLiveEvent(id) {
  return apiFetch(`/api/events/${id}`, { method: 'DELETE' });
}

export function fetchLiveEventStats() {
  return apiFetch('/api/events/stats');
}

export function fetchLiveEventMap() {
  return apiFetch('/api/events/map');
}

export function fetchLiveEventHistory() {
  return apiFetch('/api/events/history');
}

export function shareLiveEventHistory() {
  return apiFetch('/api/events/share', { method: 'POST' });
}

// ── Stores ──────────────────────────────────────────────

export function fetchStores() {
  return apiFetch('/api/stores');
}

export function connectStore(data) {
  return apiFetch('/api/stores', { method: 'POST', body: JSON.stringify(data) });
}

export function updateStore(id, data) {
  return apiFetch(`/api/stores/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function disconnectStore(id) {
  return apiFetch(`/api/stores/${id}`, { method: 'DELETE' });
}

export function fetchStoreSales(storeId) {
  return apiFetch(`/api/stores/${storeId}/sales`);
}

export function fetchStoreListings(storeId) {
  return apiFetch(`/api/stores/${storeId}/listings`);
}

export function fetchStoreDashboard() {
  return apiFetch('/api/stores/dashboard');
}

export function fetchRecentSales() {
  return apiFetch('/api/stores/sales/recent');
}

export function fetchTrackedStores() {
  return apiFetch('/api/stores/tracked');
}

export function addTrackedStore(data) {
  return apiFetch('/api/stores/tracked', { method: 'POST', body: JSON.stringify(data) });
}

export function removeTrackedStore(id) {
  return apiFetch(`/api/stores/tracked/${id}`, { method: 'DELETE' });
}

export function fetchTrackedStoreChanges(id) {
  return apiFetch(`/api/stores/tracked/${id}/changes`);
}

export function fetchWishlist() {
  return apiFetch('/api/stores/wishlist');
}

export function addWishlistItem(data) {
  return apiFetch('/api/stores/wishlist', { method: 'POST', body: JSON.stringify(data) });
}

export function updateWishlistItem(id, data) {
  return apiFetch(`/api/stores/wishlist/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function removeWishlistItem(id) {
  return apiFetch(`/api/stores/wishlist/${id}`, { method: 'DELETE' });
}

export function fetchWishlistPriceHistory(id) {
  return apiFetch(`/api/stores/wishlist/${id}/price-history`);
}

// ── PR & Media Relations ──────────────────────────────────

export function fetchMediaContacts({ beat, outlet, product } = {}) {
  const params = new URLSearchParams();
  if (beat) params.set('beat', beat);
  if (outlet) params.set('outlet', outlet);
  if (product) params.set('product', product);
  return apiFetch(`/api/pr/contacts?${params}`);
}

export function addMediaContact(data) {
  return apiFetch('/api/pr/contacts', { method: 'POST', body: JSON.stringify(data) });
}

export function updateMediaContact(id, data) {
  return apiFetch(`/api/pr/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteMediaContact(id) {
  return apiFetch(`/api/pr/contacts/${id}`, { method: 'DELETE' });
}

export function fetchPressReleases({ product, status } = {}) {
  const params = new URLSearchParams();
  if (product) params.set('product', product);
  if (status) params.set('status', status);
  return apiFetch(`/api/pr/releases?${params}`);
}

export function createPressRelease(data) {
  return apiFetch('/api/pr/releases', { method: 'POST', body: JSON.stringify(data) });
}

export function updatePressRelease(id, data) {
  return apiFetch(`/api/pr/releases/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function pitchPressRelease(id) {
  return apiFetch(`/api/pr/releases/${id}/pitch`, { method: 'POST' });
}

export function fetchMediaMentions({ product, sentiment } = {}) {
  const params = new URLSearchParams();
  if (product) params.set('product', product);
  if (sentiment) params.set('sentiment', sentiment);
  return apiFetch(`/api/pr/mentions?${params}`);
}

export function addMediaMention(data) {
  return apiFetch('/api/pr/mentions', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchMediaOpportunities({ status } = {}) {
  const qs = status ? `?status=${status}` : '';
  return apiFetch(`/api/pr/opportunities${qs}`);
}

export function addMediaOpportunity(data) {
  return apiFetch('/api/pr/opportunities', { method: 'POST', body: JSON.stringify(data) });
}

export function updateMediaOpportunity(id, data) {
  return apiFetch(`/api/pr/opportunities/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function draftOpportunityResponse(id) {
  return apiFetch(`/api/pr/opportunities/${id}/draft`, { method: 'POST' });
}

export function fetchPressKit(product) {
  return apiFetch(`/api/pr/press-kit/${encodeURIComponent(product)}`);
}

export function fetchPrStats() {
  return apiFetch('/api/pr/stats');
}

// ── Design Studio ──────────────────────────────────────────

export function fetchDesignAssets({ product, type, format, page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (product) params.set('product', product);
  if (type) params.set('type', type);
  if (format) params.set('format', format);
  return apiFetch(`/api/design/assets?${params}`);
}

export function fetchDesignAsset(id) {
  return apiFetch(`/api/design/assets/${id}`);
}

export function createDesignAsset(data) {
  return apiFetch('/api/design/assets', { method: 'POST', body: JSON.stringify(data) });
}

export function updateDesignAsset(id, data) {
  return apiFetch(`/api/design/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteDesignAsset(id) {
  return apiFetch(`/api/design/assets/${id}`, { method: 'DELETE' });
}

export function generateDesignAsset(data) {
  return apiFetch('/api/design/assets/generate', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchDesignTemplates() {
  return apiFetch('/api/design/templates');
}

export function createDesignTemplate(data) {
  return apiFetch('/api/design/templates', { method: 'POST', body: JSON.stringify(data) });
}

export function updateDesignTemplate(id, data) {
  return apiFetch(`/api/design/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteDesignTemplate(id) {
  return apiFetch(`/api/design/templates/${id}`, { method: 'DELETE' });
}

export function fetchDesignBrand(product) {
  return apiFetch(`/api/design/brand/${encodeURIComponent(product)}`);
}

export function fetchDesignGallery() {
  return apiFetch('/api/design/gallery');
}

export function regenerateDesignAsset(id) {
  return apiFetch(`/api/design/assets/${id}/regenerate`, { method: 'POST' });
}

export function fetchDesignStats() {
  return apiFetch('/api/design/stats');
}

// ── Podcast Producer ──────────────────────────────────────

export function fetchProducedPodcasts({ series, status, product } = {}) {
  const params = new URLSearchParams();
  if (series) params.set('series', series);
  if (status) params.set('status', status);
  if (product) params.set('product', product);
  return apiFetch(`/api/podcast-producer?${params}`);
}

export function fetchPodcastSeries(seriesName) {
  return apiFetch(`/api/podcast-producer/series/${encodeURIComponent(seriesName)}`);
}

export function fetchProducedEpisode(id) {
  return apiFetch(`/api/podcast-producer/episode/${id}`);
}

export function createProducedEpisode(data) {
  return apiFetch('/api/podcast-producer/episode', { method: 'POST', body: JSON.stringify(data) });
}

export function updateProducedEpisode(id, data) {
  return apiFetch(`/api/podcast-producer/episode/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteProducedEpisode(id) {
  return apiFetch(`/api/podcast-producer/episode/${id}`, { method: 'DELETE' });
}

export function generatePodcastScript(id) {
  return apiFetch(`/api/podcast-producer/episode/${id}/generate-script`, { method: 'POST' });
}

export function generatePodcastAudio(id) {
  return apiFetch(`/api/podcast-producer/episode/${id}/generate-audio`, { method: 'POST' });
}

export function producePodcastEpisode(id) {
  return apiFetch(`/api/podcast-producer/episode/${id}/produce`, { method: 'POST' });
}

export function approvePodcastEpisode(id) {
  return apiFetch(`/api/podcast-producer/episode/${id}/approve`, { method: 'POST' });
}

export function publishPodcastEpisode(id) {
  return apiFetch(`/api/podcast-producer/episode/${id}/publish`, { method: 'POST' });
}

export function fetchNextEpisodeNumber(seriesName) {
  return apiFetch(`/api/podcast-producer/next-episode-number/${encodeURIComponent(seriesName)}`);
}

export function fetchPodcastTopics() {
  return apiFetch('/api/podcast-producer/topics');
}

export function fetchPodcastProducerStats() {
  return apiFetch('/api/podcast-producer/stats');
}

// ── BeaconBot ──────────────────────────────────────────────

export function fetchBotConversations({ context } = {}) {
  const qs = context ? `?context=${context}` : '';
  return apiFetch(`/api/beaconbot/conversations${qs}`);
}

export function fetchBotConversation(id) {
  return apiFetch(`/api/beaconbot/conversations/${id}`);
}

export function createBotConversation(data) {
  return apiFetch('/api/beaconbot/conversations', { method: 'POST', body: JSON.stringify(data) });
}

export function deleteBotConversation(id) {
  return apiFetch(`/api/beaconbot/conversations/${id}`, { method: 'DELETE' });
}

export function sendBotMessage(conversationId, message) {
  return apiFetch(`/api/beaconbot/conversations/${conversationId}/message`, { method: 'POST', body: JSON.stringify({ message }) });
}

export function updateBotConversation(id, data) {
  return apiFetch(`/api/beaconbot/conversations/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function fetchBotActions(conversationId) {
  return apiFetch(`/api/beaconbot/conversations/${conversationId}/actions`);
}

export function executeBotAction(data) {
  return apiFetch('/api/beaconbot/action', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchBotModels() {
  return apiFetch('/api/beaconbot/models');
}

export function switchBotModel(conversationId, model) {
  return apiFetch(`/api/beaconbot/conversations/${conversationId}/model`, { method: 'PUT', body: JSON.stringify({ model }) });
}

export function fetchBotContext() {
  return apiFetch('/api/beaconbot/context');
}

// ── Book Publishing ──────────────────────────────────────

export function fetchAuthBooks() {
  return apiFetch('/api/book-publishing/books');
}

export function fetchAuthBookDetail(id) {
  return apiFetch(`/api/book-publishing/books/${id}`);
}

export function createAuthBook(data) {
  return apiFetch('/api/book-publishing/books', { method: 'POST', body: JSON.stringify(data) });
}

export function updateAuthBook(id, data) {
  return apiFetch(`/api/book-publishing/books/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteAuthBook(id) {
  return apiFetch(`/api/book-publishing/books/${id}`, { method: 'DELETE' });
}

export function fetchBookChapters(bookId) {
  return apiFetch(`/api/book-publishing/books/${bookId}/chapters`);
}

export function addBookChapter(bookId, data) {
  return apiFetch(`/api/book-publishing/books/${bookId}/chapters`, { method: 'POST', body: JSON.stringify(data) });
}

export function updateBookChapter(chapId, data) {
  return apiFetch(`/api/book-publishing/chapters/${chapId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function editAssistChapter(chapId) {
  return apiFetch(`/api/book-publishing/chapters/${chapId}/edit-assist`, { method: 'POST' });
}

export function fetchBookPublishingPlatforms(bookId) {
  return apiFetch(`/api/book-publishing/books/${bookId}/publishing`);
}

export function addBookPublishing(bookId, data) {
  return apiFetch(`/api/book-publishing/books/${bookId}/publishing`, { method: 'POST', body: JSON.stringify(data) });
}

export function updateBookPublishing(pubId, data) {
  return apiFetch(`/api/book-publishing/publishing/${pubId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function fetchBookQueries(bookId) {
  return apiFetch(`/api/book-publishing/books/${bookId}/queries`);
}

export function createBookQuery(bookId, data) {
  return apiFetch(`/api/book-publishing/books/${bookId}/queries`, { method: 'POST', body: JSON.stringify(data) });
}

export function updateBookQuery(qId, data) {
  return apiFetch(`/api/book-publishing/queries/${qId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function fetchBookArcs(bookId) {
  return apiFetch(`/api/book-publishing/books/${bookId}/arcs`);
}

export function addBookArc(bookId, data) {
  return apiFetch(`/api/book-publishing/books/${bookId}/arcs`, { method: 'POST', body: JSON.stringify(data) });
}

export function updateBookArc(arcId, data) {
  return apiFetch(`/api/book-publishing/arcs/${arcId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function fetchBookMarketing(bookId) {
  return apiFetch(`/api/book-publishing/books/${bookId}/marketing`);
}

export function addBookMarketingItem(bookId, data) {
  return apiFetch(`/api/book-publishing/books/${bookId}/marketing`, { method: 'POST', body: JSON.stringify(data) });
}

export function updateBookMarketingItem(mId, data) {
  return apiFetch(`/api/book-publishing/marketing/${mId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function generateBookLaunchCalendar(bookId) {
  return apiFetch(`/api/book-publishing/books/${bookId}/marketing/generate`, { method: 'POST' });
}

export function fetchBookSalesData(bookId) {
  return apiFetch(`/api/book-publishing/books/${bookId}/sales`);
}

export function fetchBookSalesSummary(bookId) {
  return apiFetch(`/api/book-publishing/books/${bookId}/sales/summary`);
}

export function fetchBookReviewsList(bookId) {
  return apiFetch(`/api/book-publishing/books/${bookId}/reviews`);
}

export function addBookReview(bookId, data) {
  return apiFetch(`/api/book-publishing/books/${bookId}/reviews`, { method: 'POST', body: JSON.stringify(data) });
}

export function fetchBookSalesDashboard() {
  return apiFetch('/api/book-publishing/sales/dashboard');
}

export function fetchBookPubStats() {
  return apiFetch('/api/book-publishing/stats');
}

// ── Feature Visibility ────────────────────────────────────
export function fetchFeatureVisibility() {
  return apiFetch('/api/features');
}

export function checkFeatureAccess(featureId) {
  return apiFetch(`/api/features/check/${featureId}`);
}

export function updateFeatureVisibility(featureId, visibility) {
  return apiFetch(`/api/features/${featureId}`, { method: 'PATCH', body: JSON.stringify({ visibility }) });
}

export function bulkUpdateVisibility(feature_ids, visibility) {
  return apiFetch('/api/features/bulk', { method: 'POST', body: JSON.stringify({ feature_ids, visibility }) });
}

// ── Legal Documents ───────────────────────────────────────
export function fetchLegalDocument(type) {
  return apiFetch(`/api/legal/${type}`);
}

export function fetchLegalVersions(type) {
  return apiFetch(`/api/legal/${type}/versions`);
}

export function generateLegalDocument(type) {
  return apiFetch(`/api/legal/${type}/generate`, { method: 'POST' });
}

export function publishLegalDocument(id) {
  return apiFetch(`/api/legal/${id}/publish`, { method: 'PATCH' });
}

export function updateLegalDocument(id, content_markdown) {
  return apiFetch(`/api/legal/${id}`, { method: 'PUT', body: JSON.stringify({ content_markdown }) });
}

// ── FAQ ───────────────────────────────────────────────────
export function fetchFAQ(options = {}) {
  const params = new URLSearchParams();
  if (options.public) params.set('public', 'true');
  if (options.search) params.set('search', options.search);
  const qs = params.toString();
  return apiFetch(`/api/faq${qs ? `?${qs}` : ''}`);
}

export function regenerateFAQ() {
  return apiFetch('/api/faq/regenerate', { method: 'POST' });
}

// ── Payroll Beacon Growth OS ───────────────────────────────

export function fetchGrowthDashboard() {
  return apiFetch('/api/growth/dashboard');
}

export function fetchGrowthCalendarWeek(offset = 0) {
  return apiFetch(`/api/growth/calendar/week?offset=${offset}`);
}

export function fetchGrowthCalendarMonth({ year, month } = {}) {
  const params = new URLSearchParams();
  if (year) params.set('year', year);
  if (month) params.set('month', month);
  return apiFetch(`/api/growth/calendar/month?${params}`);
}

export function fetchGrowthCalendarSlots(offset = 0) {
  return apiFetch(`/api/growth/calendar/slots?offset=${offset}`);
}

export function fetchGrowthUnscheduled() {
  return apiFetch('/api/growth/calendar/unscheduled');
}

export function fetchGrowthCalendarWarnings(days = 14) {
  return apiFetch(`/api/growth/calendar/warnings?days=${days}`);
}

export function rescheduleGrowthContent(id, scheduledFor) {
  return apiFetch(`/api/growth/calendar/${id}/reschedule`, {
    method: 'POST', body: JSON.stringify({ scheduled_for: scheduledFor }),
  });
}

export function duplicateGrowthContent(id, scheduledFor = null) {
  return apiFetch(`/api/growth/calendar/${id}/duplicate`, {
    method: 'POST', body: JSON.stringify({ scheduled_for: scheduledFor }),
  });
}

export function unscheduleGrowthContent(id) {
  return apiFetch(`/api/growth/calendar/${id}/unschedule`, { method: 'POST' });
}

export function fetchGrowthContent(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.platform) params.set('platform', filters.platform);
  if (filters.limit) params.set('limit', filters.limit);
  return apiFetch(`/api/growth/content?${params}`);
}

export function fetchGrowthContentReview() {
  return apiFetch('/api/growth/content/review');
}

export function fetchGrowthContentDetail(id) {
  return apiFetch(`/api/growth/content/${id}`);
}

export function updateGrowthContent(id, patch) {
  return apiFetch(`/api/growth/content/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
}

export function approveGrowthContent(id, scheduledFor = null) {
  return apiFetch(`/api/growth/content/${id}/approve`, {
    method: 'POST', body: JSON.stringify({ scheduled_for: scheduledFor }),
  });
}

export function rejectGrowthContent(id, reason) {
  return apiFetch(`/api/growth/content/${id}/reject`, {
    method: 'POST', body: JSON.stringify({ reason }),
  });
}

export function markGrowthContentPosted(id, publishedUrl) {
  return apiFetch(`/api/growth/content/${id}/mark-posted`, {
    method: 'POST', body: JSON.stringify({ published_url: publishedUrl }),
  });
}

export function fetchGrowthSources(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.limit) params.set('limit', filters.limit);
  return apiFetch(`/api/growth/sources?${params}`);
}

export function createGrowthSource(data) {
  return apiFetch('/api/growth/sources', { method: 'POST', body: JSON.stringify(data) });
}

export function generateGrowthContent(sourceId, platforms) {
  return apiFetch('/api/growth/generate', {
    method: 'POST', body: JSON.stringify({ source_id: sourceId, platforms }),
  });
}

export function fetchGrowthSettings() {
  return apiFetch('/api/growth/settings');
}

export function updateGrowthSettings(key, value) {
  return apiFetch(`/api/growth/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) });
}

export function fetchGrowthCosts(days = 30) {
  return apiFetch(`/api/growth/costs?days=${days}`);
}
