// AI seat runner: poll game state, ask LLM, submit orders + messages. One process per AI seat.
import "dotenv/config";
import { getStatus, getData, getMessages, sendMessage, setOrders } from "./webdip.js";
import { decide } from "./ai.js";

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
  const out = await decide(JSON.stringify({ status, board, messages: msgs }));

  for (const m of out.messages ?? [])
    await sendMessage(gameID, countryID, m.to, m.text);
  await setOrders(gameID, status.turn, status.phase, countryID, out.orders ?? [], "Yes");

  lastTurnPhase = tp;
  console.log(`[${new Date().toISOString()}] acted on ${tp}`);
}

console.log(`AI runner: game ${gameID} country ${countryID} via ${process.env.AI_PROVIDER}`);
setInterval(() => tick().catch((e) => console.error(e.message)), pollMs);
tick().catch((e) => console.error(e.message));
