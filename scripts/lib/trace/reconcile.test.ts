/**
 * reconcile.test.ts — forecast reconciliation + candidate-policy divergence (cycle-012, Sprint 36; FR-2).
 * Convention: `npx tsx scripts/lib/trace/reconcile.test.ts`
 */
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus } from "./decision.ts";
import { extractRevealed } from "./revealed.ts";
import { reconcile, type ForecastDecisionMap, type CandidatePolicy } from "./reconcile.ts";
import { renderStrategyReport } from "./strategy-report.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, "__fixtures__", "ptcg-revealed");

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

const rp = extractRevealed(loadCorpus(FIXTURE));
const TURN_OPTIONS = ["ATTACH", "EVOLVE", "PLAY", "ABILITY", "ATTACK"];

test("revealed-dominant-line finding is always emitted (claim: observed)", () => {
  const r = reconcile(rp);
  const f = r.findings.find((x) => x.kind === "revealed-dominant-line");
  assert.ok(f, "expected a revealed-dominant-line finding");
  assert.equal(f!.claim, "real-agent-observed");
  assert.ok(f!.summary.includes("ATTACH > EVOLVE > PLAY > ABILITY > ATTACK"));
});

test("forecast 'balanced' on a near-pure turn → false-choice-MISSED (the headline)", () => {
  const forecast: ForecastDecisionMap = {
    claim: "model-forecast",
    points: [{ id: "main", description: "the main-phase turn", call: "balanced", options: TURN_OPTIONS }],
  };
  const r = reconcile(rp, forecast);
  const f = r.findings.find((x) => x.kind === "false-choice-missed");
  assert.ok(f, "expected a false-choice-missed finding");
  assert.ok(f!.summary.includes("near-pure ATTACH"));
});

test("forecast 'false-choice' on a near-pure turn → CONFIRMED", () => {
  const forecast: ForecastDecisionMap = {
    claim: "model-forecast",
    points: [{ id: "main", description: "the main-phase turn", call: "false-choice", options: TURN_OPTIONS }],
  };
  const r = reconcile(rp, forecast);
  assert.ok(r.findings.some((x) => x.kind === "false-choice-confirmed"));
});

test("forecast 'dominant' on a low-rate option → OVER-CALLED", () => {
  const forecast: ForecastDecisionMap = {
    claim: "model-forecast",
    points: [{ id: "atk", description: "attack choice", call: "dominant", options: ["ATTACK", "PLAY"], dominantType: "ATTACK" }],
  };
  const r = reconcile(rp, forecast);
  assert.ok(r.findings.some((x) => x.kind === "dominant-over-called"));
});

test("forecast 'dominant' on the actual dominant option → no-divergence", () => {
  const forecast: ForecastDecisionMap = {
    claim: "model-forecast",
    points: [{ id: "atc", description: "energy attach", call: "dominant", options: ["ATTACH", "ABILITY"], dominantType: "ATTACH" }],
  };
  const r = reconcile(rp, forecast);
  assert.ok(r.findings.some((x) => x.kind === "no-divergence"));
});

test("candidate policy mis-ranking ATTACH 6→1 is the TOP policy divergence", () => {
  const policy: CandidatePolicy = { id: "v1.1", ordering: ["ABILITY", "PLAY", "EVOLVE", "RETREAT", "ATTACK", "ATTACH"] };
  const r = reconcile(rp, undefined, policy);
  const divs = r.findings.filter((x) => x.kind === "policy-divergence");
  assert.ok(divs.length > 0, "expected policy-divergence findings");
  // ranked by |Δrank|: ATTACH (#6 candidate → #1 observed, Δ5) must be first
  assert.ok(divs[0].summary.includes("ATTACH"), `top divergence should be ATTACH: ${divs[0].summary}`);
  assert.ok(divs[0].evidence.includes("candidate #6 → observed #1"), divs[0].evidence);
});

test("small-N honesty: nFloor above the sample tags every finding withinNoise", () => {
  const r = reconcile(rp, undefined, undefined, { nFloor: 100 });
  assert.ok(r.findings.every((x) => x.withinNoise), "thin corpus must assert no direction");
});

test("report renders deterministically and carries the discipline legend", () => {
  const forecast: ForecastDecisionMap = {
    claim: "model-forecast",
    points: [{ id: "main", description: "the main-phase turn", call: "balanced", options: TURN_OPTIONS }],
  };
  const policy: CandidatePolicy = { id: "v1.1", ordering: ["ABILITY", "PLAY", "EVOLVE", "RETREAT", "ATTACK", "ATTACH"] };
  const a = renderStrategyReport(rp, reconcile(rp, forecast, policy));
  const b = renderStrategyReport(rp, reconcile(rp, forecast, policy));
  assert.equal(a, b, "report must be byte-deterministic");
  assert.ok(a.includes("## Revealed Strategy"));
  assert.ok(a.includes("Revealed ≠ optimal"));
  assert.ok(a.includes("[observed]"));
  assert.ok(a.includes("observed > simulation-derived > model-forecast"));
});

console.log("reconcile.test.ts: all passed");
