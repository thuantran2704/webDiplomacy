/**
 * End-to-end test suite for the AI runner pipeline.
 * Mocks webDiplomacy API + Ollama so no live server is needed.
 * Run: node src/test.js
 */
import assert from "node:assert/strict";

// ── Minimal env so modules load ───────────────────────────────────────────────
process.env.WEBDIP_BASE_URL  = "http://localhost:43000";
process.env.WEBDIP_API_KEY   = "test-key";
process.env.AI_PROVIDER      = "ollama";
process.env.OLLAMA_BASE_URL  = "http://localhost:11434";
process.env.OLLAMA_MODEL     = "llama3";
process.env.RESEARCH_EXPORT_DIR = "./research-data-test";

import { validateOrders, buildPrompt, ORDER_TYPES } from "./orders.js";
import { checkLlmAllowed, recordLlmCall, applyMessageCap, resetTurnCounters } from "./ratelimit.js";

let passed = 0; let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}: ${e.message}`); failed++; }
}

// ── orders.js ────────────────────────────────────────────────────────────────
console.log("\norders.js");

const units = [
  { countryID: 2, terrID: 5, unitType: "Army",  retreating: "No" },
  { countryID: 2, terrID: 9, unitType: "Fleet", retreating: "No" },
];

test("valid Hold passes", () => {
  const { valid, errors } = validateOrders(
    [{ terrID: 5, type: "Hold", fromTerrID: null, toTerrID: null, viaConvoy: null, countryID: 2 }],
    "Diplomacy", 2, units
  );
  assert.equal(errors.length, 0);
  assert.equal(valid.length, 1);
});

test("valid Move passes", () => {
  const { valid, errors } = validateOrders(
    [{ terrID: 5, type: "Move", fromTerrID: null, toTerrID: 6, viaConvoy: null, countryID: 2 }],
    "Diplomacy", 2, units
  );
  assert.equal(errors.length, 0);
  assert.equal(valid.length, 1);
});

test("Move without toTerrID fails", () => {
  const { errors } = validateOrders(
    [{ terrID: 5, type: "Move", fromTerrID: null, toTerrID: null, viaConvoy: null, countryID: 2 }],
    "Diplomacy", 2, units
  );
  assert.ok(errors.length > 0);
});

test("wrong phase type rejected (Retreat in Diplomacy)", () => {
  const { errors } = validateOrders(
    [{ terrID: 5, type: "Retreat", fromTerrID: null, toTerrID: 6, viaConvoy: null, countryID: 2 }],
    "Diplomacy", 2, units
  );
  assert.ok(errors.length > 0);
});

test("unknown terrID rejected", () => {
  const { errors } = validateOrders(
    [{ terrID: 99, type: "Hold", fromTerrID: null, toTerrID: null, viaConvoy: null, countryID: 2 }],
    "Diplomacy", 2, units
  );
  assert.ok(errors.length > 0);
});

test("non-array orders returns error", () => {
  const { errors } = validateOrders("bad", "Diplomacy", 2, units);
  assert.ok(errors.length > 0);
});

test("buildPrompt includes phase + myUnits", () => {
  const prompt = buildPrompt({ status: { phase: "Diplomacy", turn: 1 }, units, territoryStatuses: [], currentOrders: [], messages: [], countryID: 2 });
  const obj = JSON.parse(prompt);
  assert.equal(obj.phase, "Diplomacy");
  assert.equal(obj.myUnits.length, 2);
});

test("ORDER_TYPES covers all three phases", () => {
  assert.ok(ORDER_TYPES.Diplomacy.includes("Move"));
  assert.ok(ORDER_TYPES.Retreats.includes("Disband"));
  assert.ok(ORDER_TYPES.Builds.includes("Build Army"));
});

// ── ratelimit.js ──────────────────────────────────────────────────────────────
console.log("\nratelimit.js");

test("LLM call allowed initially", () => {
  const { allowed } = checkLlmAllowed(1, 2);
  assert.ok(allowed);
});

test("LLM call blocked immediately after recording", () => {
  recordLlmCall(1, 3);
  const { allowed } = checkLlmAllowed(1, 3);
  assert.ok(!allowed);
});

test("message cap allows up to MAX_MESSAGES_PER_TURN", () => {
  const msgs = [{ to: 1, text: "a" }, { to: 2, text: "b" }, { to: 3, text: "c" }, { to: 4, text: "d" }];
  const { allowed, dropped } = applyMessageCap(1, 2, 5, msgs);
  assert.equal(allowed.length, 3);
  assert.equal(dropped, 1);
});

test("second call in same turn uses remaining cap", () => {
  // 3 already sent in turn 5 (from test above)
  const { allowed, dropped } = applyMessageCap(1, 2, 5, [{ to: 5, text: "e" }]);
  assert.equal(allowed.length, 0);
  assert.equal(dropped, 1);
});

test("reset clears old turn counters", () => {
  resetTurnCounters(1, 2, 6);
  const { allowed } = applyMessageCap(1, 2, 6, [{ to: 1, text: "x" }]);
  assert.equal(allowed.length, 1);
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
