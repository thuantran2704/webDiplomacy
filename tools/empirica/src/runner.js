// AI seat runner: poll game state, ask LLM, submit orders + messages. One process per AI seat.
import "dotenv/config";
import { getStatus, getData, getMessages, sendMessage, setOrders } from "./webdip.js";
import { decide } from "./ai.js";
import { validateOrders, buildPrompt } from "./orders.js";
import { logDecision, logThrottled, logError } from "./logger.js";
import {
  checkLlmAllowed, recordLlmCall,
  applyMessageCap, resetTurnCounters,
} from "./ratelimit.js";

const gameID    = Number(process.env.GAME_ID);
const countryID = Number(process.env.COUNTRY_ID);
const pollMs    = (Number(process.env.POLL_SECONDS) || 20) * 1000;
let lastTurnPhase = "";

async function tick() {
  const status = await getStatus(gameID, countryID);
  if (!["Diplomacy", "Retreats", "Builds"].includes(status.phase)) return;
  const tp = `${status.turn}/${status.phase}`;
  if (tp === lastTurnPhase) return;

  // Rate limit: enforce minimum gap between LLM calls
  const { allowed, waitMs } = checkLlmAllowed(gameID, countryID);
  if (!allowed) {
    await logThrottled(gameID, countryID, status.turn, status.phase, `LLM cooldown ${waitMs}ms remaining`);
    return;
  }

  resetTurnCounters(gameID, countryID, status.turn);

  const [board, msgs] = await Promise.all([
    getData(gameID, countryID),
    getMessages(gameID, countryID, 0),
  ]);

  const prompt = buildPrompt({
    status,
    units:             board.units ?? [],
    territoryStatuses: board.territoryStatuses ?? [],
    currentOrders:     board.currentOrders ?? [],
    messages:          msgs,
    countryID,
  });

  const llmStart = Date.now();
  recordLlmCall(gameID, countryID);
  const out = await decide(prompt);
  const llmMs = Date.now() - llmStart;

  const { valid, errors } = validateOrders(out.orders ?? [], status.phase, countryID, board.units ?? []);
  if (errors.length) console.warn(`[${tp}] validation errors:`, errors);

  // Rate limit: cap messages per turn
  const { allowed: allowedMsgs, dropped } = applyMessageCap(
    gameID, countryID, status.turn, out.messages ?? []
  );
  if (dropped > 0) {
    await logThrottled(gameID, countryID, status.turn, status.phase, `${dropped} message(s) dropped (per-turn cap)`);
    console.warn(`[${tp}] ${dropped} message(s) throttled`);
  }

  for (const m of allowedMsgs)
    await sendMessage(gameID, countryID, m.to, m.text);
  if (valid.length)
    await setOrders(gameID, status.turn, status.phase, countryID, valid, "Yes");

  await logDecision({
    gameID, countryID,
    turn:    status.turn,
    phase:   status.phase,
    provider: process.env.AI_PROVIDER ?? "ollama",
    model:   process.env.OLLAMA_MODEL ?? process.env.LLM_MODEL ?? "unknown",
    orders:  valid,
    messages: allowedMsgs,
    validationErrors: errors,
    llmMs,
  });

  lastTurnPhase = tp;
  console.log(`[${new Date().toISOString()}] acted on ${tp} — ${valid.length} orders, ${allowedMsgs.length} msgs (${llmMs}ms)`);
}

console.log(`AI runner: game ${gameID} country ${countryID} via ${process.env.AI_PROVIDER}`);
setInterval(() => tick().catch(async (e) => {
  console.error(e.message);
  await logError(gameID, countryID, e);
}), pollMs);
tick().catch(async (e) => {
  console.error(e.message);
  await logError(gameID, countryID, e);
});
