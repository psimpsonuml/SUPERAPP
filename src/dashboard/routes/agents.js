const express = require('express');
const { listAgents, createAgent } = require('../../agents/registry');
const { getSupabase } = require('../../db/supabase');

const router = express.Router();

// GET /api/agents — list all agents with status
router.get('/', async (req, res) => {
  try {
    const agents = listAgents();
    const supabase = getSupabase();

    // Get latest run for each agent
    const { data: latestRuns } = await supabase
      .from('agent_runs')
      .select('agent_id, status, run_started_at, run_finished_at, duration_ms, items_produced')
      .eq('account_id', req.accountId)
      .order('run_started_at', { ascending: false });

    const latestByAgent = {};
    for (const run of latestRuns || []) {
      if (!latestByAgent[run.agent_id]) {
        latestByAgent[run.agent_id] = run;
      }
    }

    const enriched = agents.map(agent => ({
      ...agent,
      lastRun: latestByAgent[agent.id] || null,
    }));

    res.json({ agents: enriched });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/agents/:id/runs — get run history for an agent
router.get('/:id/runs', async (req, res) => {
  try {
    const supabase = getSupabase();
    const limit = parseInt(req.query.limit, 10) || 20;

    const { data } = await supabase
      .from('agent_runs')
      .select('*')
      .eq('account_id', req.accountId)
      .eq('agent_id', req.params.id)
      .order('run_started_at', { ascending: false })
      .limit(limit);

    res.json({ runs: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agents/:id/trigger — manually trigger an agent
router.post('/:id/trigger', async (req, res) => {
  try {
    const agentId = req.params.id;
    const agent = createAgent(agentId, req.accountId);
    const result = await agent.execute();
    res.json({ agentId, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
