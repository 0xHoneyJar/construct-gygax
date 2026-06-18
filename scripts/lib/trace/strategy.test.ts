/**
 * strategy.test.ts — end-to-end golden for the revealed-strategy lens (cycle-012, Sprint 37; FR-3/FR-4).
 * Convention: `npx tsx scripts/lib/trace/strategy.test.ts`
 *
 * The PTCG fixture, run through the whole pipeline, must reproduce the three acceptance findings and
 * match the byte-for-byte golden. This is the cycle's proof (PRD §5).
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { analyzeStrategy } from "./strategy.ts";
import type { ForecastDecisionMap, CandidatePolicy } from "./reconcile.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FX = join(HERE, "__fixtures__", "ptcg-revealed");

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

const forecast = JSON.parse(readFileSync(join(FX, "forecast.json"), "utf8")) as ForecastDecisionMap;
const policy = JSON.parse(readFileSync(join(FX, "policy.json"), "utf8")) as CandidatePolicy;
const golden = readFileSync(join(FX, "expected", "strategy-report.md"), "utf8");

const { report, revealed, reconciliation } = analyzeStrategy(FX, forecast, policy);

test("FR-4: the three acceptance findings are reproduced", () => {
  // 1. ATTACH revealed #1
  assert.equal(revealed.overall.ordering[0], "ATTACH");
  // 2. the turn is a false choice in practice (forecast missed it)
  assert.ok(reconciliation.findings.some((f) => f.kind === "false-choice-missed" && f.summary.includes("ATTACH")));
  // 3. candidate policy mis-ranks ATTACH 6→1, as the top policy divergence
  const divs = reconciliation.findings.filter((f) => f.kind === "policy-divergence");
  assert.ok(divs[0].evidence.includes("ATTACH: candidate #6 → observed #1"), divs[0].evidence);
});

test("every finding is claim-tagged observed (never blended with forecast)", () => {
  assert.ok(reconciliation.findings.every((f) => f.claim === "real-agent-observed"));
});

test("end-to-end report matches the golden byte-for-byte", () => {
  assert.equal(report, golden);
});

test("pipeline is deterministic across runs", () => {
  const again = analyzeStrategy(FX, forecast, policy).report;
  assert.equal(again, report);
});

console.log("strategy.test.ts: all passed");
