// ══════════════════════════════════════════════════════════════════
// Pain point helpers
//
// The `pain_points` table stores a post `title` and body `text`.
// Several consumers previously selected a `signal_text` column that
// does not exist, so the whole pain-point signal stream came back
// empty. Everything now goes through these helpers.
// ══════════════════════════════════════════════════════════════════

// Columns any consumer should select to build signal text.
const SIGNAL_COLUMNS = 'id, title, text, category, source, source_url, score, urgency, product, date_found';

/**
 * Build a single readable signal string from a pain_points row.
 * Prefers the post title, falls back to the body, and trims noise.
 */
function signalText(row, maxLength = 300) {
  if (!row) return '';
  const title = (row.title || '').trim();
  const body = (row.text || '').trim();

  let signal;
  if (title && body && !body.startsWith(title)) {
    signal = `${title} — ${body}`;
  } else {
    signal = title || body;
  }

  signal = signal.replace(/\s+/g, ' ').trim();
  return signal.length > maxLength ? `${signal.slice(0, maxLength - 1)}…` : signal;
}

/**
 * Attach a derived `signalText` field to each row so downstream code
 * can read one consistent property.
 */
function withSignalText(rows, maxLength = 300) {
  return (rows || []).map(row => ({ ...row, signalText: signalText(row, maxLength) }));
}

module.exports = { SIGNAL_COLUMNS, signalText, withSignalText };
