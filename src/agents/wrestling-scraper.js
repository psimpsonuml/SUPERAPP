const https = require('https');
const BaseAgent = require('./base-agent');

// ── Promotions tracked ─────────────────────────────────────
// Each entry maps a promotion to the Wikipedia category/search terms
// used to locate recent event result pages.
const PROMOTIONS = {
  WWE: {
    label: 'WWE',
    searchTerms: ['WWE Raw', 'WWE SmackDown', 'WWE NXT'],
    ppvTerms: ['WWE pay-per-view', 'WWE Premium Live Event'],
  },
  AEW: {
    label: 'AEW',
    searchTerms: ['AEW Dynamite', 'AEW Rampage', 'AEW Collision'],
    ppvTerms: ['All Elite Wrestling pay-per-view'],
  },
  NJPW: {
    label: 'NJPW',
    searchTerms: ['New Japan Pro-Wrestling event'],
    ppvTerms: ['Wrestle Kingdom', 'G1 Climax'],
  },
  TNA: {
    label: 'TNA',
    searchTerms: ['TNA Impact Wrestling'],
    ppvTerms: ['TNA pay-per-view'],
  },
  ROH: {
    label: 'ROH',
    searchTerms: ['Ring of Honor Wrestling'],
    ppvTerms: ['Ring of Honor pay-per-view'],
  },
  GCW: {
    label: 'GCW',
    searchTerms: ['Game Changer Wrestling'],
    ppvTerms: ['Game Changer Wrestling event'],
  },
};

// Cascade weights — mirrors CASCADE_WEIGHTS.wrestling in lib/constants.js
const ROLE_WEIGHTS = {
  winner: 1.0,
  loser: 0.8,
  participant: 0.6,
};

const WIKI_API = 'https://en.wikipedia.org/w/api.php';

class WrestlingScraperAgent extends BaseAgent {
  static agentId = 'wrestling-scraper';
  static agentName = 'Wrestling Results Scraper';

  constructor(accountId) {
    super(accountId, {
      agentId: 'wrestling-scraper',
      agentName: 'Wrestling Results Scraper',
      cycle: 'weekly',
      defaultTier: 2,
    });
  }

  // ── Main run ───────────────────────────────────────────
  async run() {
    const results = {
      promotionsScanned: 0,
      eventsFound: 0,
      eventsStored: 0,
      matchesStored: 0,
      statsComputed: 0,
      failures: [],
    };

    // Look back 8 days so a weekly run never misses a show
    const since = new Date();
    since.setDate(since.getDate() - 8);

    for (const [key, promo] of Object.entries(PROMOTIONS)) {
      try {
        const events = await this.scrapePromotion(key, promo, since);
        results.promotionsScanned++;
        results.eventsFound += events.length;

        for (const event of events) {
          const eventId = await this.storeEvent(event);
          if (!eventId) continue;
          results.eventsStored++;

          for (const match of event.matches) {
            const stored = await this.storeMatch(eventId, event, match);
            if (stored) results.matchesStored++;
          }
        }

        await this.sleep(1200);
      } catch (err) {
        this.logger.warn(`Failed to scrape ${key}`, {
          error: err.message,
          agentId: this.agentId,
        });
        results.failures.push({ promotion: key, error: err.message });
      }
    }

    // A run that reached no promotion at all is a failure, not a success.
    if (results.promotionsScanned === 0) {
      throw new Error(
        `Wrestling scrape reached no promotions. Failures: ${results.failures.map(f => `${f.promotion}: ${f.error}`).join('; ')}`
      );
    }

    // Build the fun statistics off everything stored so far
    try {
      const stats = await this.computeStatistics();
      results.statsComputed = stats.computed;
      results.statHighlights = stats.highlights;
    } catch (err) {
      this.logger.warn('Statistics computation failed', { error: err.message });
      results.failures.push({ stage: 'statistics', error: err.message });
    }

    this.itemsProduced = results.matchesStored;
    return results;
  }

