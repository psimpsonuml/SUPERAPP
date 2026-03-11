'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchPets, fetchPetDetail, createPet, updatePet, deletePet,
  fetchPetHealth, addPetHealth, updatePetHealth,
  fetchPetMemories, addPetMemory,
  fetchPetWeightHistory, fetchPetUpcoming, fetchPetExpenses,
  fetchPetEmergencyCard, fetchPetExpenseSummary,
} from '../../../lib/api';

// ── Constants & Helpers ─────────────────────────────────────
const SPECIES_OPTIONS = ['dog', 'cat', 'bird', 'fish', 'reptile', 'other'];
const RECORD_TYPES = ['vaccination', 'medication', 'vet_visit', 'weight', 'grooming', 'allergy'];
const MEMORY_CATEGORIES = ['memory', 'milestone', 'funny', 'first', 'trick'];

const SPECIES_ICONS = {
  dog: '\u{1F436}', cat: '\u{1F431}', bird: '\u{1F426}', fish: '\u{1F41F}',
  reptile: '\u{1F98E}', other: '\u{1F43E}',
};

const RECORD_TYPE_LABELS = {
  vaccination: 'Vaccination', medication: 'Medication', vet_visit: 'Vet Visit',
  weight: 'Weight', grooming: 'Grooming', allergy: 'Allergy',
};

const CATEGORY_COLORS = {
  memory: '#f59e0b', milestone: '#10b981', funny: '#f472b6', first: '#60a5fa', trick: '#a78bfa',
};

