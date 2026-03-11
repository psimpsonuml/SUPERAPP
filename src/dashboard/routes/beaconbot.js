const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

// ── Model Configuration ──────────────────────────────────────────────
const MODELS = {
  auto: { id: 'auto', name: 'Auto', description: 'Router decides the best model for each query' },
  haiku: { id: 'haiku', name: 'Claude Haiku 4.5', description: 'Fast responses for simple queries' },
  sonnet: { id: 'sonnet', name: 'Claude Sonnet 4', description: 'Balanced performance and quality' },
  opus: { id: 'opus', name: 'Claude Opus 4', description: 'Maximum capability for complex tasks' }
};

// ── Context Templates ────────────────────────────────────────────────
const CONTEXT_RESPONSES = {
  dashboard: "I can help you navigate your BeaconOps dashboard. I see you have pending approvals, recent reports, and team activity to review. What would you like to focus on?",
  chronostates: "I'm here to help with ChronoStates time tracking. I can assist with timesheet reviews, PTO requests, overtime analysis, and scheduling. What do you need?",
  payroll_beacon: "Let me help with Payroll Beacon. I can assist with payroll runs, tax calculations, deduction management, and compliance checks. How can I help?",
  budgeting_beacon: "I'm ready to help with Budgeting Beacon. I can assist with budget forecasts, expense tracking, variance analysis, and financial planning. What would you like to explore?"
};

// ── Safe Query Helper ────────────────────────────────────────────────
async function safeQuery(queryFn, res) {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const supabase = getSupabase();
    return await queryFn(supabase);
  } catch (err) {
    console.error('BeaconBot query error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

// ── GET /models — Available models list ──────────────────────────────
router.get('/models', (req, res) => {
  const modelList = Object.values(MODELS);
  res.json({ models: modelList });
});

// ── GET /context — Current dashboard context data ────────────────────
router.get('/context', (req, res) => {
  const contextData = {
    dashboard: {
      label: 'Dashboard',
      shortLabel: 'Dashboard',
      pending_approvals: 5,
      recent_reports: 3,
      active_team_members: 12,
      alerts: 2
    },
    chronostates: {
      label: 'ChronoStates',
      shortLabel: 'CS',
      pending_timesheets: 8,
      pto_requests: 3,
      overtime_alerts: 1,
      schedule_conflicts: 0
    },
    payroll_beacon: {
      label: 'Payroll Beacon',
      shortLabel: 'PB',
      next_payroll_date: '2026-03-15',
      pending_adjustments: 4,
      tax_filing_due: '2026-03-31',
      compliance_issues: 0
    },
    budgeting_beacon: {
      label: 'Budgeting Beacon',
      shortLabel: 'BB',
      active_budgets: 6,
      over_budget_items: 2,
      forecast_accuracy: '94%',
      pending_approvals: 3
    }
  };
  res.json({ contexts: contextData });
});

// ── GET /embed-script — Embeddable chat widget script ────────────────
router.get('/embed-script', (req, res) => {
  const baseUrl = req.query.baseUrl || '';
  const script = `
(function() {
  var d = document, s = d.createElement('script');
  s.src = '${baseUrl}/static/beaconbot-widget.js';
  s.async = true;
  s.setAttribute('data-beaconbot', 'true');
  s.setAttribute('data-base-url', '${baseUrl}');
  d.head.appendChild(s);

  var link = d.createElement('link');
  link.rel = 'stylesheet';
  link.href = '${baseUrl}/static/beaconbot-widget.css';
  d.head.appendChild(link);
})();
`.trim();
  res.type('application/javascript').send(script);
});

// ── GET /conversations — List conversations ─────────────────────────
router.get('/conversations', (req, res) => {
  safeQuery(async (supabase) => {
    const { context } = req.query;
    const accountId = req.query.account_id || req.headers['x-account-id'];

    let query = supabase
      .from('beaconbot_conversations')
      .select('id, account_id, context, title, model_used, pinned, created_at, updated_at')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (accountId) {
      query = query.eq('account_id', accountId);
    }
    if (context) {
      query = query.eq('context', context);
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ conversations: data || [] });
  }, res);
});

// ── GET /conversations/:id — Single conversation with messages ──────
router.get('/conversations/:id', (req, res) => {
  safeQuery(async (supabase) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('beaconbot_conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ conversation: data });
  }, res);
});

// ── POST /conversations — Create new conversation ───────────────────
router.post('/conversations', (req, res) => {
  safeQuery(async (supabase) => {
    const { account_id, context, title, model_used } = req.body;

    if (!account_id) {
      return res.status(400).json({ error: 'account_id is required' });
    }

    const newConvo = {
      account_id,
      context: context || 'dashboard',
      title: title || 'New Conversation',
      model_used: model_used || 'auto',
      messages_json: [],
      pinned: false
    };

    const { data, error } = await supabase
      .from('beaconbot_conversations')
      .insert(newConvo)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ conversation: data });
  }, res);
});

// ── DELETE /conversations/:id — Delete conversation ──────────────────
router.delete('/conversations/:id', (req, res) => {
  safeQuery(async (supabase) => {
    const { id } = req.params;

    const { error } = await supabase
      .from('beaconbot_conversations')
      .delete()
      .eq('id', id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, message: 'Conversation deleted' });
  }, res);
});

