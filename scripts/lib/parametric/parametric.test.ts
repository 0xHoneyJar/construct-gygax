/**
 * parametric.test.ts — golden capability proof on the A.0 fixture (B.9): K1, K2, K3, K5.
 * Convention: `npx tsx scripts/lib/parametric/parametric.test.ts`
 *
 * Asserts the engine reproduces the fixture's own golden expected/ values (NOT carmack's) from the
 * `model:` formulas alone. The fixture is `evals/fixtures/parametric-depth-scaling/`.
 */
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runSweep, loadGameState } from "./index.ts";
import { sweepMetrics, validateDomain, DomainError } from "./sweep.ts";
import { detectSpikes } from "./crossover.ts";
import { rankKnobs } from "./sensitivity.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, "..", "..", "..", "evals", "fixtures", "parametric-depth-scaling", "game-state");

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

console.log("parametric engine — golden capability proof (A.0 fixture)\n");

const result = runSweep(FIXTURE);
const byId = new Map(result.series.map((s) => [s.id, s]));

// ---- K1: formulas evaluated safely (floor/min/max), engine ran without eval ----

test("K1: swept the fixture models (floor/min/max) without eval", () => {
  const armor = byId.get("enemy_armor");
  assert.ok(armor, "enemy_armor series missing");
  assert.strictEqual(armor.samples.length, 20, "expected 20 integer steps");
  assert.deepStrictEqual(
    armor.samples.map((s) => s.value),
    [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4],
    "enemy_armor stair-step mismatch",
  );
});

// ---- K2: declared-threshold first-crossings at the AUTHORED axis points ----

test("K2: time_to_kill > 8 first crosses at wave 5", () => {
  const c = result.crossovers.find((c) => c.metric === "time_to_kill" && c.value === 8);
  assert.ok(c, "time_to_kill threshold not found");
  assert.strictEqual(c.x, 5);
});

test("K2: incoming_per_kill > 120 first crosses at wave 16", () => {
  const c = result.crossovers.find((c) => c.metric === "incoming_per_kill" && c.value === 120);
  assert.ok(c, "incoming_per_kill threshold not found");
  assert.strictEqual(c.x, 16);
});

// ---- K3: threshold-free spike on time_to_kill at wave 16; NO spike on the stair-step series ----

test("K3: time_to_kill spikes at wave 16 (+28), and only there", () => {
  const spikes = result.spikes.filter((s) => s.metric === "time_to_kill");
  assert.strictEqual(spikes.length, 1, `expected exactly one TTK spike, got ${spikes.length}`);
  assert.strictEqual(spikes[0].x, 16);
  assert.strictEqual(spikes[0].jump, 28);
});

test("K3: the enemy_armor stair-step series is NOT spike-flagged", () => {
  const spikes = result.spikes.filter((s) => s.metric === "enemy_armor");
  assert.strictEqual(spikes.length, 0, "floor stair-steps were wrongly flagged as spikes");
});

test("K3: the +2 armor-kink in TTK is not flagged (only the envelope spike is)", () => {
  const ttk = byId.get("time_to_kill")!;
  const spikes = detectSpikes(ttk);
  assert.strictEqual(spikes.every((s) => s.x === 16), true, "a non-envelope kink was flagged");
});

// ---- K5: tunability framing present for engine-default AND structural ----

test("K5: structural damage-formula and engine-default entities are tagged", () => {
  const structural = result.tags.find((t) => t.id === "damage-formula");
  assert.ok(structural, "damage-formula tag missing");
  assert.strictEqual(structural.tunability, "structural");
  const eng = result.tags.find((t) => t.id === "player-attack");
  assert.strictEqual(eng?.tunability, "engine-default");
});

// ---- metric-agnostic: the engine read the fixture's own metricDefs, no hard-coded names ----

