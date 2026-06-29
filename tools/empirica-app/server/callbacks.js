// Empirica server callbacks — assigns participants to game/country seats on game start.
// Runs on the Empirica server (Node); talks to webDiplomacy orchestrator via REST.
import { ClassicListenersCollector } from "@empirica-core/admin/classic";
export const Empirica = new ClassicListenersCollector();

const WEBDIP_BASE = process.env.WEBDIP_BASE_URL;
const API_KEY     = process.env.WEBDIP_API_KEY;

async function wdApi(route, params = {}) {
  const url = new URL(`${WEBDIP_BASE}/api.php`);
  url.searchParams.set("route", route);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
  return res.json();
}

// Called when an Empirica round starts.
Empirica.onRoundStart(({ round }) => {
  const assignments = round.get("countryAssignments") ?? [];
  round.set("boardUrl", process.env.BOARD_URL);
  console.log(`[empirica] round ${round.id} started — ${assignments.length} seats assigned`);
});

// Called when a player stage starts — give them their seat.
Empirica.onStageStart(({ stage }) => {
  for (const player of stage.currentGame.players) {
    const seat = player.get("seat");
    if (seat) {
      player.stage.set("boardUrl",
        `${process.env.BOARD_URL}?gameID=${seat.gameID}`);
    }
  }
});

// Called when game ends — mark complete.
Empirica.onGameEnd(({ game }) => {
  const gameID = game.get("webdipGameID");
  console.log(`[empirica] game ${game.id} ended (webdip gameID=${gameID})`);
});
