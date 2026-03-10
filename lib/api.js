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

export function fetchBooks() {
  return apiFetch('/api/personal/books');
}

export function rateBook(data) {
  return apiFetch('/api/personal/books/rate', { method: 'POST', body: JSON.stringify(data) });
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

export function fetchMusic() {
  return apiFetch('/api/personal/music');
}

// ── Music Discovery ──────────────────────────────────────
export function fetchMusicConnection() {
  return apiFetch('/api/music/connection');
}

export function fetchMusicAuthUrl() {
  return apiFetch('/api/music/auth-url');
}

export function disconnectSpotify() {
  return apiFetch('/api/music/disconnect', { method: 'POST' });
}

export function fetchMusicBrowse({ feed = 'new_releases', genre } = {}) {
  const params = new URLSearchParams({ feed });
  if (genre) params.set('genre', genre);
  return apiFetch(`/api/music/browse?${params}`);
}

export function searchMusic(q, type = 'track,album') {
  return apiFetch(`/api/music/search?q=${encodeURIComponent(q)}&type=${type}`);
}

export function fetchMusicCredits(spotifyId, type = 'track') {
  return apiFetch(`/api/music/credits/${encodeURIComponent(spotifyId)}?type=${type}`);
}

export function fetchMusicGenres() {
  return apiFetch('/api/music/genres');
}

export function rateMusic(data) {
  return apiFetch('/api/music/rate', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchMusicRatedIds() {
  return apiFetch('/api/music/rated-ids');
}

export function fetchMusicRatings({ sort, genre } = {}) {
  const params = new URLSearchParams();
  if (sort) params.set('sort', sort);
  if (genre) params.set('genre', genre);
  const qs = params.toString();
  return apiFetch(`/api/music/ratings${qs ? `?${qs}` : ''}`);
}

export function fetchMusicArtists(role) {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  const qs = params.toString();
  return apiFetch(`/api/music/artists${qs ? `?${qs}` : ''}`);
}

export function fetchMusicArtistDetail(name) {
  return apiFetch(`/api/music/artists/${encodeURIComponent(name)}`);
}

export function fetchListeningStats() {
  return apiFetch('/api/music/listening-stats');
}

export function fetchFinanceSnapshot() {
  return apiFetch('/api/personal/finance');
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
export function fetchBuilderIntel(days = 1) {
  return apiFetch(`/api/reports/builder-intel?days=${days}`);
}

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
export function tmdbDiscover({ feed = 'popular', page = 1, genre, media_type = 'movie' } = {}) {
  const params = new URLSearchParams({ feed, page, media_type });
  if (genre) params.set('genre', genre);
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

// ── Books ─────────────────────────────────────────────────
export function fetchBookDiscover({ feed = 'trending', subject, page = 1 } = {}) {
  const params = new URLSearchParams({ feed, page });
  if (subject) params.set('subject', subject);
  return apiFetch(`/api/books/discover?${params}`);
}

export function searchBooks(q, page = 1) {
  return apiFetch(`/api/books/search?q=${encodeURIComponent(q)}&page=${page}`);
}

export function fetchBookDetail(workId) {
  return apiFetch(`/api/books/detail/${encodeURIComponent(workId)}`);
}

export function fetchBookSubjects() {
  return apiFetch('/api/books/subjects');
}

export function rateBookNew(data) {
  return apiFetch('/api/books/rate', { method: 'POST', body: JSON.stringify(data) });
}

export function fetchBookLibrary({ status, sort, genre } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (sort) params.set('sort', sort);
  if (genre) params.set('genre', genre);
  const qs = params.toString();
  return apiFetch(`/api/books/library${qs ? `?${qs}` : ''}`);
}

export function fetchBookRatedIds() {
  return apiFetch('/api/books/rated-ids');
}

export function fetchBookAuthors() {
  return apiFetch('/api/books/authors');
}

export function fetchBookAuthorDetail(name) {
  return apiFetch(`/api/books/authors/${encodeURIComponent(name)}`);
}
