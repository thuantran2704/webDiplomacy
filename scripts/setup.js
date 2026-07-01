#!/usr/bin/env node
/**
 * scripts/setup.js — First-time setup for webDiplomacy × Empirica.
 *
 * Run once before `npm start`:
 *   npm run setup
 *
 * What it does:
 *  1. Checks Docker is running
 *  2. Copies config files from samples if missing
 *  3. Installs PHP dependencies via Docker (no local PHP/Composer needed)
 *  4. Starts Docker containers
 *  5. Waits for webDiplomacy to respond
 *  6. Prints browser instructions for first-time account setup
 */
import { execSync } from "node:child_process";
import { existsSync, copyFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");

const cyan   = (s) => `\x1b[36m${s}\x1b[0m`;
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;

function step(msg) { console.log(cyan(`[setup] ${msg}`)); }
function ok(msg)   { console.log(green(`  ✔ ${msg}`)); }
function warn(msg) { console.log(yellow(`  ! ${msg}`)); }
function die(msg)  { console.error(red(`\nERROR: ${msg}\n`)); process.exit(1); }

console.log(`\n  ${cyan("webDiplomacy × Empirica — Setup")}`);
console.log("  " + "─".repeat(35) + "\n");

// ── 1. Docker running? ───────────────────────────────────────────────────────
step("Checking Docker...");
try {
  execSync("docker info", { stdio: "pipe" });
  ok("Docker is running.");
} catch {
  die('Docker is not running. Open Docker Desktop and wait for "Engine running", then retry.');
}

// ── 2. Copy config files from samples ───────────────────────────────────────
step("Checking config files...");

const configs = [
  { src: "config.sample.php",            dst: "config.php" },
  { src: "sse-server/sample.env",        dst: "sse-server/.env" },
  { src: "tools/empirica/.env.example",  dst: "tools/empirica/.env" },
  { src: "data-service/.env.example",    dst: "data-service/.env" },
];

for (const { src, dst } of configs) {
  const srcPath = path.join(ROOT, src);
  const dstPath = path.join(ROOT, dst);
  if (!existsSync(dstPath)) {
    copyFileSync(srcPath, dstPath);
    ok(`${dst} created from sample.`);
  } else {
    ok(`${dst} already exists.`);
  }
}

// ── 3. PHP dependencies via Docker ───────────────────────────────────────────
const vendor = path.join(ROOT, "vendor", "autoload.php");
if (!existsSync(vendor)) {
  step("Installing PHP dependencies via Docker (first time, ~1 min)...");
  const vol = `${ROOT}:/app`;
  const base = ["docker", "run", "--rm", "-v", vol, "-e", "COMPOSER_ALLOW_SUPERUSER=1", "composer:latest"];
  execSync([...base, "config", "--no-plugins", "policy.advisories.block", "false"].join(" "), { stdio: "pipe" });
  execSync([...base, "update", "--no-interaction"].join(" "), { cwd: ROOT, stdio: "inherit" });
  ok("PHP dependencies installed.");
} else {
  ok("PHP dependencies already installed.");
}

// ── 4. Start Docker containers ───────────────────────────────────────────────
step("Starting Docker containers...");
try {
  execSync("docker compose --profile core --profile dev up -d", { cwd: ROOT, stdio: "inherit" });
  ok("Containers started.");
} catch {
  die("docker compose failed. Check output above.");
}

// ── 4.5. Apply research DB schema ───────────────────────────────────────────
step("Applying research database schema (rs_* tables)...");
try {
  execSync(
    `docker exec webdiplomacy-db mariadb -u webdiplomacy -pmypassword123 webdiplomacy < ${path.join(ROOT, "install/research/rs_schema.sql")}`,
    { cwd: ROOT, stdio: "pipe" }
  );
  ok("Research schema applied.");
} catch {
  warn("Schema apply failed — DB may not be ready yet. Re-run setup if needed.");
}

// ── 5. Wait for webDiplomacy ─────────────────────────────────────────────────
step(`Waiting for ${WEBDIP_URL} (up to 120s)...`);
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
if (!ready) {
  warn("webDiplomacy didn't respond in 120s.");
  console.log("  Check logs: docker compose logs webserver php-fpm");
  process.exit(1);
}
ok("webDiplomacy is up!");

// ── 6. First-time browser instructions ──────────────────────────────────────
const envContent = readFileSync(path.join(ROOT, "tools/empirica/.env"), "utf8");
const needsKey = /WEBDIP_API_KEY=(your_api_key_here)?\s*$/.test(envContent);

if (needsKey) {
  console.log(`
${yellow("══════════════════════════════════════════════════")}
${yellow("  FIRST-TIME SETUP  (do this once in your browser)")}
${yellow("══════════════════════════════════════════════════")}

  1. Register (quick shortcut — skips email):
     ${cyan("http://localhost:43000/register.php?emailToken=9513e6f6%7C1665482821%7Ctest%40test.com")}

  2. Become admin:
     ${cyan("http://localhost:43000/gamemaster.php?gameMasterSecret=")}

  3. Generate API key:
     ${cyan("http://localhost:43000/admincp.php")}  →  API Keys tab  →  Generate

  4. Paste the key into ${yellow("tools/empirica/.env")}:
     WEBDIP_API_KEY=<your key here>

  5. Run ${green("npm start")} to launch the full research stack.
`);
} else {
  console.log(`
${green("Setup complete!")} Run ${green("npm start")} to launch the research stack.
`);
}
