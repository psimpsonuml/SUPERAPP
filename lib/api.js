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

export function fetchPipeline(track = 'user') {
  return apiFetch(`/api/reports/pipeline?track=${encodeURIComponent(track)}`);
}

export function fetchProductIntelligence(product) {
  const qs = product ? `?product=${encodeURIComponent(product)}` : '';
  return apiFetch(`/api/reports/product-intelligence${qs}`);
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

export function fetchNewsFeed() {
  return apiFetch('/api/personal/news');
}

export function fetchReleases() {
  return apiFetch('/api/personal/releases');
}

export function fetchMusic() {
  return apiFetch('/api/personal/music');
}

export function fetchFinanceSnapshot() {
  return apiFetch('/api/personal/finance');
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