  // ── Scrape one promotion's recent events ───────────────
  async scrapePromotion(key, promo, since) {
    const events = [];
    const seen = new Set();

    for (const term of [...promo.searchTerms, ...promo.ppvTerms]) {
      let pages;
      try {
        pages = await this.wikiSearch(term);
      } catch (err) {
        this.logger.warn(`Wiki search failed for "${term}"`, { error: err.message });
        continue;
      }

      for (const page of pages.slice(0, 4)) {
        if (seen.has(page.title)) continue;
        seen.add(page.title);

        try {
          const parsed = await this.parseEventPage(page.title, key);
          if (!parsed) continue;
          if (parsed.event_date && new Date(parsed.event_date) < since) continue;
          if (parsed.matches.length === 0) continue;
          events.push(parsed);
        } catch (err) {
          this.logger.warn(`Failed to parse "${page.title}"`, { error: err.message });
        }

        await this.sleep(400);
      }
    }

    return events;
  }

  // ── Wikipedia search ───────────────────────────────────
  async wikiSearch(term) {
    const url = `${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(term)}&srsort=create_timestamp_desc&srlimit=6&format=json`;
    const data = await this.fetchJson(url);
    return (data?.query?.search || []).map(r => ({ title: r.title, pageid: r.pageid }));
  }

