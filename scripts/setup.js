#!/usr/bin/env node
/**
 * scripts/setup.js — First-time (and idempotent) setup for webDiplomacy × Empirica.
 *
 * Run once before `npm start`:
 *   npm run setup
 *
 * Steps:
 *  1. Check Docker is running
 *  2. Copy config files from samples (skips existing)
 *  3. Generate + inject secrets (salt, session key, gameMasterSecret, DATA_API_KEY …)
 *  4. Install PHP deps via Docker (no local PHP needed)
 *  5. Start Docker containers
 *  6. Apply research DB schema  (rs_* tables — IF NOT EXISTS, safe to re-run)
 *  7. Wait for webDiplomacy to respond
 *  8. Create admin user + webdiplomacy API key in DB (skips if already done)
 *  9. Print summary
 */
import { execSync }                                              from "node:child_process";
import { existsSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes }                               from "node:crypto";
import path                                                      from "node:path";
import { fileURLToPath }                                         from "node:url";

const ROOT          = path.resolve(fileURLToPath(import.meta.url), "../..");
const WEBDIP_URL    = "http://localhost:43000";
const DB_CONTAINER  = "webdiplomacy-db";
const DB_USER       = "webdiplomacy";
const DB_PASS       = "mypassword123";
const DB_NAME       = "webdiplomacy";

const cyan   = (s) => `\x1b[36m${s}\x1b[0m`;
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;

function step(msg)  { console.log(cyan(`\n[setup] ${msg}`)); }
function ok(msg)    { console.log(green(`  ✔ ${msg}`)); }
function warn(msg)  { console.log(yellow(`  ! ${msg}`)); }
function die(msg)   { console.error(red(`\nERROR: ${msg}\n`)); process.exit(1); }
function hexSecret(bytes = 24) { return randomBytes(bytes).toString("hex"); }
function md5(s)     { return createHash("md5").update(s).digest("hex"); }
/** Same algorithm as libAuth::pass_Hash() in lib/auth.php */
function webdipHash(salt, password) { return md5(salt + md5(password)); }

/** Run SQL via docker exec stdin — works on all platforms. */
function dbExec(sql) {
  execSync(
    `docker exec -i ${DB_CONTAINER} mariadb -u ${DB_USER} -p${DB_PASS} ${DB_NAME}`,
    { input: sql, stdio: ["pipe", "pipe", "pipe"] }
  );
}

/** Run SQL and return the first cell of the first row as a trimmed string. */
function dbQuery(sql) {
  return execSync(
    `docker exec -i ${DB_CONTAINER} mariadb -u ${DB_USER} -p${DB_PASS} ${DB_NAME} --skip-column-names -s`,
    { input: sql, stdio: ["pipe", "pipe", "pipe"] }
  ).toString().trim();
}

console.log(`\n  ${cyan("webDiplomacy × Empirica — Setup")}`);
console.log("  " + "─".repeat(35) + "\n");

// ── 1. Docker running? ──────────────────────────────────────────────────────
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
  { src: "config.sample.php",           dst: "config.php" },
  { src: "sse-server/sample.env",       dst: "sse-server/.env" },
  { src: "tools/empirica/.env.example", dst: "tools/empirica/.env" },
  { src: "data-service/.env.example",   dst: "data-service/.env" },
];
for (const { src, dst } of configs) {
  const srcPath = path.join(ROOT, src);
  const dstPath = path.join(ROOT, dst);
  if (!existsSync(dstPath)) {
    copyFileSync(srcPath, dstPath);
    ok(`${dst} created from sample.`);
  } else {
    ok(`${dst} already exists — skipping copy.`);
  }
}

// ── 3. Inject secrets ───────────────────────────────────────────────────────
step("Checking secrets...");

const configPath = path.join(ROOT, "config.php");
let configContent = readFileSync(configPath, "utf8");
// Only regenerate if salt is still empty (first-time or after a reset)
const needsSecrets = configContent.includes("public static $salt='';");

let salt, dataApiKey, adminPassword;

