// Admin CLI: list countries, mark/unmark as AI, print runner launch commands.
// Usage:
//   node src/admin-ai.js list  <gameID>
//   node src/admin-ai.js set   <gameID> <countryID> <provider>  <model>
//   node src/admin-ai.js unset <gameID> <countryID>
//   node src/admin-ai.js run   <gameID>   (prints ready-to-run commands for all AI seats)
import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const CFG_PATH = path.resolve("../../config/empirica.sample.json");
const cfg = JSON.parse(await readFile(CFG_PATH, "utf8"));

// webdip API helpers (no game/members for anon; use game/overview instead)
async function wdApi(route, params = {}) {
  const url = new URL(`${process.env.WEBDIP_BASE_URL}/api.php`);
  url.searchParams.set("route", route);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.WEBDIP_API_KEY}` },
  });
  if (!res.ok) throw new Error(`${route}: ${res.status} ${await res.text()}`);
  return res.json();
}

const [, , cmd, gameID, countryID, provider, model] = process.argv;

function teamForCountry(cid) {
  return Object.entries(cfg.teams).find(([, t]) =>
    String(t.countryID_A) === String(cid) || String(t.countryID_B) === String(cid)
  );
}

async function cmdList(gid) {
  const members = await wdApi("game/members", { gameID: gid });
  console.log(`\nGame ${gid} — countries:`);
  for (const m of members.data?.members ?? []) {
    const aiCfg = teamForCountry(m.countryID);
    const flag = aiCfg ? `[AI: ${aiCfg[1]?.ai?.provider ?? "?"} / ${aiCfg[1]?.ai?.model ?? "?"}]` : "";
    console.log(`  ${m.countryID} ${m.country.padEnd(12)} ${m.username} ${flag}`);
  }
}

async function cmdSet(gid, cid, prov, mdl) {
  // Find or create team entry
  let found = false;
  for (const [name, t] of Object.entries(cfg.teams)) {
    if (String(t.countryID_A) === cid || String(t.countryID_B) === cid) {
      t.ai = { provider: prov, model: mdl };
      t.seatA = t.seatA === "human" && String(t.countryID_A) === cid ? "ai" : t.seatA;
      t.seatB = t.seatB === "human" && String(t.countryID_B) === cid ? "ai" : t.seatB;
      found = true;
      console.log(`Updated team "${name}" countryID ${cid} → AI (${prov}/${mdl})`);
    }
  }
  if (!found) console.warn(`No team found with countryID ${cid}. Add it to config/empirica.sample.json first.`);
  await writeFile(CFG_PATH, JSON.stringify(cfg, null, 2));
}

async function cmdUnset(gid, cid) {
  for (const [name, t] of Object.entries(cfg.teams)) {
    if (String(t.countryID_A) === cid) { t.seatA = "human"; delete t.ai; console.log(`Team "${name}" seatA → human`); }
    if (String(t.countryID_B) === cid) { t.seatB = "human"; console.log(`Team "${name}" seatB → human`); }
  }
  await writeFile(CFG_PATH, JSON.stringify(cfg, null, 2));
}

function cmdRun(gid) {
  console.log(`\n# Runner commands for game ${gid} — copy/paste each AI seat:\n`);
  for (const [name, t] of Object.entries(cfg.teams)) {
    const seats = [
      { seat: "A", type: t.seatA, cid: t.countryID_A },
      { seat: "B", type: t.seatB, cid: t.countryID_B },
    ].filter(s => s.type === "ai" && s.cid != null);
    for (const s of seats) {
      const prov = t.ai?.provider ?? "ollama";
      const mdl  = t.ai?.model    ?? "llama3";
      console.log(
        `GAME_ID=${gid} COUNTRY_ID=${s.cid} AI_PROVIDER=${prov} ` +
        `OLLAMA_MODEL=${mdl} node src/runner.js   # ${name} seat ${s.seat}`
      );
    }
  }
}

switch (cmd) {
  case "list":  await cmdList(gameID); break;
  case "set":   await cmdSet(gameID, countryID, provider, model); break;
  case "unset": await cmdUnset(gameID, countryID); break;
  case "run":   cmdRun(gameID); break;
  default:
    console.log("Usage: node src/admin-ai.js list|set|unset|run <gameID> [countryID] [provider] [model]");
}
