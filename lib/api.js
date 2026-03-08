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