if (needsSecrets) {
  salt          = hexSecret(24);
  const secret  = hexSecret(24);
  const gmSec   = hexSecret(24);
  const jsonSec = hexSecret(24);
  const sseSec  = hexSecret(24);
  dataApiKey    = hexSecret(32);
  adminPassword = hexSecret(12); // shown once at end of step 8

  // Patch config.php
  configContent = configContent
    .replace("public static $salt='';",             `public static $salt='${salt}';`)
    .replace("public static $secret='';",           `public static $secret='${secret}';`)
    .replace("public static $gameMasterSecret='';", `public static $gameMasterSecret='${gmSec}';`)
    .replace("public static $jsonSecret='';",       `public static $jsonSecret='${jsonSec}';`)
    .replace("public static $sseSecret = '';",      `public static $sseSecret = '${sseSec}';`);
  writeFileSync(configPath, configContent);
  ok("config.php — all 5 secrets generated and set.");

  // sse-server/.env
  const sseEnvPath = path.join(ROOT, "sse-server/.env");
  writeFileSync(sseEnvPath,
    readFileSync(sseEnvPath, "utf8").replace("SSE_SECRET=", `SSE_SECRET=${sseSec}`)
  );
  ok("sse-server/.env — SSE_SECRET set.");

  // data-service/.env
  const dsEnvPath = path.join(ROOT, "data-service/.env");
  writeFileSync(dsEnvPath,
    readFileSync(dsEnvPath, "utf8")
      .replace("DATA_API_KEY=changeme-internal-token", `DATA_API_KEY=${dataApiKey}`)
  );
  ok("data-service/.env — DATA_API_KEY set.");

  // Root .env — docker-compose reads this to override DATA_API_KEY default
  writeFileSync(
    path.join(ROOT, ".env"),
    `# docker-compose override — do NOT commit (gitignored)\nDATA_API_KEY=${dataApiKey}\n`
  );
  ok("Root .env — DATA_API_KEY set for docker-compose.");

  // tools/empirica/.env — add DATA_API section (WEBDIP_API_KEY filled in step 8)
  const empEnvPath = path.join(ROOT, "tools/empirica/.env");
  let empEnv = readFileSync(empEnvPath, "utf8");
  if (!empEnv.includes("DATA_API_URL")) {
    empEnv += `\n# Data API (internal)\nDATA_API_URL=http://localhost:4000\nDATA_API_KEY=${dataApiKey}\n`;
    writeFileSync(empEnvPath, empEnv);
    ok("tools/empirica/.env — DATA_API section added.");
  }
} else {
  // Secrets already set — read existing values for use in step 8
  const saltMatch = configContent.match(/public static \$salt='([^']+)'/);
  salt = saltMatch?.[1] ?? null;

  const dsEnvPath = path.join(ROOT, "data-service/.env");
  if (existsSync(dsEnvPath)) {
    const keyMatch = readFileSync(dsEnvPath, "utf8").match(/^DATA_API_KEY=(.+)$/m);
    dataApiKey = keyMatch?.[1]?.trim() ?? null;
  }
  ok("Secrets already configured — skipping generation.");
}

// ── 4. PHP dependencies via Docker ──────────────────────────────────────────
step("Checking PHP dependencies...");
const vendor = path.join(ROOT, "vendor", "autoload.php");
if (!existsSync(vendor)) {
  step("Installing PHP deps via Docker (first time, ~1 min)...");
  const vol  = `${ROOT}:/app`;
  const base = ["docker", "run", "--rm", "-v", vol, "-e", "COMPOSER_ALLOW_SUPERUSER=1", "composer:latest"];
  execSync([...base, "config", "--no-plugins", "policy.advisories.block", "false"].join(" "), { stdio: "pipe" });
  execSync([...base, "update", "--no-interaction"].join(" "), { cwd: ROOT, stdio: "inherit" });
  ok("PHP dependencies installed.");
} else {
  ok("PHP dependencies already installed.");
}

// ── 5. Start Docker containers ──────────────────────────────────────────────
step("Starting Docker containers...");
try {
  execSync("docker compose --profile core --profile dev up -d", { cwd: ROOT, stdio: "inherit" });
  // If secrets were just generated, recreate data-api so it picks up new DATA_API_KEY
  if (needsSecrets) {
    execSync("docker compose up -d --force-recreate data-api", { cwd: ROOT, stdio: "pipe" });
  }
  ok("Containers started.");
} catch {
  die("docker compose failed. Check output above.");
}

// ── 6. Apply research DB schema ─────────────────────────────────────────────
step("Applying research database schema (rs_* tables)...");
try {
  dbExec(readFileSync(path.join(ROOT, "install/research/rs_schema.sql"), "utf8"));
  ok("Research schema applied (IF NOT EXISTS — safe to re-run).");
} catch {
  warn("Schema apply failed — DB may not be ready. Will retry after wait, or re-run setup.");
}

// ── 7. Wait for webDiplomacy ────────────────────────────────────────────────
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

// ── 8. Create admin user + API key in DB ────────────────────────────────────
step("Setting up admin user and API key...");