// ── POST /conversations/:id/message — Send message, get AI response ─
router.post('/conversations/:id/message', (req, res) => {
  safeQuery(async (supabase) => {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Fetch existing conversation
    const { data: convo, error: fetchError } = await supabase
      .from('beaconbot_conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) return res.status(404).json({ error: 'Conversation not found' });

    const messages = convo.messages_json || [];
    const userMessage = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString()
    };
    messages.push(userMessage);

    // Claude API stub: generate helpful template response based on context
    const contextGreeting = CONTEXT_RESPONSES[convo.context] || CONTEXT_RESPONSES.dashboard;
    let botResponse;

    if (messages.filter(m => m.role === 'user').length === 1) {
      botResponse = contextGreeting;
    } else {
      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes('approve') || lowerMsg.includes('approval')) {
        botResponse = `I can help with approvals. I found pending items that need your attention. Would you like me to show the details or take action on specific items?`;
      } else if (lowerMsg.includes('report') || lowerMsg.includes('summary')) {
        botResponse = `I'll pull together a summary for you. Based on the current ${convo.context} data, here are the key highlights. Would you like me to generate a detailed report?`;
      } else if (lowerMsg.includes('remind') || lowerMsg.includes('schedule')) {
        botResponse = `I can set that up for you. Would you like me to create a reminder or add this to your schedule? Just confirm the details and I'll handle it.`;
      } else if (lowerMsg.includes('help') || lowerMsg.includes('what can you')) {
        botResponse = `Here's what I can do in ${convo.context}:\n• Review and approve pending items\n• Generate reports and summaries\n• Set reminders and schedule tasks\n• Trigger automated workflows\n• Answer questions about your data\n\nJust ask me anything!`;
      } else {
        botResponse = `Thanks for your message. I'm analyzing your request in the context of ${convo.context}. Based on the available data, I can help you with this. Would you like me to take any specific action, or would you prefer more details?`;
      }
    }

    const assistantMessage = {
      role: 'assistant',
      content: botResponse,
      model: convo.model_used,
      timestamp: new Date().toISOString()
    };
    messages.push(assistantMessage);

    // Update title from first user message if still default
    const updates = {
      messages_json: messages,
      updated_at: new Date().toISOString()
    };
    if (convo.title === 'New Conversation') {
      updates.title = message.trim().substring(0, 60) + (message.length > 60 ? '...' : '');
    }

    const { data: updated, error: updateError } = await supabase
      .from('beaconbot_conversations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) return res.status(400).json({ error: updateError.message });

    res.json({
      conversation: updated,
      response: assistantMessage
    });
  }, res);
});

// ── PUT /conversations/:id — Update title, pin/unpin ─────────────────
router.put('/conversations/:id', (req, res) => {
  safeQuery(async (supabase) => {
    const { id } = req.params;
    const { title, pinned } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (pinned !== undefined) updates.pinned = pinned;

    const { data, error } = await supabase
      .from('beaconbot_conversations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ conversation: data });
  }, res);
});

// ── GET /conversations/:id/actions — Actions in conversation ─────────
router.get('/conversations/:id/actions', (req, res) => {
  safeQuery(async (supabase) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('beaconbot_actions')
      .select('*')
      .eq('conversation_id', id)
      .order('executed_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ actions: data || [] });
  }, res);
});

// ── POST /action — Execute an action (stub) ─────────────────────────
router.post('/action', (req, res) => {
  safeQuery(async (supabase) => {
    const { account_id, conversation_id, action_type, action_details } = req.body;

    if (!account_id || !action_type) {
      return res.status(400).json({ error: 'account_id and action_type are required' });
    }

    // Stub: simulate action execution based on type
    let result = {};
    switch (action_type) {
      case 'approve_item':
        result = { status: 'approved', message: `Item ${action_details?.item_id || 'unknown'} has been approved successfully.` };
        break;
      case 'trigger_agent':
        result = { status: 'triggered', message: `Agent "${action_details?.agent_name || 'default'}" has been triggered.`, job_id: `job_${Date.now()}` };
        break;
      case 'add_reminder':
        result = { status: 'created', message: `Reminder set for ${action_details?.due_date || 'tomorrow'}: "${action_details?.note || 'No note'}"` };
        break;
      case 'generate_report':
        result = { status: 'generating', message: 'Report generation started. You will be notified when ready.', report_id: `rpt_${Date.now()}` };
        break;
      case 'send_notification':
        result = { status: 'sent', message: `Notification sent to ${action_details?.recipient || 'team'}.` };
        break;
      default:
        result = { status: 'completed', message: `Action "${action_type}" executed successfully.` };
    }

    const actionRecord = {
      account_id,
      conversation_id: conversation_id || null,
      action_type,
      action_details_json: action_details || {},
      result_json: result
    };

    const { data, error } = await supabase
      .from('beaconbot_actions')
      .insert(actionRecord)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ action: data, result });
  }, res);
});

// ── PUT /conversations/:id/model — Switch model for conversation ─────
router.put('/conversations/:id/model', (req, res) => {
  safeQuery(async (supabase) => {
    const { id } = req.params;
    const { model } = req.body;

    if (!model || !MODELS[model]) {
      return res.status(400).json({ error: 'Invalid model. Choose from: auto, haiku, sonnet, opus' });
    }

    const { data, error } = await supabase
      .from('beaconbot_conversations')
      .update({ model_used: model, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ conversation: data, model: MODELS[model] });
  }, res);
});

module.exports = router;
