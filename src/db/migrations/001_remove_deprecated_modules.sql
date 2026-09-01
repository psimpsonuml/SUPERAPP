-- ══════════════════════════════════════════════════════════════════
-- Migration 001 — Remove deprecated personal modules
--
-- Drops: music, books, dna, dating, companion, sports
-- (finance had no tables — it read a `finance_snapshot` view/table that
--  was never defined in any schema file, so there is nothing to drop.)
--
-- DESTRUCTIVE. Any data in these tables is permanently deleted.
-- Take a Supabase backup before running.
-- ══════════════════════════════════════════════════════════════════

BEGIN;

-- ── Music ─────────────────────────────────────────────────────────
DROP TABLE IF EXISTS music_ratings CASCADE;
DROP TABLE IF EXISTS music_people CASCADE;
DROP TABLE IF EXISTS music_items CASCADE;
DROP TABLE IF EXISTS spotify_tokens CASCADE;

-- ── Books (personal reading tracker — NOT books_authored) ─────────
DROP TABLE IF EXISTS book_ratings CASCADE;
DROP TABLE IF EXISTS book_items CASCADE;

-- ── DNA ───────────────────────────────────────────────────────────
DROP TABLE IF EXISTS dna_reports CASCADE;
DROP TABLE IF EXISTS dna_imports CASCADE;
DROP TABLE IF EXISTS dna_personal CASCADE;
DROP TABLE IF EXISTS dna_atlas CASCADE;

-- ── Dating ────────────────────────────────────────────────────────
DROP TABLE IF EXISTS dating_analytics CASCADE;
DROP TABLE IF EXISTS dating_matches CASCADE;
DROP TABLE IF EXISTS dating_profiles CASCADE;

-- ── Companion ─────────────────────────────────────────────────────
DROP TABLE IF EXISTS companion_checkins CASCADE;
DROP TABLE IF EXISTS companion_conversations CASCADE;
DROP TABLE IF EXISTS companion_settings CASCADE;

-- ── Sports (replaced by the wrestling module) ─────────────────────
DROP TABLE IF EXISTS sports_game_ratings CASCADE;
DROP TABLE IF EXISTS sports_cascade_scores CASCADE;
DROP TABLE IF EXISTS sports_teams CASCADE;

-- ── Clean orphaned rows from the SHARED cascade_scores table ──────
-- cascade_scores is still used by entertainment/tmdb/releases —
-- delete only the music- and book-sourced rows.
DELETE FROM cascade_scores WHERE item_type IN ('book', 'artist');
DELETE FROM cascade_scores WHERE source_type IN ('book', 'music');

-- ── Remove feature_visibility seed rows ───────────────────────────
DELETE FROM feature_visibility
WHERE feature_key IN ('books', 'music', 'companion', 'dna', 'finance', 'dating', 'sports');

-- ── Remove deprecated agent rows ──────────────────────────────────
DELETE FROM feature_visibility
WHERE feature_key IN ('builder-community', 'community-strategist');

-- Historical agent_runs for removed agents (keeps the runs table clean;
-- comment this out if you want to preserve the audit trail)
DELETE FROM agent_runs
WHERE agent_id IN ('builder-community', 'community-strategist');

-- ── Builder Community intel (only writer was the deleted agent) ───
DROP TABLE IF EXISTS builder_intel CASCADE;

-- Orphaned calendar entries whose producer no longer exists
DELETE FROM content_calendar WHERE post_type IN ('builder_promo', 'builder_x_post');

COMMIT;
