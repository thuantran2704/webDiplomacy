// Empirica server callbacks — assigns participants to game/country seats on game start.
// Runs on the Empirica server (Node); talks to webDiplomacy orchestrator via REST.
import { ClassicListenersCollector } from "@empirica-core/admin/classic";
export const Empirica = new ClassicListenersCollector();

const WEBDIP_BASE  = process.env.WEBDIP_BASE_URL;
const API_KEY      = process.env.WEBDIP_API_KEY;
const DATA_API_URL = process.env.DATA_API_URL;
const DATA_API_KEY = process.env.DATA_API_KEY;

async function wdApi(route, params = {}) {
  const url = new URL(`${WEBDIP_BASE}/api.php`);
  url.searchParams.set("route", route);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
  return res.json();
}

async function dataApi(method, path, body = null) {
  const res = await fetch(`${DATA_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${DATA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Data API ${method} ${path} → ${res.status}`);
  return res.json();
}

// Fires when a new player is created (participant joins the experiment lobby).
// Idempotent: skip if participantId was already registered on a server restart.
Empirica.on("player", async (ctx, { player }) => {
  if (player.get("participantId")) return;
  try {
    const { id: participantId } = await dataApi("POST", "/api/v1/participants", {
      empiricaPlayerId: player.id,
    });
    player.set("participantId", participantId);
    console.log(`[empirica] participant registered: player=${player.id} → id=${participantId}`);
  } catch (err) {
    console.error(`[empirica] participant registration failed for ${player.id}:`, err.message);
  }
});

// Required by Empirica: called when all players are ready. Must create rounds + stages.
// Also registers the game in Data API and assigns each player to a country team.
Empirica.onGameStart(async ({ game }) => {
  const config = game.get("config") ?? {};

  // Register game in Data API
  const { id: rsGameId } = await dataApi("POST", "/api/v1/games", {
    empiricaGameId: game.id,
    webdipGameId:   game.get("webdipGameID") ?? null,
    variantId:      config.variantID ?? 1,
    config,
  });
  game.set("rsGameId", rsGameId);

  // Create a team row for each configured country
  const teamCfgs    = config.teams ?? {};
  const teamMap     = {}; // countryName → { id, countryId }
  let   countryIdx  = 1;
  for (const [countryName, teamCfg] of Object.entries(teamCfgs)) {
    const countryId = countryIdx++;
    const { id: teamId } = await dataApi("POST", "/api/v1/teams", {
      gameId:           rsGameId,
      countryId,
      countryName,
      maxHumans:        teamCfg.maxHumans ?? 2,
      intraChatEnabled: teamCfg.intraTeamChat !== false,
    });
    teamMap[countryName] = { id: teamId, countryId };
  }

  // Assign each player to the first team with remaining capacity
  const countryNames      = Object.keys(teamCfgs);
  const playerCountPerTeam = {};
  for (const player of game.players) {
    const participantId = player.get("participantId");
    if (!participantId) continue;

    let assigned = false;
    for (const countryName of countryNames) {
      const maxHumans = teamCfgs[countryName]?.maxHumans ?? 2;
      const count     = playerCountPerTeam[countryName] ?? 0;
      if (count >= maxHumans) continue;

      const { id: teamId, countryId } = teamMap[countryName];
      // First occupant becomes controller; subsequent ones are spectators
      const role = count === 0 ? "controller" : "spectator";

      await dataApi("POST", `/api/v1/teams/${teamId}/members`, { participantId, role });
      await dataApi("POST", "/api/v1/events", {
        type:          "team.assigned",
        gameId:        rsGameId,
        participantId,
        teamId,
        countryId,
        payload:       { role, countryName },
      });

      player.set("teamId",      teamId);
      player.set("role",        role);
      player.set("countryId",   countryId);
      player.set("countryName", countryName);

      playerCountPerTeam[countryName] = count + 1;
      assigned = true;
      break;
    }
    if (!assigned)
      console.warn(`[empirica] no team capacity for player ${player.id}`);
  }

  await dataApi("POST", "/api/v1/events", {
    type:    "game.created",
    gameId:  rsGameId,
    payload: { empiricaGameId: game.id },
  });

  // Empirica requires at least one round and stage
  const round = game.addRound({ name: "Game" });
  round.addStage({ name: "Play", duration: (config.phaseDurationMinutes ?? 30) * 60 });

  console.log(`[empirica] game ${game.id} started — rsGameId=${rsGameId}, ${game.players.length} players`);
});

// Called when an Empirica round starts.
Empirica.onRoundStart(({ round }) => {
  const assignments = round.get("countryAssignments") ?? [];
  round.set("boardUrl", process.env.BOARD_URL);
  console.log(`[empirica] round ${round.id} started — ${assignments.length} seats assigned`);
});

// Called when a player stage starts — give them their board URL.
Empirica.onStageStart(({ stage }) => {
  for (const player of stage.currentGame.players) {
    const seat = player.get("seat");
    if (seat) {
      player.stage.set("boardUrl",
        `${process.env.BOARD_URL}?gameID=${seat.gameID}`);
    }
  }
});

// Called when game ends — log completion.
Empirica.onGameEnd(({ game }) => {
  const gameID = game.get("webdipGameID");
  console.log(`[empirica] game ${game.id} ended (webdip gameID=${gameID})`);
});