  // ── Parse a single event page into matches ─────────────
  async parseEventPage(title, promotionKey) {
    const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json`;
    const data = await this.fetchJson(url);
    const wikitext = data?.parse?.wikitext?.['*'];
    if (!wikitext) return null;

    const eventDate = this.extractDate(wikitext);
    if (!eventDate) return null;

    return {
      promotion: promotionKey,
      event_name: title,
      event_type: this.classifyEventType(title, wikitext),
      event_date: eventDate,
      venue: this.extractInfoboxField(wikitext, 'venue'),
      city: this.extractInfoboxField(wikitext, 'city'),
      source_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      matches: this.extractMatches(wikitext),
    };
  }

  // ── Extract match rows from the results table ──────────
  extractMatches(wikitext) {
    const matches = [];

    // Wikipedia wrestling results tables use rows shaped like:
    // | 1 || Wrestler A defeated Wrestler B || Singles match || 10:23
    const rowPattern = /\|\s*(\d+)?\s*\|\|([^|]+?)(?:\|\|([^|]+?))?(?:\|\|\s*([\d]+:[\d]{2}))?\s*(?:\|-|\n)/g;

    let m;
    let order = 0;
    while ((m = rowPattern.exec(wikitext)) !== null && matches.length < 20) {
      const description = this.cleanWikitext(m[2] || '');
      if (!description || description.length < 8) continue;
      if (!/defeated|def\.|beat|won|submitted|pinned|draw|no contest/i.test(description)) continue;

      const participants = this.parseParticipants(description);
      if (participants.length === 0) continue;

      order++;
      matches.push({
        match_order: order,
        match_type: this.cleanWikitext(m[3] || 'singles').slice(0, 80) || 'singles',
        stipulation: this.extractStipulation(description),
        title_match: /championship|title/i.test(description),
        title_name: this.extractTitleName(description),
        participants_json: participants,
        winner: participants.find(p => p.role === 'winner')?.name || '',
        duration_seconds: this.parseDuration(m[4]),
        finish: '',
        description,
      });
    }

    return matches;
  }

  // ── Split "A defeated B" into roled participants ───────
  parseParticipants(description) {
    const participants = [];

    const splitPattern = /\s+(?:defeated|def\.|beat|pinned|submitted)\s+/i;
    const parts = description.split(splitPattern);

    if (parts.length < 2) {
      // Draw / no contest — everyone is a plain participant
      if (/draw|no contest|time limit/i.test(description)) {
        for (const name of this.splitNames(description)) {
          participants.push({ name, role: 'participant', team: '' });
        }
      }
      return participants;
    }

    for (const name of this.splitNames(parts[0])) {
      participants.push({ name, role: 'winner', team: '' });
    }
    for (const name of this.splitNames(parts[1])) {
      participants.push({ name, role: 'loser', team: '' });
    }

    return participants;
  }

  splitNames(segment) {
    return segment
      .replace(/\([^)]*\)/g, '')
      .replace(/\[\[|\]\]/g, '')
      .split(/\s*(?:,|\band\b|&|vs\.?)\s*/i)
      .map(s => s.trim())
      .filter(s => s.length > 1 && s.length < 60)
      .filter(s => !/^(the|a|an|in|to|win|by|with|for)$/i.test(s))
      .slice(0, 8);
  }

  // ── Persistence ────────────────────────────────────────
  async storeEvent(event) {
    const { data, error } = await this.supabase
      .from('wrestling_events')
      .upsert({
        account_id: this.accountId,
        promotion: event.promotion,
        event_name: event.event_name,
        event_type: event.event_type,
        event_date: event.event_date,
        venue: event.venue,
        city: event.city,
        source_url: event.source_url,
        source: 'wikipedia',
        scraped_at: new Date().toISOString(),
      }, { onConflict: 'account_id,promotion,event_name,event_date' })
      .select('id')
      .single();

    if (error) {
      this.logger.warn(`Failed to store event ${event.event_name}`, { error: error.message });
      return null;
    }
    return data?.id;
  }

  async storeMatch(eventId, event, match) {
    // Skip if this match is already recorded for the event
    const { data: existing } = await this.supabase
      .from('wrestling_matches')
      .select('id')
      .eq('account_id', this.accountId)
      .eq('event_id', eventId)
      .eq('match_order', match.match_order)
      .maybeSingle();

    if (existing) return false;

    const { error } = await this.supabase.from('wrestling_matches').insert({
      account_id: this.accountId,
      event_id: eventId,
      promotion: event.promotion,
      event_name: event.event_name,
      event_date: event.event_date,
      match_order: match.match_order,
      match_type: match.match_type,
      stipulation: match.stipulation,
      title_match: match.title_match,
      title_name: match.title_name,
      participants_json: match.participants_json,
      winner: match.winner,
      duration_seconds: match.duration_seconds,
      finish: match.finish,
      source_url: event.source_url,
    });

    if (error) {
      this.logger.warn('Failed to store match', { error: error.message });
      return false;
    }
    return true;
  }

  // ── Fun statistics ─────────────────────────────────────
  async computeStatistics() {
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 90);

    const { data: matches } = await this.supabase
      .from('wrestling_matches')
      .select('promotion, event_date, match_type, title_match, participants_json, winner, duration_seconds')
      .eq('account_id', this.accountId)
      .gte('event_date', periodStart.toISOString().slice(0, 10));

    if (!matches || matches.length === 0) {
      return { computed: 0, highlights: {} };
    }

    const winCounts = {};
    const lossCounts = {};
    const appearances = {};
    const promotionTally = {};
    const titleMatches = {};
    let totalDuration = 0;
    let durationSamples = 0;

    for (const m of matches) {
      promotionTally[m.promotion] = (promotionTally[m.promotion] || 0) + 1;
      if (m.duration_seconds) {
        totalDuration += m.duration_seconds;
        durationSamples++;
      }
      if (m.title_match && m.winner) {
        titleMatches[m.winner] = (titleMatches[m.winner] || 0) + 1;
      }

      for (const p of (m.participants_json || [])) {
        appearances[p.name] = (appearances[p.name] || 0) + 1;
        if (p.role === 'winner') winCounts[p.name] = (winCounts[p.name] || 0) + 1;
        if (p.role === 'loser') lossCounts[p.name] = (lossCounts[p.name] || 0) + 1;
      }
    }

    const topBy = (obj, n = 10) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n)
        .map(([name, count]) => ({ name, count }));

    // Win rate only for wrestlers with enough matches to be meaningful
    const winRates = Object.keys(appearances)
      .filter(name => appearances[name] >= 3)
      .map(name => ({
        name,
        wins: winCounts[name] || 0,
        losses: lossCounts[name] || 0,
        matches: appearances[name],
        winRate: +(((winCounts[name] || 0) / appearances[name]) * 100).toFixed(1),
      }))
      .sort((a, b) => b.winRate - a.winRate);

    const payload = {
      periodDays: 90,
      totalMatches: matches.length,
      totalEvents: new Set(matches.map(m => `${m.promotion}:${m.event_date}`)).size,
      avgMatchDurationSec: durationSamples > 0 ? Math.round(totalDuration / durationSamples) : null,
      mostWins: topBy(winCounts),
      mostLosses: topBy(lossCounts),
      mostActive: topBy(appearances),
      bestWinRate: winRates.slice(0, 10),
      worstWinRate: winRates.slice(-10).reverse(),
      titleWins: topBy(titleMatches, 5),
      matchesByPromotion: promotionTally,
      ironMan: topBy(appearances, 1)[0] || null,
    };

    await this.supabase.from('wrestling_stats').upsert({
      account_id: this.accountId,
      stat_type: 'rolling_90d',
      promotion: '',
      period_start: periodStart.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
      payload_json: payload,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'account_id,stat_type,promotion,period_start' });

    return {
      computed: 1,
      highlights: {
        totalMatches: payload.totalMatches,
        ironMan: payload.ironMan?.name || null,
        topWinner: payload.mostWins[0]?.name || null,
      },
    };
  }

  // ── Parsing helpers ────────────────────────────────────
  extractDate(wikitext) {
    const dateField = wikitext.match(/\|\s*date\s*=\s*([^\n|]+)/i);
    if (dateField) {
      const parsed = this.parseLooseDate(this.cleanWikitext(dateField[1]));
      if (parsed) return parsed;
    }
    const anyDate = wikitext.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/);
    return anyDate ? this.parseLooseDate(anyDate[0]) : null;
  }

  parseLooseDate(text) {
    if (!text) return null;
    const cleaned = text.replace(/\{\{|\}\}/g, '').replace(/start date\|/i, '').trim();
    const iso = cleaned.match(/(\d{4})[|-](\d{1,2})[|-](\d{1,2})/);
    if (iso) {
      return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
    }
    const d = new Date(cleaned);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1990 && d.getFullYear() < 2100) {
      return d.toISOString().slice(0, 10);
    }
    return null;
  }

  extractInfoboxField(wikitext, field) {
    const m = wikitext.match(new RegExp(`\\|\\s*${field}\\s*=\\s*([^\\n|]+)`, 'i'));
    return m ? this.cleanWikitext(m[1]).slice(0, 120) : '';
  }

  classifyEventType(title, wikitext) {
    if (/pay-per-view|premium live event|ppv/i.test(wikitext)) return 'ppv';
    if (/tournament|climax|cup\b/i.test(title)) return 'tournament';
    if (/Raw|SmackDown|NXT|Dynamite|Rampage|Collision|Impact/i.test(title)) return 'weekly';
    return 'special';
  }

  extractStipulation(description) {
    const stips = [
      'ladder match', 'steel cage', 'hell in a cell', 'tables match', 'tlc',
      'no disqualification', 'street fight', 'iron man', 'royal rumble',
      'battle royal', 'submission match', 'last man standing', 'casket match',
      'deathmatch', 'scramble', 'gauntlet',
    ];
    const lower = description.toLowerCase();
    const found = stips.find(s => lower.includes(s));
    return found || '';
  }

  extractTitleName(description) {
    const m = description.match(/for the ([A-Z][\w\s']+(?:Championship|Title))/);
    return m ? m[1].trim().slice(0, 100) : '';
  }

  parseDuration(text) {
    if (!text) return null;
    const m = text.trim().match(/^(\d+):(\d{2})$/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  cleanWikitext(text) {
    return (text || '')
      .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
      .replace(/\{\{[^}]*\}\}/g, '')
      .replace(/<ref[^>]*>.*?<\/ref>/gs, '')
      .replace(/<[^>]+>/g, '')
      .replace(/'''?/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ── Network ────────────────────────────────────────────
  fetchJson(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: { 'User-Agent': 'BeaconOps/2.0 Wrestling Scraper (contact: ops@beaconops.com)' },
        timeout: 15000,
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(new Error(`Invalid JSON from ${url.slice(0, 80)}: ${err.message}`));
          }
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
      req.on('error', reject);
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = WrestlingScraperAgent;
module.exports.PROMOTIONS = PROMOTIONS;
module.exports.ROLE_WEIGHTS = ROLE_WEIGHTS;
