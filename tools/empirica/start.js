#!/usr/bin/env node
/**
 * start.js — Boots the full Empirica × webDiplomacy research stack.
 *
 * Order:
 *  1. docker compose --profile core up -d
 *  2. Poll http://localhost:43000 until ready (max 120s)
 *  3. If AI_PROVIDER=ollama, verify Ollama is reachable
 *  4. Read config/empirica.sample.json, spawn one AI runner per AI seat
 *  5. Start tools/empirica-app dev server (Empirica)
 *  6. Print live URL summary
 */
import "dotenv/config";
import { spawn, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT  = path.resolve(fileURLToPath(import.meta.url), "../../..");
const WEBDIP_URL = process.env.WEBDIP_BASE_URL ?? "http://localhost:43000";
const procs = [];

function log(tag, msg) {
  console.log(`[${new Date().toTimeString().slice(0, 8)}] [${tag}] ${msg}`);
}

// ── 1. Docker ────────────────────────────────────────────────────────────────
log("docker", "Starting docker compose --profile core ...");
try {
  execSync("docker compose --profile core up -d", { cwd: ROOT, stdio: "inherit" });
} catch {
  console.error("docker compose failed — is Docker Desktop running?");
  process.exit(1);
}

// ── 2. Wait for webDiplomacy ─────────────────────────────────────────────────
log("wait", `Polling ${WEBDIP_URL} (up to 120s)…`);
const deadline = Date.now() + 120_000;
let ready = false;
while (Date.now() < deadline) {
  try {
    const res = await fetch(WEBDIP_URL, { signal: AbortSignal.timeout(3000) });
    if (res.status < 500) { ready = true; break; }
  } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 3000));
  process.stdout.write(".");
}
console.log();
if (!ready) { console.error("webDiplomacy did not start in time. Check docker logs."); process.exit(1); }
log("wait", "webDiplomacy is up.");

// ── 3. Ollama check ───────────────────────────────────────────────────────────
if ((process.env.AI_PROVIDER ?? "ollama") === "ollama") {
  const ollamaUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  try {
    await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    log("ollama", `Reachable at ${ollamaUrl}`);
  } catch {
    console.warn(`[ollama] WARNING: not reachable at ${ollamaUrl}. AI runners will fail until Ollama is started.`);
  }
}

// ── 4. AI runners ─────────────────────────────────────────────────────────────
const cfgPath = path.join(ROOT, "config", "empirica.sample.json");
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const runnerDir = path.join(ROOT, "tools", "empirica");
const gameID = process.env.GAME_ID ?? "1"; // override via env

for (const [team, t] of Object.entries(cfg.teams)) {
  const seats = [
    { seat: "A", type: t.seatA, cid: t.countryID_A },
    { seat: "B", type: t.seatB, cid: t.countryID_B },
  ].filter(s => s.type === "ai" && s.cid != null);

  for (const s of seats) {
    log("runner", `Spawning AI runner — team ${team} seat ${s.seat} (country ${s.cid})`);
    const env = {
      ...process.env,
      GAME_ID:     gameID,
      COUNTRY_ID:  String(s.cid),
      AI_PROVIDER: t.ai?.provider ?? process.env.AI_PROVIDER ?? "ollama",
      OLLAMA_MODEL: t.ai?.model   ?? process.env.OLLAMA_MODEL ?? "llama3",
    };
    const p = spawn("node", ["src/runner.js"], { cwd: runnerDir, env, stdio: "inherit" });
    p.on("exit", code => log("runner", `country ${s.cid} exited (${code})`));
    procs.push(p);
  }
}

if (!procs.length) log("runner", "No AI seats configured — skipping runners.");

// ── 5. Empirica app ───────────────────────────────────────────────────────────
const appDir = path.join(ROOT, "tools", "empirica-app");
log("empirica", "Starting Empirica dev server (npm start)…");
const empProc = spawn("npm", ["start"], { cwd: appDir, stdio: "inherit", shell: true });
empProc.on("exit", code => log("empirica", `exited (${code})`));
procs.push(empProc);

// ── 6. Summary ────────────────────────────────────────────────────────────────
console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  webDiplomacy   ${WEBDIP_URL}
  Empirica app   http://localhost:3000  (board: ${process.env.BOARD_URL ?? "http://localhost:43000/board.php"})
  AI runners     ${procs.length - 1} seat(s) active
  Ollama         ${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ctrl+C to stop all processes.
`);

// ── Cleanup ───────────────────────────────────────────────────────────────────
process.on("SIGINT", () => {
  log("shutdown", "Stopping all child processes…");
  procs.forEach(p => p.kill());
  process.exit(0);
});
