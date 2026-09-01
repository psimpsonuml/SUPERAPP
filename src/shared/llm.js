// ══════════════════════════════════════════════════════════════════
// LLM Wrapper
//
// Eleven files previously duplicated the same six lines: require the
// SDK, construct a client, call messages.create, read
// response.content[0].text, JSON.parse it inside a try/catch with a
// hand-written fallback. Two of them used a config key that does not
// exist (config.anthropicApiKey) and silently fell back to the env var.
//
// This centralizes the client, the model ids, JSON parsing, retry, and
// token accounting.
// ══════════════════════════════════════════════════════════════════

const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');
const logger = require('./logger');

// Centralized so a model change is one edit, not eleven.
const MODELS = {
  fast: 'claude-haiku-4-5-20251001',
  balanced: 'claude-sonnet-4-6',
  deep: 'claude-opus-4-6',
};

let client = null;

function getClient() {
  if (!client) {
    const apiKey = config.llm?.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new LlmUnavailableError('ANTHROPIC_API_KEY not configured');
    client = new Anthropic({ apiKey });
  }
  return client;
}

class LlmUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LlmUnavailableError';
    this.code = 'LLM_UNAVAILABLE';
  }
}

function isConfigured() {
  return !!(config.llm?.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Strip markdown fences and pull the outermost JSON value.
 * Models emit fenced JSON despite instructions not to, often enough
 * that this belongs here rather than in every call site.
 */
function extractJson(text) {
  if (!text) return null;

  let cleaned = text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try { return JSON.parse(cleaned); } catch { /* fall through */ }

  // Find the outermost {...} or [...]
  const firstBrace = cleaned.search(/[{[]/);
  if (firstBrace === -1) return null;

  const opener = cleaned[firstBrace];
  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = firstBrace; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === opener) depth++;
    else if (ch === closer) {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(cleaned.slice(firstBrace, i + 1)); }
        catch { return null; }
      }
    }
  }
  return null;
}

/**
 * Single completion.
 * @returns {Promise<{text, usage, model, stopReason}>}
 */
async function complete({
  prompt, system, model = MODELS.fast, maxTokens = 1024,
  temperature, retries = config.agents?.retryAttempts ?? 3,
}) {
  if (!isConfigured()) throw new LlmUnavailableError('ANTHROPIC_API_KEY not configured');

  const backoff = config.agents?.retryBackoffMs || [1000, 2000, 4000];
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const params = {
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      };
      if (system) params.system = system;
      if (temperature !== undefined) params.temperature = temperature;

      const response = await getClient().messages.create(params);

      return {
        text: response.content?.[0]?.text || '',
        usage: response.usage || { input_tokens: 0, output_tokens: 0 },
        model,
        stopReason: response.stop_reason,
      };
    } catch (err) {
      lastError = err;

      // Don't burn retries on errors that will never succeed
      const status = err.status || err.statusCode;
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw err;
      }

      if (attempt < retries - 1) {
        const delay = backoff[attempt] || backoff[backoff.length - 1];
        logger.warn(`LLM call failed (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms: ${err.message}`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Completion that must return JSON.
 * @returns {Promise<{data, usage, model, raw}>}
 * Throws if the response cannot be parsed — callers decide whether a
 * fallback is appropriate rather than silently receiving junk.
 */
async function completeJson({ prompt, system, model = MODELS.fast, maxTokens = 2048, temperature, retries }) {
  const jsonInstruction = 'Respond with ONLY valid JSON. No markdown, no code fences, no commentary.';
  const fullSystem = system ? `${system}\n\n${jsonInstruction}` : jsonInstruction;

  const result = await complete({ prompt, system: fullSystem, model, maxTokens, temperature, retries });
  const data = extractJson(result.text);

  if (data === null) {
    throw new Error(`LLM returned unparseable JSON: ${result.text.slice(0, 200)}`);
  }

  return { data, usage: result.usage, model: result.model, raw: result.text };
}

/**
 * completeJson that returns a fallback instead of throwing.
 * Use only where a degraded result is genuinely acceptable.
 */
async function completeJsonOrFallback(options, fallback, logCtx = {}) {
  try {
    return await completeJson(options);
  } catch (err) {
    logger.warn(`LLM JSON call failed, using fallback: ${err.message}`, logCtx);
    return { data: fallback, usage: { input_tokens: 0, output_tokens: 0 }, model: options.model, fallback: true };
  }
}

module.exports = {
  complete,
  completeJson,
  completeJsonOrFallback,
  extractJson,
  isConfigured,
  MODELS,
  LlmUnavailableError,
};