let adminId, webdipApiKey;
try {
  // ── Admin user ────────────────────────────────────────────────────────────
  const adminExists = dbQuery("SELECT COUNT(*) FROM wD_Users WHERE username='admin';");
  if (adminExists === "0") {
    if (!salt || !adminPassword) die("Cannot create admin: salt or password unavailable. Re-run setup.");
    const passHash = webdipHash(salt, adminPassword);
    const now      = Math.floor(Date.now() / 1000);
    dbExec(`
      INSERT INTO wD_Users
        (username, email, points, hideEmail, timeJoined, locale,
         timeLastSessionEnded, lastMessageIDViewed, password, type, muteReports,
         ChanceEngland, ChanceFrance, ChanceItaly, ChanceGermany,
         ChanceAustria, ChanceRussia, ChanceTurkey,
         cdCount, nmrCount, cdTakenCount, phaseCount, gameCount,
         reliabilityRating, deletedCDs, emergencyPauseDate, yearlyPhaseCount, optInFeatures,
         missedPhasesLiveLastWeek, missedPhasesLiveLastMonth, missedPhasesLiveLastYear,
         missedPhasesNonLiveLastWeek, missedPhasesNonLiveLastMonth, missedPhasesNonLiveLastYear,
         missedPhasesTotalLastWeek, missedPhasesTotalLastMonth, missedPhasesTotalLastYear,
         isPhasesDirty)
      VALUES
        ('admin', 'admin@research.local', 100, 'No', ${now}, 'English',
         ${now}, 0, UNHEX('${passHash}'), 'Admin', 'No',
         0.142857, 0.142857, 0.142857, 0.142857,
         0.142857, 0.142857, 0.142857,
         0, 0, 0, 0, 0,
         100, 0, 0, 0, 0,
         0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    `);
    adminId = dbQuery("SELECT id FROM wD_Users WHERE username='admin';");
    ok(`Admin user created (id=${adminId}).`);
    console.log(yellow(`\n  ★ Admin password: ${adminPassword}`));
    console.log(yellow(`    Save this — it is only shown once.\n`));
  } else {
    adminId = dbQuery("SELECT id FROM wD_Users WHERE username='admin';");
    ok(`Admin user already exists (id=${adminId}).`);
  }

  // ── webDiplomacy API key ──────────────────────────────────────────────────
  const keyExists = dbQuery(`SELECT COUNT(*) FROM wD_ApiKeys WHERE userID=${adminId};`);
  if (keyExists === "0") {
    webdipApiKey = hexSecret(32);
    const now2   = Math.floor(Date.now() / 1000);
    dbExec(`
      INSERT INTO wD_ApiKeys
        (apiKey, userID, hits, lastHit, isChecked, description, label, username)
      VALUES
        ('${webdipApiKey}', ${adminId}, 0, ${now2}, 0,
         'Research platform AI runner key', 'empirica-research', 'admin');
      INSERT INTO wD_ApiPermissions
        (userID, getStateOfAllGames, submitOrdersForUserInCD, listGamesWithPlayersInCD,
         getRedactedMessages, submitOrdersForDelegatedMembers, submitMessages, voteDraw,
         playBotsVsHuman, playBotVsHuman, minimumPhaseLength, variantIDs)
      VALUES
        (${adminId}, 'Yes','Yes','Yes','Yes','Yes','Yes','Yes','Yes','Yes', 3600, '');
    `);
    ok("API key created with full research permissions.");
  } else {
    webdipApiKey = dbQuery(`SELECT apiKey FROM wD_ApiKeys WHERE userID=${adminId} LIMIT 1;`);
    ok("API key already exists.");
  }

  // ── Update tools/empirica/.env with WEBDIP_API_KEY ───────────────────────
  const empEnvPath = path.join(ROOT, "tools/empirica/.env");
  let empEnv = readFileSync(empEnvPath, "utf8");
  if (/WEBDIP_API_KEY=(your_api_key_here|PENDING_SETUP)?(\s|$)/.test(empEnv)) {
    empEnv = empEnv.replace(/WEBDIP_API_KEY=.*/, `WEBDIP_API_KEY=${webdipApiKey}`);
    writeFileSync(empEnvPath, empEnv);
    ok("tools/empirica/.env — WEBDIP_API_KEY set.");
  } else {
    ok("tools/empirica/.env — WEBDIP_API_KEY already set.");
  }
} catch (err) {
  warn(`DB setup step failed: ${err.message}`);
  warn("Re-run setup once all containers are healthy.");
}

// ── 9. Summary ───────────────────────────────────────────────────────────────
console.log(`
${green("══════════════════════════════════════════")}
${green("  Setup complete!")}
${green("══════════════════════════════════════════")}

  webDiplomacy   → ${cyan(WEBDIP_URL)}
  Admin login    → ${cyan(WEBDIP_URL + "/logon.php")}  (username: admin)
  phpMyAdmin     → ${cyan("http://localhost:43009")}
  Data API       → ${cyan("http://localhost:4000/health")}

  Next step: ${green("npm start")}
`);
