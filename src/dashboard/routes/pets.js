const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// ── GET / — list all pets with summary stats ────────────────
router.get('/', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data: pets, error } = await safeQuery(sb =>
      sb.from('pets').select('*').eq('account_id', accountId).order('name')
    );
    if (error) return res.status(500).json({ error: error.message });

    const enriched = [];
    for (const pet of pets) {
      const { data: healthCount } = await safeQuery(sb =>
        sb.from('pet_health_records').select('id', { count: 'exact', head: true }).eq('pet_id', pet.id)
      );
      const { data: memoryCount } = await safeQuery(sb =>
        sb.from('pet_memories').select('id', { count: 'exact', head: true }).eq('pet_id', pet.id)
      );
      const { data: expenses } = await safeQuery(sb =>
        sb.from('pet_health_records').select('cost').eq('pet_id', pet.id).not('cost', 'is', null)
      );
      const totalExpenses = (expenses || []).reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
      enriched.push({
        ...pet,
        health_record_count: Array.isArray(healthCount) ? healthCount.length : 0,
        memory_count: Array.isArray(memoryCount) ? memoryCount.length : 0,
        total_expenses: totalExpenses,
      });
    }

    res.json({ pets: enriched });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /expenses/summary — total expenses across all pets ──
router.get('/expenses/summary', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('pet_health_records').select('pet_id, cost, record_type, date')
        .eq('account_id', accountId).not('cost', 'is', null)
    );
    if (error) return res.status(500).json({ error: error.message });

    const { data: pets } = await safeQuery(sb =>
      sb.from('pets').select('id, name').eq('account_id', accountId)
    );
    const petMap = {};
    (pets || []).forEach(p => { petMap[p.id] = p.name; });

    let grandTotal = 0;
    const byPet = {};
    const byType = {};
    const byMonth = {};

    (data || []).forEach(r => {
      const cost = parseFloat(r.cost) || 0;
      grandTotal += cost;
      const petName = petMap[r.pet_id] || 'Unknown';
      byPet[petName] = (byPet[petName] || 0) + cost;
      byType[r.record_type] = (byType[r.record_type] || 0) + cost;
      if (r.date) {
        const month = r.date.slice(0, 7);
        byMonth[month] = (byMonth[month] || 0) + cost;
      }
    });

    res.json({ grand_total: grandTotal, by_pet: byPet, by_type: byType, by_month: byMonth });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /:id — pet profile with recent health records and memories ──
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: pet, error } = await safeQuery(sb =>
      sb.from('pets').select('*').eq('id', id).single()
    );
    if (error) return res.status(404).json({ error: 'Pet not found' });

    const { data: recentHealth } = await safeQuery(sb =>
      sb.from('pet_health_records').select('*').eq('pet_id', id)
        .order('date', { ascending: false }).limit(10)
    );

    const { data: recentMemories } = await safeQuery(sb =>
      sb.from('pet_memories').select('*').eq('pet_id', id)
        .order('entry_date', { ascending: false }).limit(10)
    );

    res.json({ pet, recent_health: recentHealth || [], recent_memories: recentMemories || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST / — add pet ────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { account_id, name, species, breed, birthday, weight, photo_url,
            vet_info_json, microchip, insurance_json, emergency_vet_phone,
            allergies, dietary_restrictions } = req.body;
    if (!account_id || !name) return res.status(400).json({ error: 'account_id and name required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('pets').insert({
        account_id, name, species: species || 'dog', breed: breed || '',
        birthday: birthday || null, weight: weight || null,
        photo_url: photo_url || '', vet_info_json: vet_info_json || {},
        microchip: microchip || '', insurance_json: insurance_json || {},
        emergency_vet_phone: emergency_vet_phone || '',
        allergies: allergies || [], dietary_restrictions: dietary_restrictions || '',
      }).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json({ pet: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /:id — update pet profile ───────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.id;
    delete updates.account_id;
    delete updates.created_at;

    const { data, error } = await safeQuery(sb =>
      sb.from('pets').update(updates).eq('id', id).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json({ pet: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE /:id — remove pet ────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await safeQuery(sb =>
      sb.from('pets').delete().eq('id', id)
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /:id/health — health records for a pet ─────────────
router.get('/:id/health', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    let query = getSupabase().from('pet_health_records').select('*').eq('pet_id', id);
    if (type) query = query.eq('record_type', type);
    query = query.order('date', { ascending: false });

    const { data, error } = await safeQuery(() => query);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ records: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /:id/health — add health record ────────────────────
router.post('/:id/health', async (req, res) => {
  try {
    const { id } = req.params;
    const { account_id, record_type, date, description, cost, next_due, metadata_json } = req.body;
    if (!account_id || !record_type) return res.status(400).json({ error: 'account_id and record_type required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('pet_health_records').insert({
        account_id, pet_id: id, record_type,
        date: date || new Date().toISOString().split('T')[0],
        description: description || '', cost: cost || null,
        next_due: next_due || null, metadata_json: metadata_json || {},
      }).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json({ record: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /health/:recordId — update health record ────────────
router.put('/health/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const updates = { ...req.body };
    delete updates.id;
    delete updates.account_id;
    delete updates.pet_id;
    delete updates.created_at;

    const { data, error } = await safeQuery(sb =>
      sb.from('pet_health_records').update(updates).eq('id', recordId).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json({ record: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /:id/memories — memories for a pet ──────────────────
router.get('/:id/memories', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await safeQuery(sb =>
      sb.from('pet_memories').select('*').eq('pet_id', id)
        .order('entry_date', { ascending: false })
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json({ memories: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /:id/memories — add memory ─────────────────────────
router.post('/:id/memories', async (req, res) => {
  try {
    const { id } = req.params;
    const { account_id, entry_text, photo_url, entry_date, category } = req.body;
    if (!account_id) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('pet_memories').insert({
        account_id, pet_id: id,
        entry_text: entry_text || '', photo_url: photo_url || '',
        entry_date: entry_date || new Date().toISOString().split('T')[0],
        category: category || 'memory',
      }).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json({ memory: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /:id/weight-history — weight tracking data ──────────
router.get('/:id/weight-history', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await safeQuery(sb =>
      sb.from('pet_health_records').select('date, metadata_json, description')
        .eq('pet_id', id).eq('record_type', 'weight')
        .order('date', { ascending: true })
    );
    if (error) return res.status(500).json({ error: error.message });

    const weights = (data || []).map(r => ({
      date: r.date,
      weight: r.metadata_json?.weight || parseFloat(r.description) || null,
    })).filter(w => w.weight !== null);

    // Also include current pet weight as the baseline
    const { data: pet } = await safeQuery(sb =>
      sb.from('pets').select('weight, birthday').eq('id', id).single()
    );

    res.json({ weights, current_weight: pet?.weight || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /:id/upcoming — upcoming reminders ──────────────────
router.get('/:id/upcoming', async (req, res) => {
  try {
    const { id } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await safeQuery(sb =>
      sb.from('pet_health_records').select('*')
        .eq('pet_id', id).not('next_due', 'is', null)
        .gte('next_due', today)
        .order('next_due', { ascending: true })
        .limit(20)
    );
    if (error) return res.status(500).json({ error: error.message });

    // Also get overdue items
    const { data: overdue } = await safeQuery(sb =>
      sb.from('pet_health_records').select('*')
        .eq('pet_id', id).not('next_due', 'is', null)
        .lt('next_due', today)
        .order('next_due', { ascending: false })
        .limit(10)
    );

    res.json({ upcoming: data || [], overdue: overdue || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /:id/expenses — expense summary for a pet ───────────
router.get('/:id/expenses', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await safeQuery(sb =>
      sb.from('pet_health_records').select('cost, record_type, date')
        .eq('pet_id', id).not('cost', 'is', null)
    );
    if (error) return res.status(500).json({ error: error.message });

    let total = 0;
    const byType = {};
    const byMonth = {};
    const byYear = {};

    (data || []).forEach(r => {
      const cost = parseFloat(r.cost) || 0;
      total += cost;
      byType[r.record_type] = (byType[r.record_type] || 0) + cost;
      if (r.date) {
        const month = r.date.slice(0, 7);
        const year = r.date.slice(0, 4);
        byMonth[month] = (byMonth[month] || 0) + cost;
        byYear[year] = (byYear[year] || 0) + cost;
      }
    });

    res.json({ total, by_type: byType, by_month: byMonth, by_year: byYear });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /:id/emergency-card — emergency info card data ──────
router.get('/:id/emergency-card', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: pet, error } = await safeQuery(sb =>
      sb.from('pets').select('*').eq('id', id).single()
    );
    if (error) return res.status(404).json({ error: 'Pet not found' });

    // Get current medications
    const { data: meds } = await safeQuery(sb =>
      sb.from('pet_health_records').select('description, metadata_json, next_due')
        .eq('pet_id', id).eq('record_type', 'medication')
        .order('date', { ascending: false }).limit(10)
    );

    res.json({
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      weight: pet.weight,
      birthday: pet.birthday,
      allergies: pet.allergies || [],
      microchip: pet.microchip,
      vet_info: pet.vet_info_json || {},
      emergency_vet_phone: pet.emergency_vet_phone,
      insurance: pet.insurance_json || {},
      dietary_restrictions: pet.dietary_restrictions,
      current_medications: (meds || []).map(m => ({
        description: m.description,
        details: m.metadata_json,
        next_due: m.next_due,
      })),
      photo_url: pet.photo_url,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