test("engine is metric-agnostic (drives off the fixture's declared metricDefs)", () => {
  const loaded = loadGameState(FIXTURE);
  assert.ok(loaded.metricDefs.some((m) => m.id === "time_to_kill"), "metricDefs not loaded from game-state");
  // sweepMetrics works on arbitrary metric ids — re-run with a renamed metric to prove no hard-coding.
  const renamed = loaded.metricDefs.map((m) =>
    m.id === "time_to_kill" ? { ...m, id: "kill_time" } : m,
  ).map((m) => ({ ...m, formula: m.formula.replace(/time_to_kill/g, "kill_time") }));
  const series = sweepMetrics(loaded.models, renamed);
  assert.ok(series.find((s) => s.id === "kill_time"), "renamed metric not produced — engine hard-codes a name");
});

// ---- domain validation + honest non-crossing ----

test("rejects an open/degenerate domain with DomainError", () => {
  assert.throws(() => validateDomain({ min: 5, max: 5 }), DomainError);
  assert.throws(() => validateDomain({ min: 1, max: Infinity }), DomainError);
});

test("a threshold that never holds reports x = null (no fabricated crossing)", () => {
  const ttk = byId.get("time_to_kill")!;
  const c = detectNoCross(ttk);
  assert.strictEqual(c, null);
});

import { firstCrossing } from "./crossover.ts";
function detectNoCross(series: { id: string; samples: { x: number; value: number }[] } & any) {
  const c = firstCrossing(series, { metric: series.id, op: ">", value: 99999 });
  return c.x;
}

// ---- FR-2 (Sprint C): knob surfacing — K4, L4, L7, structural exclusion ----

test("K4: knob ranking is unambiguous — enemy-armor dominant, player-attack second", () => {
  const k = result.knobs!;
  assert.strictEqual(k.knobs[0].id, "enemy-armor");
  assert.strictEqual(k.knobs[0].leverage, 51);
  assert.strictEqual(k.knobs[1].id, "player-attack");
  assert.strictEqual(k.knobs[1].leverage, 40);
});

test("K4: ranking is stable across runs", () => {
  const a = runSweep(FIXTURE).knobs!.knobs.map((k) => k.id);
  const b = runSweep(FIXTURE).knobs!.knobs.map((k) => k.id);
  assert.deepStrictEqual(a, b);
});

test("L4: crossover-mover column — armor moves crossing −1, player-attack +2", () => {
  const k = result.knobs!;
  assert.strictEqual(k.knobs.find((x) => x.id === "enemy-armor")!.crossoverShift, -1);
  assert.strictEqual(k.knobs.find((x) => x.id === "player-attack")!.crossoverShift, 2);
});

test("L7: inert player-max-hp escalates to a balance finding, NOT a knob", () => {
  const k = result.knobs!;
  assert.ok(k.findings.some((f) => f.id === "player-max-hp" && f.kind === "inert-lever"), "L7 finding missing");
  assert.ok(!k.knobs.some((x) => x.id === "player-max-hp"), "inert lever wrongly ranked as a knob");
});

test("structural invariants are never proposed as knobs", () => {
  // The fixture's structural entity (damage-formula) isn't a model, so it's never a candidate.
  assert.ok(!result.knobs!.knobs.some((x) => x.id === "damage-formula"));
  // And a model explicitly tagged structural is excluded from perturbation.
  const loaded = loadGameState(FIXTURE);
  const withStructural = [
    ...loaded.models,
    { id: "core-floor", variable: "wave", domain: { min: 1, max: 20 }, formula: "max(1, wave - 5)", tunability: "structural" as const },
  ];
  const r = rankKnobs(withStructural, loaded.metricDefs, { primaryMetric: "time_to_kill", delta: 1 });
  assert.ok(r.excludedStructural.includes("core-floor"), "structural model not excluded");
  assert.ok(!r.knobs.some((x) => x.id === "core-floor"), "structural model wrongly proposed as a knob");
});

test("low-primary-leverage knobs are flagged, not buried (FR-4 bridge)", () => {
  const ea = result.knobs!.knobs.find((x) => x.id === "enemy-attack")!;
  assert.ok(ea.secondaryNote && ea.secondaryNote.includes("incoming_per_kill"), "secondary leverage not flagged");
});

console.log("\nAll parametric golden-capability tests passed.\n");