function calcAge(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  if (months < 0) { years--; months += 12; }
  if (now.getDate() < b.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  return { years, months };
}

function calcHumanAge(species, birthday, weight) {
  const age = calcAge(birthday);
  if (!age) return null;
  const y = age.years + age.months / 12;
  if (species === 'cat') {
    if (y <= 1) return Math.round(15 * y);
    if (y <= 2) return Math.round(15 + 9 * (y - 1));
    return Math.round(24 + 4 * (y - 2));
  }
  if (species === 'dog') {
    const w = parseFloat(weight) || 30;
    let rate = 5;
    if (w < 10) rate = 4;
    else if (w < 25) rate = 5;
    else if (w < 45) rate = 6;
    else rate = 7;
    if (y <= 1) return Math.round(15 * y);
    if (y <= 2) return Math.round(15 + 9 * (y - 1));
    return Math.round(24 + rate * (y - 2));
  }
  return null;
}

function daysToBirthday(birthday) {
  if (!birthday) return null;
  const now = new Date();
  const b = new Date(birthday);
  const next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
  if (next < now) next.setFullYear(next.getFullYear() + 1);
  return Math.ceil((next - now) / (1000 * 60 * 60 * 24));
}

function fmt$(n) { return '$' + (parseFloat(n) || 0).toFixed(2); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString() : ''; }

// ── Styles ──────────────────────────────────────────────────
const S = {
  page: { padding: 32, maxWidth: 1280, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: '#e0e0e0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  h1: { fontSize: 28, fontWeight: 700, color: '#f59e0b', letterSpacing: '-0.5px' },
  card: { background: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #2a2a4a' },
  cardHover: { background: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #2a2a4a', cursor: 'pointer', transition: 'border-color 0.2s' },
  petGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220, 1fr))', gap: 16, marginBottom: 28 },
  btn: { background: '#f59e0b', color: '#1a1a2e', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  btnSm: { background: '#f59e0b', color: '#1a1a2e', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 12 },
  btnDanger: { background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 12 },
  btnOutline: { background: 'transparent', color: '#f59e0b', border: '1px solid #f59e0b', borderRadius: 6, padding: '6px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 12 },
  input: { background: '#16162a', border: '1px solid #2a2a4a', borderRadius: 8, padding: '10px 14px', color: '#e0e0e0', fontSize: 14, width: '100%', outline: 'none' },
  select: { background: '#16162a', border: '1px solid #2a2a4a', borderRadius: 8, padding: '10px 14px', color: '#e0e0e0', fontSize: 14, width: '100%', outline: 'none' },
  textarea: { background: '#16162a', border: '1px solid #2a2a4a', borderRadius: 8, padding: '10px 14px', color: '#e0e0e0', fontSize: 14, width: '100%', outline: 'none', minHeight: 80, resize: 'vertical' },
  label: { fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tabs: { display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #2a2a4a', paddingBottom: 8 },
  tab: (active) => ({ padding: '8px 18px', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontWeight: 600, fontSize: 13, border: 'none', background: active ? '#f59e0b' : 'transparent', color: active ? '#1a1a2e' : '#888', transition: 'all 0.2s' }),
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalInner: { background: '#1a1a2e', borderRadius: 16, padding: 28, width: '90%', maxWidth: 540, maxHeight: '85vh', overflow: 'auto', border: '1px solid #2a2a4a' },
  badge: (color) => ({ display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: color + '22', color: color, marginRight: 6 }),
  stat: { textAlign: 'center' },
  statVal: { fontSize: 24, fontWeight: 700, color: '#f59e0b' },
  statLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', marginTop: 2 },
  row: { display: 'flex', gap: 12, marginBottom: 12 },
  flex: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  muted: { color: '#666', fontSize: 13 },
  accent: { color: '#f59e0b' },
};

// ── Mini SVG Weight Chart ───────────────────────────────────
function WeightChart({ weights }) {
  if (!weights || weights.length < 2) return <div style={S.muted}>Not enough data for chart</div>;
  const vals = weights.map(w => w.weight);
  const minW = Math.min(...vals);
  const maxW = Math.max(...vals);
  const range = maxW - minW || 1;
  const W = 300, H = 120, pad = 20;
  const points = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - minW) / range) * (H - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg width={W} height={H} style={{ background: '#16162a', borderRadius: 8 }}>
      <polyline fill="none" stroke="#f59e0b" strokeWidth="2" points={points.join(' ')} />
      {vals.map((v, i) => {
        const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
        const y = H - pad - ((v - minW) / range) * (H - pad * 2);
        return <circle key={i} cx={x} cy={y} r={3} fill="#f59e0b" />;
      })}
      <text x={pad} y={H - 4} fill="#666" fontSize="10">{weights[0].date}</text>
      <text x={W - pad} y={H - 4} fill="#666" fontSize="10" textAnchor="end">{weights[weights.length - 1].date}</text>
      <text x={4} y={pad} fill="#666" fontSize="10">{maxW}lb</text>
      <text x={4} y={H - pad} fill="#666" fontSize="10">{minW}lb</text>
    </svg>
  );
}

// ── Pet Card ────────────────────────────────────────────────
function PetCard({ pet, selected, onClick }) {
  const age = calcAge(pet.birthday);
  return (
    <div
      onClick={onClick}
      style={{
        ...S.cardHover,
        border: selected ? '2px solid #f59e0b' : '1px solid #2a2a4a',
        textAlign: 'center',
        minWidth: 180,
      }}
    >
      {pet.photo_url ? (
        <img src={pet.photo_url} alt={pet.name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: 10, border: '2px solid #2a2a4a' }} />
      ) : (
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#16162a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: 36 }}>
          {SPECIES_ICONS[pet.species] || SPECIES_ICONS.other}
        </div>
      )}
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{pet.name}</div>
      <div style={{ fontSize: 12, color: '#888' }}>{pet.breed || pet.species}</div>
      {age && <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{age.years}y {age.months}m old</div>}
      {pet.weight && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>{pet.weight} lb</div>}
    </div>
  );
}

// ── Add/Edit Pet Modal ──────────────────────────────────────
function PetModal({ pet, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '', species: 'dog', breed: '', birthday: '', weight: '',
    photo_url: '', microchip: '', emergency_vet_phone: '',
    dietary_restrictions: '', vet_name: '', vet_phone: '',
    insurance_provider: '', insurance_policy: '', allergies_text: '',
    ...(pet ? {
      name: pet.name || '', species: pet.species || 'dog', breed: pet.breed || '',
      birthday: pet.birthday || '', weight: pet.weight || '', photo_url: pet.photo_url || '',
      microchip: pet.microchip || '', emergency_vet_phone: pet.emergency_vet_phone || '',
      dietary_restrictions: pet.dietary_restrictions || '',
      vet_name: pet.vet_info_json?.name || '', vet_phone: pet.vet_info_json?.phone || '',
      insurance_provider: pet.insurance_json?.provider || '',
      insurance_policy: pet.insurance_json?.policy || '',
      allergies_text: Array.isArray(pet.allergies) ? pet.allergies.join(', ') : '',
    } : {}),
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(), species: form.species, breed: form.breed,
      birthday: form.birthday || null, weight: form.weight ? parseFloat(form.weight) : null,
      photo_url: form.photo_url, microchip: form.microchip,
      emergency_vet_phone: form.emergency_vet_phone,
      dietary_restrictions: form.dietary_restrictions,
      vet_info_json: { name: form.vet_name, phone: form.vet_phone },
      insurance_json: { provider: form.insurance_provider, policy: form.insurance_policy },
      allergies: form.allergies_text ? form.allergies_text.split(',').map(s => s.trim()).filter(Boolean) : [],
    };
    await onSave(payload);
    setSaving(false);
  };

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalInner} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#f59e0b' }}>
          {pet ? 'Edit Pet' : 'Add Pet'}
        </h2>
        <div style={S.grid2}>
          <div><label style={S.label}>Name *</label><input style={S.input} value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div>
            <label style={S.label}>Species</label>
            <select style={S.select} value={form.species} onChange={e => set('species', e.target.value)}>
              {SPECIES_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div><label style={S.label}>Breed</label><input style={S.input} value={form.breed} onChange={e => set('breed', e.target.value)} /></div>
          <div><label style={S.label}>Birthday</label><input type="date" style={S.input} value={form.birthday} onChange={e => set('birthday', e.target.value)} /></div>
          <div><label style={S.label}>Weight (lb)</label><input type="number" step="0.1" style={S.input} value={form.weight} onChange={e => set('weight', e.target.value)} /></div>
          <div><label style={S.label}>Photo URL</label><input style={S.input} value={form.photo_url} onChange={e => set('photo_url', e.target.value)} /></div>
          <div><label style={S.label}>Microchip #</label><input style={S.input} value={form.microchip} onChange={e => set('microchip', e.target.value)} /></div>
          <div><label style={S.label}>Emergency Vet Phone</label><input style={S.input} value={form.emergency_vet_phone} onChange={e => set('emergency_vet_phone', e.target.value)} /></div>
          <div><label style={S.label}>Vet Name</label><input style={S.input} value={form.vet_name} onChange={e => set('vet_name', e.target.value)} /></div>
          <div><label style={S.label}>Vet Phone</label><input style={S.input} value={form.vet_phone} onChange={e => set('vet_phone', e.target.value)} /></div>
          <div><label style={S.label}>Insurance Provider</label><input style={S.input} value={form.insurance_provider} onChange={e => set('insurance_provider', e.target.value)} /></div>
          <div><label style={S.label}>Insurance Policy #</label><input style={S.input} value={form.insurance_policy} onChange={e => set('insurance_policy', e.target.value)} /></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={S.label}>Allergies (comma-separated)</label>
          <input style={S.input} value={form.allergies_text} onChange={e => set('allergies_text', e.target.value)} placeholder="e.g. chicken, pollen" />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={S.label}>Dietary Restrictions</label>
          <input style={S.input} value={form.dietary_restrictions} onChange={e => set('dietary_restrictions', e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
          <button style={S.btnOutline} onClick={onClose}>Cancel</button>
          <button style={S.btn} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Health Record Modal ─────────────────────────────────────
function HealthRecordModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    record_type: 'vaccination', date: new Date().toISOString().split('T')[0],
    description: '', cost: '', next_due: '', metadata: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      record_type: form.record_type, date: form.date,
      description: form.description, cost: form.cost ? parseFloat(form.cost) : null,
      next_due: form.next_due || null,
      metadata_json: form.metadata ? (() => { try { return JSON.parse(form.metadata); } catch { return {}; } })() : {},
    };
    await onSave(payload);
    setSaving(false);
  };

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalInner} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#f59e0b' }}>Add Health Record</h2>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Type</label>
            <select style={S.select} value={form.record_type} onChange={e => set('record_type', e.target.value)}>
              {RECORD_TYPES.map(t => <option key={t} value={t}>{RECORD_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div><label style={S.label}>Date</label><input type="date" style={S.input} value={form.date} onChange={e => set('date', e.target.value)} /></div>
          <div><label style={S.label}>Cost ($)</label><input type="number" step="0.01" style={S.input} value={form.cost} onChange={e => set('cost', e.target.value)} /></div>
          <div><label style={S.label}>Next Due</label><input type="date" style={S.input} value={form.next_due} onChange={e => set('next_due', e.target.value)} /></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={S.label}>Description</label>
          <textarea style={S.textarea} value={form.description} onChange={e => set('description', e.target.value)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={S.label}>Metadata (JSON, optional)</label>
          <input style={S.input} value={form.metadata} onChange={e => set('metadata', e.target.value)} placeholder='{"weight": 25.5}' />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
          <button style={S.btnOutline} onClick={onClose}>Cancel</button>
          <button style={S.btn} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Memory Modal ────────────────────────────────────────────
function MemoryModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    entry_text: '', photo_url: '', entry_date: new Date().toISOString().split('T')[0], category: 'memory',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalInner} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#f59e0b' }}>Add Memory</h2>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Category</label>
            <select style={S.select} value={form.category} onChange={e => set('category', e.target.value)}>
              {MEMORY_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div><label style={S.label}>Date</label><input type="date" style={S.input} value={form.entry_date} onChange={e => set('entry_date', e.target.value)} /></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={S.label}>What happened?</label>
          <textarea style={S.textarea} value={form.entry_text} onChange={e => set('entry_text', e.target.value)} placeholder="Write your memory..." />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={S.label}>Photo URL</label>
          <input style={S.input} value={form.photo_url} onChange={e => set('photo_url', e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
          <button style={S.btnOutline} onClick={onClose}>Cancel</button>
          <button style={S.btn} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Overview Tab ────────────────────────────────────────────
function OverviewTab({ pet, detail, weights, upcoming }) {
  const age = calcAge(pet.birthday);
  const humanAge = calcHumanAge(pet.species, pet.birthday, pet.weight);
  const bday = daysToBirthday(pet.birthday);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Pet Info Card */}
      <div style={{ ...S.card, display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {pet.photo_url ? (
          <img src={pet.photo_url} alt={pet.name} style={{ width: 120, height: 120, borderRadius: 12, objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 120, height: 120, borderRadius: 12, background: '#16162a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56 }}>
            {SPECIES_ICONS[pet.species] || SPECIES_ICONS.other}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{pet.name}</h2>
          <div style={S.flex}>
            <span style={S.badge('#f59e0b')}>{pet.species}</span>
            {pet.breed && <span style={S.badge('#60a5fa')}>{pet.breed}</span>}
          </div>
          <div style={{ ...S.grid2, marginTop: 16, maxWidth: 400 }}>
            {age && (
              <div style={S.stat}><div style={S.statVal}>{age.years}y {age.months}m</div><div style={S.statLabel}>Age</div></div>
            )}
            {humanAge !== null && (
              <div style={S.stat}><div style={S.statVal}>{humanAge}</div><div style={S.statLabel}>Human Years</div></div>
            )}
            {pet.weight && (
              <div style={S.stat}><div style={S.statVal}>{pet.weight}</div><div style={S.statLabel}>Weight (lb)</div></div>
            )}
            {bday !== null && (
              <div style={S.stat}><div style={{ ...S.statVal, color: bday <= 30 ? '#10b981' : '#f59e0b' }}>{bday}</div><div style={S.statLabel}>Days to Birthday</div></div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <div style={{ ...S.card, ...S.stat }}><div style={S.statVal}>{detail?.recent_health?.length || 0}</div><div style={S.statLabel}>Health Records</div></div>
        <div style={{ ...S.card, ...S.stat }}><div style={S.statVal}>{detail?.recent_memories?.length || 0}</div><div style={S.statLabel}>Memories</div></div>
        <div style={{ ...S.card, ...S.stat }}><div style={S.statVal}>{upcoming?.overdue?.length || 0}</div><div style={{ ...S.statLabel, color: (upcoming?.overdue?.length || 0) > 0 ? '#ef4444' : '#888' }}>Overdue</div></div>
        <div style={{ ...S.card, ...S.stat }}><div style={S.statVal}>{upcoming?.upcoming?.length || 0}</div><div style={S.statLabel}>Upcoming</div></div>
      </div>

      {/* Health Alerts */}
      {((upcoming?.overdue?.length || 0) > 0 || (upcoming?.upcoming?.slice(0, 5)?.length || 0) > 0) && (
        <div style={S.card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#f59e0b' }}>Health Alerts & Reminders</h3>
          {(upcoming?.overdue || []).map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2a2a4a' }}>
              <div>
                <span style={S.badge('#ef4444')}>OVERDUE</span>
                <span style={S.badge('#f59e0b')}>{RECORD_TYPE_LABELS[r.record_type]}</span>
                <span style={{ fontSize: 13 }}>{r.description}</span>
              </div>
              <span style={{ fontSize: 12, color: '#ef4444' }}>Due {fmtDate(r.next_due)}</span>
            </div>
          ))}
          {(upcoming?.upcoming || []).slice(0, 5).map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2a2a4a' }}>
              <div>
                <span style={S.badge('#60a5fa')}>{RECORD_TYPE_LABELS[r.record_type]}</span>
                <span style={{ fontSize: 13 }}>{r.description}</span>
              </div>
              <span style={{ fontSize: 12, color: '#888' }}>Due {fmtDate(r.next_due)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Weight Trend */}
      <div style={S.card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#f59e0b' }}>Weight Trend</h3>
        <WeightChart weights={weights?.weights || []} />
      </div>
    </div>
  );
}

// ── Health Records Tab ──────────────────────────────────────
function HealthTab({ petId, health, onRefresh }) {
  const [filter, setFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const filtered = filter ? (health || []).filter(r => r.record_type === filter) : (health || []);

  const handleAdd = async (payload) => {
    await addPetHealth(petId, payload);
    setShowAdd(false);
    onRefresh();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={S.flex}>
          <button style={S.tab(!filter)} onClick={() => setFilter('')}>All</button>
          {RECORD_TYPES.map(t => (
            <button key={t} style={S.tab(filter === t)} onClick={() => setFilter(t)}>{RECORD_TYPE_LABELS[t]}</button>
          ))}
        </div>
        <button style={S.btnSm} onClick={() => setShowAdd(true)}>+ Record</button>
      </div>

      {filtered.length === 0 && <div style={{ ...S.card, ...S.muted, textAlign: 'center', padding: 40 }}>No health records yet</div>}

      {filtered.map(r => (
        <div key={r.id} style={{ ...S.card, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={S.badge('#f59e0b')}>{RECORD_TYPE_LABELS[r.record_type]}</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{r.description || 'No description'}</span>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{fmtDate(r.date)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {r.cost && <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>{fmt$(r.cost)}</div>}
            {r.next_due && (
              <div style={{ fontSize: 11, color: new Date(r.next_due) < new Date() ? '#ef4444' : '#10b981', marginTop: 4 }}>
                Next: {fmtDate(r.next_due)}
              </div>
            )}
          </div>
        </div>
      ))}

      {showAdd && <HealthRecordModal onClose={() => setShowAdd(false)} onSave={handleAdd} />}
    </div>
  );
}

// ── Memories Tab ────────────────────────────────────────────
function MemoriesTab({ petId, memories, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);

  const handleAdd = async (payload) => {
    await addPetMemory(petId, payload);
    setShowAdd(false);
    onRefresh();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button style={S.btnSm} onClick={() => setShowAdd(true)}>+ Memory</button>
      </div>

      {(!memories || memories.length === 0) && <div style={{ ...S.card, ...S.muted, textAlign: 'center', padding: 40 }}>No memories yet. Start capturing moments!</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(memories || []).map(m => (
          <div key={m.id} style={{ ...S.card, display: 'flex', gap: 16 }}>
            {m.photo_url && (
              <img src={m.photo_url} alt="" style={{ width: 100, height: 100, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span style={S.badge(CATEGORY_COLORS[m.category] || '#f59e0b')}>{m.category}</span>
                <span style={{ fontSize: 12, color: '#666' }}>{fmtDate(m.entry_date)}</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0, color: '#ccc' }}>{m.entry_text}</p>
            </div>
          </div>
        ))}
      </div>

      {showAdd && <MemoryModal onClose={() => setShowAdd(false)} onSave={handleAdd} />}
    </div>
  );
}

// ── Expenses Tab ────────────────────────────────────────────
function ExpensesTab({ expenses, allExpenses, pets }) {
  const byType = expenses?.by_type || {};
  const byMonth = expenses?.by_month || {};
  const months = Object.keys(byMonth).sort().slice(-12);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Total */}
      <div style={{ ...S.card, ...S.stat }}>
        <div style={{ ...S.statVal, fontSize: 36 }}>{fmt$(expenses?.total || 0)}</div>
        <div style={S.statLabel}>Total Expenses</div>
      </div>

      {/* By Type */}
      <div style={S.card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#f59e0b' }}>By Category</h3>
        {Object.keys(byType).length === 0 && <div style={S.muted}>No expense data</div>}
        {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, amount]) => (
          <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2a2a4a' }}>
            <span style={S.badge('#f59e0b')}>{RECORD_TYPE_LABELS[type] || type}</span>
            <span style={{ fontWeight: 700, color: '#f59e0b' }}>{fmt$(amount)}</span>
          </div>
        ))}
      </div>

      {/* Monthly */}
      {months.length > 0 && (
        <div style={S.card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#f59e0b' }}>Monthly Totals</h3>
          {months.map(m => (
            <div key={m} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #2a2a4a' }}>
              <span style={{ fontSize: 13 }}>{m}</span>
              <span style={{ fontWeight: 600, color: '#f59e0b' }}>{fmt$(byMonth[m])}</span>
            </div>
          ))}
        </div>
      )}

      {/* Multi-pet comparison */}
      {allExpenses && Object.keys(allExpenses.by_pet || {}).length > 1 && (
        <div style={S.card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#f59e0b' }}>Cost Per Pet</h3>
          {Object.entries(allExpenses.by_pet).sort((a, b) => b[1] - a[1]).map(([name, amount]) => {
            const pct = allExpenses.grand_total ? ((amount / allExpenses.grand_total) * 100).toFixed(0) : 0;
            return (
              <div key={name} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{name}</span>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>{fmt$(amount)} ({pct}%)</span>
                </div>
                <div style={{ background: '#16162a', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, background: '#f59e0b', height: '100%', borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Emergency Tab ───────────────────────────────────────────
function EmergencyTab({ card }) {
  const handleExport = () => {
    if (!card) return;
    const text = [
      `EMERGENCY PET CARD`,
      `==================`,
      `Name: ${card.name}`,
      `Species: ${card.species}`,
      `Breed: ${card.breed}`,
      `Weight: ${card.weight || 'N/A'} lb`,
      `Birthday: ${card.birthday || 'N/A'}`,
      `Microchip: ${card.microchip || 'N/A'}`,
      ``,
      `ALLERGIES: ${(card.allergies || []).join(', ') || 'None'}`,
      `Dietary Restrictions: ${card.dietary_restrictions || 'None'}`,
      ``,
      `VET: ${card.vet_info?.name || 'N/A'} - ${card.vet_info?.phone || 'N/A'}`,
      `Emergency Vet: ${card.emergency_vet_phone || 'N/A'}`,
      ``,
      `INSURANCE: ${card.insurance?.provider || 'N/A'} - Policy: ${card.insurance?.policy || 'N/A'}`,
      ``,
      `CURRENT MEDICATIONS:`,
      ...(card.current_medications || []).map(m => `  - ${m.description} (next: ${m.next_due || 'N/A'})`),
    ].join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
    alert('Emergency card copied to clipboard!');
  };

  if (!card) return <div style={S.muted}>Loading emergency card...</div>;

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ ...S.card, border: '2px solid #ef4444', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <button style={S.btnSm} onClick={handleExport}>Copy / Share</button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Emergency Pet Card</div>
          {card.photo_url ? (
            <img src={card.photo_url} alt={card.name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid #ef4444' }} />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#16162a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
              {SPECIES_ICONS[card.species] || SPECIES_ICONS.other}
            </div>
          )}
          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>{card.name}</h2>
          <div style={{ fontSize: 13, color: '#888' }}>{card.breed} {card.species}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div><div style={S.label}>Weight</div><div style={{ fontSize: 16, fontWeight: 600 }}>{card.weight || 'N/A'} lb</div></div>
          <div><div style={S.label}>Microchip</div><div style={{ fontSize: 14, fontWeight: 600 }}>{card.microchip || 'N/A'}</div></div>
        </div>

        {(card.allergies || []).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...S.label, color: '#ef4444' }}>Allergies</div>
            <div style={S.flex}>{card.allergies.map(a => <span key={a} style={S.badge('#ef4444')}>{a}</span>)}</div>
          </div>
        )}

        {card.dietary_restrictions && (
          <div style={{ marginBottom: 16 }}>
            <div style={S.label}>Dietary Restrictions</div>
            <div style={{ fontSize: 14 }}>{card.dietary_restrictions}</div>
          </div>
        )}

        <div style={{ marginBottom: 16, padding: 12, background: '#16162a', borderRadius: 8 }}>
          <div style={S.label}>Veterinarian</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{card.vet_info?.name || 'N/A'}</div>
          <div style={{ fontSize: 14, color: '#f59e0b' }}>{card.vet_info?.phone || 'N/A'}</div>
        </div>

        {card.emergency_vet_phone && (
          <div style={{ marginBottom: 16, padding: 12, background: '#2a1a1a', borderRadius: 8, border: '1px solid #ef4444' }}>
            <div style={{ ...S.label, color: '#ef4444' }}>Emergency Vet</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>{card.emergency_vet_phone}</div>
          </div>
        )}

        {(card.current_medications || []).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={S.label}>Current Medications</div>
            {card.current_medications.map((m, i) => (
              <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #2a2a4a', fontSize: 13 }}>
                {m.description}{m.next_due && <span style={{ color: '#888' }}> (next: {fmtDate(m.next_due)})</span>}
              </div>
            ))}
          </div>
        )}

        {card.insurance?.provider && (
          <div>
            <div style={S.label}>Insurance</div>
            <div style={{ fontSize: 14 }}>{card.insurance.provider} - {card.insurance.policy || 'N/A'}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function PetsPage() {
  const [pets, setPets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [showAddPet, setShowAddPet] = useState(false);
  const [editPet, setEditPet] = useState(null);

  // Per-pet data
  const [detail, setDetail] = useState(null);
  const [health, setHealth] = useState([]);
  const [memories, setMemories] = useState([]);
  const [weights, setWeights] = useState(null);
  const [upcoming, setUpcoming] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [emergencyCard, setEmergencyCard] = useState(null);
  const [allExpenses, setAllExpenses] = useState(null);

  const selectedPet = pets.find(p => p.id === selectedId) || null;

  const loadPets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPets();
      const list = res.pets || [];
      setPets(list);
      if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
    } catch (e) { console.error('Failed to load pets:', e); }
    setLoading(false);
  }, []);

  const loadPetData = useCallback(async (id) => {
    if (!id) return;
    try {
      const [det, h, m, w, u, e, ec] = await Promise.all([
        fetchPetDetail(id).catch(() => null),
        fetchPetHealth(id).catch(() => ({ records: [] })),
        fetchPetMemories(id).catch(() => ({ memories: [] })),
        fetchPetWeightHistory(id).catch(() => null),
        fetchPetUpcoming(id).catch(() => null),
        fetchPetExpenses(id).catch(() => null),
        fetchPetEmergencyCard(id).catch(() => null),
      ]);
      setDetail(det);
      setHealth(h?.records || []);
      setMemories(m?.memories || []);
      setWeights(w);
      setUpcoming(u);
      setExpenses(e);
      setEmergencyCard(ec);
    } catch (e) { console.error('Failed to load pet data:', e); }
  }, []);

  const loadAllExpenses = useCallback(async () => {
    try {
      const res = await fetchPetExpenseSummary();
      setAllExpenses(res);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadPets(); }, [loadPets]);

  useEffect(() => {
    if (selectedId) {
      loadPetData(selectedId);
    }
  }, [selectedId, loadPetData]);

  useEffect(() => {
    if (pets.length > 1) loadAllExpenses();
  }, [pets, loadAllExpenses]);

  const handleAddPet = async (payload) => {
    await createPet(payload);
    setShowAddPet(false);
    loadPets();
  };

  const handleEditPet = async (payload) => {
    if (!editPet) return;
    await updatePet(editPet.id, payload);
    setEditPet(null);
    loadPets();
    loadPetData(editPet.id);
  };

  const handleDeletePet = async (id) => {
    if (!confirm('Are you sure you want to remove this pet? This cannot be undone.')) return;
    await deletePet(id);
    setSelectedId(null);
    loadPets();
  };

  const refreshPetData = () => {
    if (selectedId) loadPetData(selectedId);
  };

  const TABS = ['overview', 'health', 'memories', 'expenses', 'emergency'];

  if (loading) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{SPECIES_ICONS.dog}</div>
          <div>Loading pets...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.h1}>{SPECIES_ICONS.other} Pets</h1>
        <button style={S.btn} onClick={() => setShowAddPet(true)}>+ Add Pet</button>
      </div>

      {/* Pet Cards Row */}
      {pets.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: 60, marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{SPECIES_ICONS.dog}</div>
          <div style={{ fontSize: 16, color: '#888', marginBottom: 16 }}>No pets added yet</div>
          <button style={S.btn} onClick={() => setShowAddPet(true)}>Add Your First Pet</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8, marginBottom: 28 }}>
          {pets.map(p => (
            <PetCard key={p.id} pet={p} selected={p.id === selectedId} onClick={() => { setSelectedId(p.id); setTab('overview'); }} />
          ))}
        </div>
      )}

      {/* Selected Pet Tabs & Content */}
      {selectedPet && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={S.tabs}>
              {TABS.map(t => (
                <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={S.btnOutline} onClick={() => setEditPet(selectedPet)}>Edit</button>
              <button style={S.btnDanger} onClick={() => handleDeletePet(selectedPet.id)}>Delete</button>
            </div>
          </div>

          {tab === 'overview' && (
            <OverviewTab pet={selectedPet} detail={detail} weights={weights} upcoming={upcoming} />
          )}
          {tab === 'health' && (
            <HealthTab petId={selectedPet.id} health={health} onRefresh={refreshPetData} />
          )}
          {tab === 'memories' && (
            <MemoriesTab petId={selectedPet.id} memories={memories} onRefresh={refreshPetData} />
          )}
          {tab === 'expenses' && (
            <ExpensesTab expenses={expenses} allExpenses={allExpenses} pets={pets} />
          )}
          {tab === 'emergency' && (
            <EmergencyTab card={emergencyCard} />
          )}
        </>
      )}

      {/* Modals */}
      {showAddPet && <PetModal onClose={() => setShowAddPet(false)} onSave={handleAddPet} />}
      {editPet && <PetModal pet={editPet} onClose={() => setEditPet(null)} onSave={handleEditPet} />}
    </div>
  );
}
