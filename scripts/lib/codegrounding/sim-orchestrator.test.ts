/**
 * sim-orchestrator.test.ts — F2 integration tests (Sprint 3, Task 3.4).
 *
 * Sprint 3 ACs (grimoires/loa/sprint.md:L188-193):
 *   - scenario surfaced for approval BEFORE execution; a run before approval is BLOCKED
 *   - inputs constructed via the gygaxDriver contract, not by guessing signatures
 *   - execution happens inside the sandbox (network denied, capped)
 *   - output is a real distribution labeled with the approved scenario
 *
 * Convention: `npx tsx scripts/lib/codegrounding/sim-orchestrator.test.ts`
 */
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { analyze } from "./static-analyzer.ts";
import { detectDriver } from "./driver-detect.ts";
import {
  proposeScenario,
  approveScenario,
  runSimulation,
  ScenarioNotApprovedError,
} from "./sim-orchestrator.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, "__fixtures__", "drift-engine");
const REF = join(HERE, "__fixtures__", "reference-engine");

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    failures.push(name);
  }
}

async function main() {
  console.log("sim-orchestrator.ts (F2)\n");

  // ---- proposal ----

  await test("proposeScenario derives an entry fn + label from the structural map", () => {
    const spec = proposeScenario(analyze(ENGINE), { runs: 10, actor: "a" });
    assert.strictEqual(spec.via, "gygaxDriver");
    // drift-engine's only traced hub is resolveClash/applyCondition
    assert.ok(["resolveClash", "applyCondition"].includes(spec.entryFn), spec.entryFn);
    assert.match(spec.label, /self-play \(actor=a\)/);
    assert.strictEqual(spec.runs, 10);
    assert.strictEqual(spec.approvedBy, undefined, "fresh scenario must be unapproved");
  });

  // ---- THE GATE ----

  await test("GATE: runSimulation refuses an unapproved scenario", async () => {
    const det = detectDriver(REF);
    assert.strictEqual(det.found, true);
    if (!det.found) return;
    const spec = proposeScenario(analyze(REF), { runs: 5 }); // unapproved
    await assert.rejects(
      () => runSimulation(spec, { repoPath: REF, driverModule: det.module }),
      (e: unknown) => e instanceof ScenarioNotApprovedError,
    );
  });

  await test("approveScenario sets approvedBy without mutating the original", () => {
    const spec = proposeScenario(analyze(REF), { runs: 5 });
    const approved = approveScenario(spec, "gumi");
    assert.strictEqual(approved.approvedBy, "gumi");
    assert.strictEqual(spec.approvedBy, undefined, "original was mutated");
  });

  // ---- real sandboxed sim ----

  await test("approved sim runs through the driver → labeled distribution", async () => {
    const det = detectDriver(REF);
    assert.strictEqual(det.found, true);
    if (!det.found) return;
    const spec = approveScenario(
      proposeScenario(analyze(REF), { runs: 40, actor: "a", maxSteps: 50 }),
      "gumi",
    );
    const dist = await runSimulation(spec, {
      repoPath: REF,
      driverModule: det.module,
      seed: 7,
    });

    // labeled with the approved scenario (AC)
    assert.strictEqual(dist.scenarioLabel, spec.label);
    assert.strictEqual(dist.n, 40);

    // a real distribution from the actual engine: NimLite from pile 5, taking 1–3 per move,
    // terminates in 2..5 steps. The default metric is steps-to-terminal.
    assert.ok(dist.stats.mean >= 2 && dist.stats.mean <= 5, `mean ${dist.stats.mean} out of range`);
    assert.ok(dist.stats.p90 >= dist.stats.p50, "p90 < p50");
    assert.ok(dist.histogram.length > 0, "empty histogram");
    for (const h of dist.histogram) {
      assert.ok((h.bucket as number) >= 2 && (h.bucket as number) <= 5, `bucket ${h.bucket} impossible`);
    }
    const total = dist.histogram.reduce((s, h) => s + h.count, 0);
    assert.strictEqual(total, 40, "histogram counts must sum to n");
  });

  await test("seeded sim is reproducible (same seed → same distribution)", async () => {
    const det = detectDriver(REF);
    if (!det.found) return;
    const mk = () =>
      approveScenario(proposeScenario(analyze(REF), { runs: 20, actor: "a" }), "gumi");
    const a = await runSimulation(mk(), { repoPath: REF, driverModule: det.module, seed: 99 });
    const b = await runSimulation(mk(), { repoPath: REF, driverModule: det.module, seed: 99 });
    assert.deepStrictEqual(a.stats, b.stats, "same seed produced different stats");
  });

  console.log(`\n${passed} passed, ${failures.length} failed.`);
  if (failures.length > 0) {
    console.error("FAILURES:", failures.join(", "));
    process.exit(1);
  }
  console.log("All F2 sim-orchestrator tests passed.\n");
}

void main();
