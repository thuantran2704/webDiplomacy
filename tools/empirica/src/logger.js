/**
 * Research data logger — appends one JSONL record per AI decision event.
 * Captures: who acted, what model, what orders/messages, timing, turn/phase.
 * Output: research-data/events.jsonl  (one JSON object per line, easy to parse)
 */
import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

const dir  = process.env.RESEARCH_EXPORT_DIR ?? "./research-data";
const file = path.join(dir, "events.jsonl");

let _ready = false;
async function ensureDir() {
  if (_ready) return;
  await mkdir(dir, { recursive: true });
  _ready = true;
}

/**
 * Log one AI decision event.
 * @param {object} event
 * @param {number} event.gameID
 * @param {number} event.countryID
 * @param {number} event.turn
 * @param {string} event.phase
 * @param {string} event.provider   - "ollama" | "api"
 * @param {string} event.model
 * @param {object[]} event.orders   - validated orders submitted
 * @param {object[]} event.messages - messages sent
 * @param {string[]} event.validationErrors
 * @param {number} event.llmMs      - LLM round-trip time in ms
 */
export async function logDecision(event) {
  await ensureDir();
  const record = { ts: new Date().toISOString(), type: "decision", ...event };
  await appendFile(file, JSON.stringify(record) + "\n");
}

/**
 * Log a rate-limit suppression event (message throttled).
 */
export async function logThrottled(gameID, countryID, turn, phase, reason) {
  await ensureDir();
  const record = { ts: new Date().toISOString(), type: "throttled", gameID, countryID, turn, phase, reason };
  await appendFile(file, JSON.stringify(record) + "\n");
}

/**
 * Log any runner error.
 */
export async function logError(gameID, countryID, error) {
  await ensureDir();
  const record = { ts: new Date().toISOString(), type: "error", gameID, countryID, error: error?.message ?? String(error) };
  await appendFile(file, JSON.stringify(record) + "\n");
}
