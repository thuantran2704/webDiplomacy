// AI seat runner: poll game state, ask LLM, submit orders + messages. One process per AI seat.
import "dotenv/config";
import { getStatus, getData, getMessages, sendMessage, setOrders } from "./webdip.js";
import { decide } from "./ai.js";
import { validateOrders, buildPrompt } from "./orders.js";

const gameID = Number(process.env.GAME_ID);
const countryID = Number(process.env.COUNTRY_ID);
const pollMs = (Number(process.env.POLL_SECONDS) || 20) * 1000;
let lastTurnPhase = "";

async function tick() {
  const status = await getStatus(gameID, countryID);
  if (!["Diplomacy", "Retreats", "Builds"].includes(status.phase)) return;
  const tp = `${status.turn}/${status.phase}`;
  if (tp === lastTurnPhase) return; // already acted this turn/phase

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
  const out = await decide(prompt);

  const { valid, errors } = validateOrders(out.orders ?? [], status.phase, countryID, board.units ?? []);
  if (errors.length) console.warn(`[${tp}] order validation errors:`, errors);

  for (const m of out.messages ?? [])
    await sendMessage(gameID, countryID, m.to, m.text);
  if (valid.length)
    await setOrders(gameID, status.turn, status.phase, countryID, valid, "Yes");

  lastTurnPhase = tp;
  console.log(`[${new Date().toISOString()}] acted on ${tp} — ${valid.length} orders, ${(out.messages??[]).length} msgs`);
}

console.log(`AI runner: game ${gameID} country ${countryID} via ${process.env.AI_PROVIDER}`);
setInterval(() => tick().catch((e) => console.error(e.message)), pollMs);
tick().catch((e) => console.error(e.message));
