/**
 * static-analyzer.test.ts — F1 analyzer + reconciler unit tests (Sprint 2, Task 2.4).
 *
 * Sprint 2 ACs (grimoires/loa/sprint.md:L134-138):
 *   - numeric drift reported with both values + source
 *   - structural loops asserted ONLY with a citation; untraceable → silentOn, never asserted
 *   - intent never overwritten silently (leads: "undecided")
 *   - 100% of structural deltas carry a source (invariant)
 *
 * Convention: `npx tsx scripts/lib/codegrounding/static-analyzer.test.ts`
 */
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { analyze } from "./static-analyzer.ts";
import { reconcile, reconcileModel, type GameStateModel } from "./drift-reconciler.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, "__fixtures__", "drift-engine");
const GAMESTATE = join(HERE, "__fixtures__", "drift-gamestate");

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

console.log("static-analyzer.ts + drift-reconciler.ts\n");

const map = analyze(ENGINE);

// ---- analyzer: numbers ----

test("extracts the literal numeric value with a citation", () => {
  const fire = map.numbers.find((n) => n.name === "FIRE_BASE_DAMAGE");
  assert.ok(fire, "FIRE_BASE_DAMAGE not found");
  assert.strictEqual(fire!.value, 12);
  assert.match(fire!.source, /combat\.ts:\d+/);
  assert.strictEqual(fire!.kind, "literal");
});

test("extracts numeric leaves from JSON tables with the file as source", () => {
  const j = map.numbers.find((n) => n.name === "fire.base_damage" && n.kind === "json");
  assert.ok(j, "json number not found");
  assert.strictEqual(j!.value, 12);
  assert.match(j!.source, /affinities\.json/);
});

// ---- analyzer: certain-only loops ----

test("asserts the certain call edge with a citation", () => {
  const edge = map.loops.find((l) => l.from === "resolveClash" && l.to === "applyCondition");
  assert.ok(edge, "certain edge missing");
  assert.strictEqual(edge!.confidence, "certain");
  assert.match(edge!.source, /combat\.ts:\d+/);
});

test("SILENCE: reactive/dynamic calls are NOT asserted as loops", () => {
  // No loop may originate from the reactive or dynamic-dispatch functions.
  assert.ok(!map.loops.some((l) => l.from === "tickReactive"), "reactive call wrongly asserted");
  assert.ok(
    !map.loops.some((l) => l.from === "dispatchDynamic"),
    "dynamic dispatch wrongly asserted",
  );
});

test("untraceable sites are RECORDED (not silently dropped)", () => {
  assert.ok(
    map.untraceable.some((u) => /subscribe/.test(u.reason)),
    "reactive subscription not recorded",
  );
  assert.ok(
    map.untraceable.some((u) => /dynamic dispatch/.test(u.reason)),
    "dynamic dispatch not recorded",
  );
});

test("every asserted loop carries a confidence of 'certain'", () => {
  for (const l of map.loops) assert.strictEqual(l.confidence, "certain");
});

// ---- reconciler: drift vs game-state ----

const report = reconcile(map, GAMESTATE);

test("numeric drift reports BOTH values + the code source", () => {
  const d = report.numericDeltas.find((x) => /base_damage/.test(x.field));
  assert.ok(d, "base_damage delta missing");
  assert.strictEqual(d!.code, 12);
  assert.strictEqual(d!.gameState, 10);
  assert.match(d!.source, /affinities\.json|combat\.ts/);
});

test("intent is never overwritten silently — leads stays 'undecided'", () => {
  for (const d of report.numericDeltas) assert.strictEqual(d.leads, "undecided");
});

test("structural delta surfaces the traced loop game-state omits", () => {
  const s = report.structuralDeltas.find((x) => /resolveClash → applyCondition/.test(x.claim));
  assert.ok(s, "structural delta missing");
  assert.strictEqual(s!.inCode, true);
  assert.strictEqual(s!.inGameState, false);
});

test("INVARIANT: 100% of structural deltas carry a source citation", () => {
  for (const s of report.structuralDeltas) {
    assert.ok(s.source && s.source.length > 0, `uncited structural delta: ${s.claim}`);
  }
});

test("untraceable wiring lands in silentOn, never in structuralDeltas", () => {
  assert.ok(report.silentOn.length >= 2, "expected untraceable sites in silentOn");
  for (const s of report.structuralDeltas) {
    assert.ok(!/subscribe|dynamic dispatch/.test(s.claim), "untraceable leaked into a claim");
  }
});

// ---- reconciler: pure-model behavior (precision: code-only numbers are not deltas) ----

test("a code-only number (absent in game-state) is NOT reported as drift", () => {
  const gs: GameStateModel = { numbers: [{ name: "unrelated", value: 1 }], relationships: [] };
  const r = reconcileModel(map, gs);
  assert.strictEqual(r.numericDeltas.length, 0, "false positive on code-only numbers");
});

test("agreement produces no structural delta", () => {
  const gs: GameStateModel = {
    numbers: [],
    relationships: [{ from: "resolveClash", to: "applyCondition" }],
  };
  const r = reconcileModel(map, gs);
  assert.strictEqual(
    r.structuralDeltas.some((s) => /resolveClash/.test(s.claim)),
    false,
    "agreement wrongly reported as drift",
  );
});

console.log("\nAll F1 analyzer + reconciler tests passed.\n");
