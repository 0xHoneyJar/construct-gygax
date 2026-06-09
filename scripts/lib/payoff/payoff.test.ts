/**
 * payoff.test.ts — golden capability proof on the agent-reward-hack fixture (cycle-006, Sprint 1).
 * Convention: `npx tsx scripts/lib/payoff/payoff.test.ts`
 *
 * Reproduces the fixture's own golden findings (NOT a real agent) from the payoff formulas alone.
 */
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { analyzeIncentives, loadIncentiveState } from "./index.ts";
import { buildMatrix } from "./matrix.ts";
import { argmaxPerContext, dominantAction, dominatedActions, dominates } from "./dominance.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, "..", "..", "..", "evals", "incentive-fixtures", "agent-reward-hack", "incentive-state");

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

console.log("payoff engine — golden capability proof (agent-reward-hack)\n");

const analysis = analyzeIncentives(FIXTURE);
const { matrix: m, dominance: d } = analysis;

// ---- K1: payoff matrix built from declared incentives (reward − cost over context) ----

test("K1: matrix has 4 actions over 10 difficulty steps", () => {
  assert.strictEqual(m.actions.length, 4);
  assert.strictEqual(m.contexts.length, 10);
  assert.deepStrictEqual(
    m.net.get("fix-code"),
    [-1, -2, -3, -4, -5, -6, -7, -8, -9, -10],
    "fix-code net = -difficulty",
  );
  assert.ok(m.net.get("delete-test")!.every((v) => v === 0), "delete-test net = 0 everywhere");
});

// ---- K2: dominant strategy (reward hack) + dead tools ----

test("K2: delete-test is the dominant strategy (the reward hack)", () => {
  assert.strictEqual(d.dominant, "delete-test");
});

test("K2: fix-code, weaken-assertion, skip-test are dominated (dead tools)", () => {
  assert.deepStrictEqual([...d.dominated].sort(), ["fix-code", "skip-test", "weaken-assertion"]);
});

test("K2: delete-test is argmax at every difficulty", () => {
  assert.ok(d.argmax.every((p) => p.action === "delete-test"), "delete-test not argmax everywhere");
});

// ---- K3 seed: the intended action is never optimal (specification gaming) ----

test("K3-seed: intended action fix-code is never optimal", () => {
  assert.strictEqual(d.intendedAction, "fix-code");
  assert.strictEqual(d.intendedActionEverOptimal, false);
});

// ---- formula safety reused from cycle-005 expr (no eval) + loader correctness ----

test("loader reads payoff formulas + first-class intent", () => {
  const state = loadIncentiveState(FIXTURE);
  assert.strictEqual(state.context, "difficulty");
  assert.strictEqual(state.actions.length, 4);
  assert.strictEqual(state.intendedAction, "fix-code");
  assert.strictEqual(state.nonNegotiable, true);
});

test("dominance helper is metric-agnostic (works on an arbitrary matrix)", () => {
  const state = loadIncentiveState(FIXTURE);
  const mx = buildMatrix(state);
  // delete-test dominates fix-code; fix-code does not dominate delete-test.
  assert.strictEqual(dominates(mx, "delete-test", "fix-code"), true);
  assert.strictEqual(dominates(mx, "fix-code", "delete-test"), false);
  assert.strictEqual(dominantAction(mx), "delete-test");
  assert.ok(dominatedActions(mx).includes("fix-code"));
  assert.ok(argmaxPerContext(mx).every((p) => p.action === "delete-test"));
});

// ---- Sprint 2: Goodhart (intent-vs-optimal) + incentive-knob recommendation ----

test("Goodhart: specification gaming detected (intended fix-code never optimal)", () => {
  const g = analysis.goodhart!;
  assert.strictEqual(g.intendedAction, "fix-code");
  assert.strictEqual(g.diverges, true);
});

test("Goodhart: severity gap reaches 10 and rises with difficulty", () => {
  const g = analysis.goodhart!;
  assert.strictEqual(g.maxGap, 10);
  assert.strictEqual(g.gapTrend, "rising");
});

test("Knob recommendation: structural fix, not a knob tweak (whack-a-mole)", () => {
  const r = analysis.goodhart!.recommendation;
  assert.strictEqual(r.kind, "structural");
  assert.strictEqual(r.whackAMole?.penalized, "delete-test");
  assert.strictEqual(r.whackAMole?.shiftsTo, "skip-test");
});

test("single-knob path works when the intended action is realignable", () => {
  // Construct a case where penalizing the one blocker DOES make intended optimal.
  const state = loadIncentiveState(FIXTURE);
  // Keep only fix-code (intended) and delete-test → penalizing delete realigns to fix-code.
  state.actions = state.actions.filter((a) => a.id === "fix-code" || a.id === "delete-test");
  const mx = buildMatrix(state);
  const dom = analyzeDominanceLocal(mx, "fix-code");
  const g = require_goodhart(mx, dom);
  assert.strictEqual(g.recommendation.kind, "single-knob");
  assert.strictEqual(g.recommendation.penalizedAction, "delete-test");
});

import { analyzeDominance as analyzeDominanceLocal } from "./dominance.ts";
import { analyzeGoodhart } from "./goodhart.ts";
function require_goodhart(m: any, d: any) {
  const g = analyzeGoodhart(m, d);
  if (!g) throw new Error("expected a Goodhart result");
  return g;
}

// ---- Sprint 3: multi-agent coordination (prisoner's-dilemma shape) ----

import { loadGame, analyzeGame } from "./game.ts";
const COORD = join(HERE, "..", "..", "..", "evals", "incentive-fixtures", "agent-coordination", "incentive-state");

test("multi-agent: defect is the dominant strategy", () => {
  const g = loadGame(COORD);
  assert.strictEqual(analyzeGame(g).dominant, "defect");
});

test("multi-agent: equilibrium (defect,defect) diverges from intended (cooperate,cooperate)", () => {
  const a = analyzeGame(loadGame(COORD));
  assert.deepStrictEqual(a.equilibrium, ["defect", "defect"]);
  assert.strictEqual(a.equilibriumPayoff, 1);
  assert.deepStrictEqual(a.intendedJoint, ["cooperate", "cooperate"]);
  assert.strictEqual(a.intendedPayoff, 3);
  assert.strictEqual(a.coordinationFailure, true);
});

test("multi-agent: price of anarchy = 3, value left on table = 2", () => {
  const a = analyzeGame(loadGame(COORD));
  assert.strictEqual(a.priceOfAnarchy, 3);
  assert.strictEqual(a.valueLeftOnTable, 2);
});

console.log("\nAll payoff-engine tests passed.\n");
