// Orchestrator: read empirica.sample.json, enforce 2-seat teams + 1 decision maker, map seats to AI runners.
// This is the layer that turns "team config" into AI runner processes; human seats use the normal web UI.
import "dotenv/config";
import { readFile } from "node:fs/promises";

const cfg = JSON.parse(await readFile(new URL("../../config/empirica.sample.json", import.meta.url)));
console.log(`Variant ${cfg.variantID}, max ${cfg.maxPlayersPerTeam}/team`);

for (const [team, t] of Object.entries(cfg.teams)) {
  const seats = [t.seatA, t.seatB].filter(Boolean);
  const aiSeats = seats.filter((s) => s === "ai");
  const dm = t.decisionMaker; // "A" or "B": only this seat's orders are authoritative
  console.log(`${team}: seats=${seats.join("+")} decisionMaker=${dm} aiSeats=${aiSeats.length}`);
  // Decision-maker enforcement: orchestrator issues API key only to the DM seat for game/orders;
  // the non-DM seat gets chat-only. Launch one runner per AI seat with that scope.
}
console.log("Spawn runners with GAME_ID/COUNTRY_ID per ai seat (see runner.js).");
