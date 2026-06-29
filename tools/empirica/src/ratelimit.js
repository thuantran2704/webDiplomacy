/**
 * Rate limiter for the AI runner.
 * Guards:
 *  1. One LLM call per turn/phase per seat (already in runner via lastTurnPhase,
 *     but this adds a wall-clock minimum gap to survive edge cases).
 *  2. Max N messages sent per turn per seat.
 *  3. Minimum interval between consecutive LLM calls (prevents runaway loops).
 */

// Minimum ms between LLM calls for the same seat regardless of phase changes.
const MIN_LLM_INTERVAL_MS = Number(process.env.RATE_MIN_LLM_INTERVAL_MS) || 5_000;

// Max messages the AI may send per turn (across all recipients).
const MAX_MESSAGES_PER_TURN = Number(process.env.RATE_MAX_MESSAGES_PER_TURN) || 3;

const lastLlmCall   = new Map(); // key: `${gameID}:${countryID}`
const msgCountByTurn = new Map(); // key: `${gameID}:${countryID}:${turn}`

/**
 * Check if an LLM call is allowed. Returns { allowed, waitMs }.
 */
export function checkLlmAllowed(gameID, countryID) {
  const key  = `${gameID}:${countryID}`;
  const last = lastLlmCall.get(key) ?? 0;
  const wait = MIN_LLM_INTERVAL_MS - (Date.now() - last);
  if (wait > 0) return { allowed: false, waitMs: wait };
  return { allowed: true, waitMs: 0 };
}

/** Record that an LLM call was made. */
export function recordLlmCall(gameID, countryID) {
  lastLlmCall.set(`${gameID}:${countryID}`, Date.now());
}

/**
 * Enforce per-turn message cap. Returns the slice of messages allowed,
 * and how many were dropped.
 */
export function applyMessageCap(gameID, countryID, turn, messages) {
  const key   = `${gameID}:${countryID}:${turn}`;
  const used  = msgCountByTurn.get(key) ?? 0;
  const slots = Math.max(0, MAX_MESSAGES_PER_TURN - used);
  const allowed = messages.slice(0, slots);
  const dropped = messages.length - allowed.length;
  if (allowed.length) msgCountByTurn.set(key, used + allowed.length);
  return { allowed, dropped };
}

/** Reset message counter when a new turn starts (call on phase change). */
export function resetTurnCounters(gameID, countryID, turn) {
  // Clean up old turns to avoid unbounded memory growth
  for (const k of msgCountByTurn.keys()) {
    if (k.startsWith(`${gameID}:${countryID}:`) && k !== `${gameID}:${countryID}:${turn}`) {
      msgCountByTurn.delete(k);
    }
  }
}
