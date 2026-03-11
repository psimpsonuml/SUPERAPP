const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// ── TEAMS ─────────────────────────────────────────────────

// GET /api/sports/teams — my favorite teams
router.get('/teams', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('sports_teams')
        .select('*')
        .eq('account_id', accountId)
        .order('league', { ascending: true })
        .order('team_name', { ascending: true })
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ teams: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sports/teams — add team
router.post('/teams', async (req, res) => {
  try {
    const { account_id, team_name, league, team_id, logo_url } = req.body;
    if (!account_id || !team_name || !league) {
      return res.status(400).json({ error: 'account_id, team_name, and league required' });
    }

    const { data, error } = await safeQuery(sb =>
      sb.from('sports_teams')
        .insert({ account_id, team_name, league, team_id: team_id || '', logo_url: logo_url || '' })
        .select()
        .single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ team: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/sports/teams/:id — remove team
router.delete('/teams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await safeQuery(sb =>
      sb.from('sports_teams').delete().eq('id', id)
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── SCHEDULE & STANDINGS (stub data) ──────────────────────

// GET /api/sports/schedule — upcoming games and recent results for my teams
router.get('/schedule', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data: teams } = await safeQuery(sb =>
      sb.from('sports_teams').select('team_name, league').eq('account_id', accountId)
    );

    const today = new Date();
    const upcoming = (teams || []).map((t, i) => ({
      id: `sched-${i}`,
      league: t.league,
      home_team: i % 2 === 0 ? t.team_name : `Opponent ${i + 1}`,
      away_team: i % 2 === 0 ? `Opponent ${i + 1}` : t.team_name,
      game_date: new Date(today.getTime() + (i + 1) * 86400000).toISOString().slice(0, 10),
      time: '7:00 PM',
      status: 'scheduled',
    }));

    const recent = (teams || []).map((t, i) => ({
      id: `recent-${i}`,
      league: t.league,
      home_team: t.team_name,
      away_team: `Rival ${i + 1}`,
      home_score: 3 + (i % 5),
      away_score: 1 + (i % 4),
      game_date: new Date(today.getTime() - (i + 1) * 86400000).toISOString().slice(0, 10),
      status: 'final',
    }));

    res.json({ upcoming, recent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sports/standings — league standings for my teams' leagues
router.get('/standings', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data: teams } = await safeQuery(sb =>
      sb.from('sports_teams').select('team_name, league').eq('account_id', accountId)
    );

    const leagues = [...new Set((teams || []).map(t => t.league))];
    const standings = {};
    leagues.forEach(league => {
      const leagueTeams = (teams || []).filter(t => t.league === league);
      standings[league] = leagueTeams.map((t, i) => ({
        rank: i + 1,
        team: t.team_name,
        wins: 10 - i * 2,
        losses: 3 + i * 2,
        draws: i,
        points: (10 - i * 2) * 3 + i,
        streak: i === 0 ? 'W3' : i === 1 ? 'L1' : 'W1',
      }));
    });

    res.json({ standings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GAME RATINGS ──────────────────────────────────────────

// GET /api/sports/games — my rated games
router.get('/games', async (req, res) => {
  try {
    const { account_id, league, team, start_date, end_date, page = 1, limit = 20 } = req.query;
    if (!account_id) return res.status(400).json({ error: 'account_id required' });

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data, error } = await safeQuery(sb => {
      let q = sb.from('sports_game_ratings')
        .select('*')
        .eq('account_id', account_id)
        .order('game_date', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      if (league) q = q.eq('league', league);
      if (team) q = q.or(`home_team.eq.${team},away_team.eq.${team}`);
      if (start_date) q = q.gte('game_date', start_date);
      if (end_date) q = q.lte('game_date', end_date);
      return q;
    });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ games: data || [], page: parseInt(page) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sports/games — rate a game with player tags
router.post('/games', async (req, res) => {
  try {
    const {
      account_id, game_id, league, home_team, away_team,
      home_score, away_score, game_date, score, game_type,
      players_tagged, notes,
    } = req.body;

    if (!account_id || !league || !home_team || !away_team || !game_date || !score) {
      return res.status(400).json({ error: 'account_id, league, home_team, away_team, game_date, and score required' });
    }

    const { data, error } = await safeQuery(sb =>
      sb.from('sports_game_ratings')
        .insert({
          account_id,
          game_id: game_id || '',
          league,
          home_team,
          away_team,
          home_score: home_score != null ? parseInt(home_score) : null,
          away_score: away_score != null ? parseInt(away_score) : null,
          game_date,
          score: parseInt(score),
          game_type: game_type || 'regular',
          players_tagged_json: players_tagged || [],
          notes: notes || '',
        })
        .select()
        .single()
    );
    if (error) return res.status(500).json({ error: error.message });

    // Update cascade scores for tagged players
    if (players_tagged && players_tagged.length > 0) {
      for (const player of players_tagged) {
        await updateCascadeScore(account_id, player, league, home_team, away_team);
      }
    }

    res.json({ game: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/sports/games/:id — update rating
router.put('/games/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    const allowed = ['score', 'game_type', 'players_tagged', 'notes', 'home_score', 'away_score'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === 'players_tagged') {
          updates.players_tagged_json = req.body[key];
        } else if (key === 'score' || key === 'home_score' || key === 'away_score') {
          updates[key] = parseInt(req.body[key]);
        } else {
          updates[key] = req.body[key];
        }
      }
    }

    const { data, error } = await safeQuery(sb =>
      sb.from('sports_game_ratings').update(updates).eq('id', id).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ game: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── CASCADE / PLAYER SCORES ──────────────────────────────

async function updateCascadeScore(accountId, player, league, homeTeam, awayTeam) {
  const team = player.team || homeTeam;
  const { data: existing } = await safeQuery(sb =>
    sb.from('sports_cascade_scores')
      .select('*')
      .eq('account_id', accountId)
      .eq('player_name', player.name)
      .eq('team', team)
      .single()
  );

  const gamesRated = (existing ? existing.games_rated : 0) + 1;
  const prevTotal = existing ? existing.avg_score * existing.games_rated : 0;
  const avgScore = ((prevTotal + (player.score || 7)) / gamesRated).toFixed(1);
  const compositeScore = (avgScore * Math.min(gamesRated / 5, 1) * 10).toFixed(2);

  await safeQuery(sb =>
    sb.from('sports_cascade_scores')
      .upsert({
        account_id: accountId,
        player_name: player.name,
        team,
        league,
        position: player.position || '',
        composite_score: parseFloat(compositeScore),
        games_rated: gamesRated,
        avg_score: parseFloat(avgScore),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,player_name,team' })
  );
}

// GET /api/sports/players — player cascade leaderboard
router.get('/players', async (req, res) => {
  try {
    const { account_id, league, team, position, page = 1, limit = 25 } = req.query;
    if (!account_id) return res.status(400).json({ error: 'account_id required' });

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data, error } = await safeQuery(sb => {
      let q = sb.from('sports_cascade_scores')
        .select('*')
        .eq('account_id', account_id)
        .order('composite_score', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      if (league) q = q.eq('league', league);
      if (team) q = q.eq('team', team);
      if (position) q = q.eq('position', position);
      return q;
    });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ players: data || [], page: parseInt(page) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sports/players/:name — player detail with game history
router.get('/players/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { account_id } = req.query;
    if (!account_id) return res.status(400).json({ error: 'account_id required' });

    const decodedName = decodeURIComponent(name);

    const { data: player } = await safeQuery(sb =>
      sb.from('sports_cascade_scores')
        .select('*')
        .eq('account_id', account_id)
        .eq('player_name', decodedName)
        .single()
    );

    // Find games where this player was tagged
    const { data: allGames } = await safeQuery(sb =>
      sb.from('sports_game_ratings')
        .select('*')
        .eq('account_id', account_id)
        .order('game_date', { ascending: false })
    );

    const playerGames = (allGames || []).filter(g => {
      const tagged = g.players_tagged_json || [];
      return tagged.some(p => p.name === decodedName);
    });

    res.json({ player: player || null, games: playerGames });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── SEASON STATS ──────────────────────────────────────────

// GET /api/sports/season-stats — season viewing stats
router.get('/season-stats', async (req, res) => {
  try {
    const { account_id } = req.query;
    if (!account_id) return res.status(400).json({ error: 'account_id required' });

    const { data: games } = await safeQuery(sb =>
      sb.from('sports_game_ratings')
        .select('*')
        .eq('account_id', account_id)
        .order('game_date', { ascending: false })
    );

    const allGames = games || [];
    const totalGames = allGames.length;

    // Games per team
    const teamCounts = {};
    allGames.forEach(g => {
      teamCounts[g.home_team] = (teamCounts[g.home_team] || 0) + 1;
      teamCounts[g.away_team] = (teamCounts[g.away_team] || 0) + 1;
    });

    // W/L record for favorite teams
    const { data: favTeams } = await safeQuery(sb =>
      sb.from('sports_teams').select('team_name, league').eq('account_id', account_id)
    );
    const favNames = new Set((favTeams || []).map(t => t.team_name));

    let wins = 0, losses = 0, draws = 0;
    allGames.forEach(g => {
      if (g.home_score == null || g.away_score == null) return;
      const isHome = favNames.has(g.home_team);
      const isAway = favNames.has(g.away_team);
      if (!isHome && !isAway) return;
      if (g.home_score === g.away_score) { draws++; return; }
      const homeWin = g.home_score > g.away_score;
      if ((isHome && homeWin) || (isAway && !homeWin)) wins++;
      else losses++;
    });

    // Highest rated
    const highestRated = allGames.length > 0
      ? allGames.reduce((best, g) => (g.score || 0) > (best.score || 0) ? g : best, allGames[0])
      : null;

    // Games per league
    const leagueCounts = {};
    allGames.forEach(g => {
      leagueCounts[g.league] = (leagueCounts[g.league] || 0) + 1;
    });

    res.json({
      total_games: totalGames,
      team_counts: teamCounts,
      league_counts: leagueCounts,
      record: { wins, losses, draws },
      win_pct: wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0',
      highest_rated: highestRated,
      avg_rating: totalGames > 0
        ? (allGames.reduce((s, g) => s + (g.score || 0), 0) / totalGames).toFixed(1)
        : '0.0',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── TODAY WIDGET ──────────────────────────────────────────

// GET /api/sports/today — today's games for my teams with scores
router.get('/today', async (req, res) => {
  try {
    const { account_id } = req.query;
    if (!account_id) return res.status(400).json({ error: 'account_id required' });

    const { data: teams } = await safeQuery(sb =>
      sb.from('sports_teams').select('team_name, league').eq('account_id', account_id)
    );

    const today = new Date().toISOString().slice(0, 10);

    // Check if user has already rated any games today
    const { data: todayRatings } = await safeQuery(sb =>
      sb.from('sports_game_ratings')
        .select('*')
        .eq('account_id', account_id)
        .eq('game_date', today)
    );

    // Stub today's games for favorite teams
    const todayGames = (teams || []).map((t, i) => {
      const hour = 12 + i * 3;
      const inProgress = hour <= new Date().getHours();
      return {
        id: `today-${i}`,
        league: t.league,
        home_team: i % 2 === 0 ? t.team_name : `Opponent ${i + 1}`,
        away_team: i % 2 === 0 ? `Opponent ${i + 1}` : t.team_name,
        game_date: today,
        time: `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`,
        status: inProgress ? 'in_progress' : 'scheduled',
        home_score: inProgress ? Math.floor(Math.random() * 5) + 1 : null,
        away_score: inProgress ? Math.floor(Math.random() * 4) : null,
      };
    });

    res.json({
      date: today,
      games: todayGames,
      rated_today: todayRatings || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
