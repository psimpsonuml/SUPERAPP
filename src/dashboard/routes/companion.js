const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: null, error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: null, error: err }; }
}

// ── Settings ─────────────────────────────────────────────

// GET /settings — get companion settings
router.get('/settings', async (req, res) => {
  try {
    const { data, error } = await safeQuery(sb =>
      sb.from('companion_settings').select('*').eq('account_id', req.accountId).single()
    );
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    res.json({ settings: data || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /settings — create or update companion settings
router.put('/settings', async (req, res) => {
  try {
    const { mode, companion_name, personality_intensity, checkin_frequency, checkin_time, gender_preference } = req.body;

    const validModes = ['coach', 'buddy', 'mentor', 'romantic', 'cheerleader'];
    if (mode && !validModes.includes(mode)) {
      return res.status(400).json({ error: `Mode must be one of: ${validModes.join(', ')}` });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('companion_settings')
      .upsert({
        account_id: req.accountId,
        mode: mode || 'coach',
        companion_name: companion_name || 'Beacon',
        personality_intensity: personality_intensity || 'moderate',
        checkin_frequency: checkin_frequency || 'daily',
        checkin_time: checkin_time || '08:00',
        gender_preference: gender_preference || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ settings: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Conversations ────────────────────────────────────────

// GET /conversations — list conversations
router.get('/conversations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const { data, error } = await safeQuery(sb =>
      sb.from('companion_conversations')
        .select('id, context_summary, model_used, created_at')
        .eq('account_id', req.accountId)
        .order('created_at', { ascending: false })
        .limit(limit)
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ conversations: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /conversations/:id — get full conversation
router.get('/conversations/:id', async (req, res) => {
  try {
    const { data, error } = await safeQuery(sb =>
      sb.from('companion_conversations')
        .select('*')
        .eq('id', req.params.id)
        .eq('account_id', req.accountId)
        .single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ conversation: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /conversations — start new conversation
router.post('/conversations', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('companion_conversations')
      .insert({
        account_id: req.accountId,
        messages_json: [],
        context_summary: null,
        model_used: 'grok-4.1-fast',
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ conversation: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /conversations/:id/message — send message to companion
router.post('/conversations/:id/message', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

    const supabase = getSupabase();

    // Get current conversation
    const { data: convo, error: fetchErr } = await supabase
      .from('companion_conversations')
      .select('*')
      .eq('id', req.params.id)
      .eq('account_id', req.accountId)
      .single();

    if (fetchErr || !convo) return res.status(404).json({ error: 'Conversation not found' });

    // Get companion settings for personality
    const { data: settings } = await safeQuery(sb =>
      sb.from('companion_settings').select('*').eq('account_id', req.accountId).single()
    );

    const mode = settings?.mode || 'coach';
    const name = settings?.companion_name || 'Beacon';

    // Add user message
    const messages = convo.messages_json || [];
    messages.push({ role: 'user', content: message.trim(), timestamp: new Date().toISOString() });

    // Generate companion response (placeholder — would call Grok in production)
    const response = generateCompanionResponse(mode, name, message.trim(), messages);
    messages.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });

    // Update conversation
    const { data: updated, error: updateErr } = await supabase
      .from('companion_conversations')
      .update({
        messages_json: messages,
        context_summary: `${messages.length} messages, last: ${message.trim().substring(0, 50)}`,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateErr) return res.status(500).json({ error: updateErr.message });

    res.json({
      response: { role: 'assistant', content: response, timestamp: new Date().toISOString() },
      conversation: updated,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /conversations — delete all conversations
router.delete('/conversations', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('companion_conversations')
      .delete()
      .eq('account_id', req.accountId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Check-ins ────────────────────────────────────────────

// GET /checkins — list recent check-ins
router.get('/checkins', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const { data, error } = await safeQuery(sb =>
      sb.from('companion_checkins')
        .select('*')
        .eq('account_id', req.accountId)
        .order('delivered_at', { ascending: false })
        .limit(limit)
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ checkins: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /checkins/:id/acknowledge — mark check-in as acknowledged
router.post('/checkins/:id/acknowledge', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('companion_checkins')
      .update({ acknowledged: true })
      .eq('id', req.params.id)
      .eq('account_id', req.accountId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ checkin: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Placeholder companion response generator
function generateCompanionResponse(mode, name, userMessage, history) {
  const greetings = {
    coach: `Here's what I think — `,
    buddy: `Oh nice! `,
    mentor: `That's an interesting point. `,
    romantic: `I was just thinking about you. `,
    cheerleader: `You're doing amazing! `,
  };

  const prefix = greetings[mode] || '';
  // In production, this would call Grok 4.1 Fast with a system prompt
  // that includes the companion personality definition + dynamic context
  return `${prefix}I hear you. This is ${name} in ${mode} mode. In production, I'd have full context from your personal modules to give you a thoughtful, personalized response. For now, I'm here and listening. What else is on your mind?`;
}

module.exports = router;
