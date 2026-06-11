/**
 * context-provenance.test.ts — Sprint 2 (cycle-009): --context-value stamping + provenance
 * (FR-1.2, FR-4.2). Convention: `npx tsx scripts/lib/ladder/context-provenance.test.ts`
 *
 * Hermetic: no agent is spawned — resolveRunPlan/experimentMeta/buildProvenance/planLines are
 * exercised directly (the dry-run/stub posture, sdd §7.2).
 */
import assert from "node:assert";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRunPlan, experimentMeta, buildProvenance, planLines } from "./index.ts";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const FIXTURE = join(REPO, "evals", "awareness-ladder");

console.log("ladder — context-value stamping + provenance (cycle-009 Sprint 2)\n");

// ---- --context-value / --difficulty (FR-1.2) ----

test("run --context-value 8 stamps experiment.context value 8, manifest name kept", () => {
  const plan = resolveRunPlan(["--fixture", FIXTURE, "--context-value", "8"]);
  const meta = experimentMeta(plan);
  assert.strictEqual(meta.context.name, "difficulty", "name comes from the manifest");
  assert.strictEqual(meta.context.value, 8, "value comes from the flag");
});

test("--difficulty is an alias for --context-value", () => {
  const plan = resolveRunPlan(["--fixture", FIXTURE, "--difficulty", "2"]);
  assert.strictEqual(experimentMeta(plan).context.value, 2);
});

test("without the flag, the manifest value is stamped unchanged", () => {
  const plan = resolveRunPlan(["--fixture", FIXTURE]);
  assert.strictEqual(experimentMeta(plan).context.value, 4, "awareness-ladder manifest default");
  assert.ok(plan.contextValue === undefined);
});

test("a non-numeric --context-value is a LadderError", () => {
  assert.throws(() => resolveRunPlan(["--fixture", FIXTURE, "--context-value", "spicy"]), /finite number/);
});

test("dry-run plan lines surface the override (and omit it when absent)", () => {
  const withFlag = planLines(resolveRunPlan(["--fixture", FIXTURE, "--difficulty", "8"]));
  assert.ok(withFlag.some((l) => l.includes("context override: difficulty=8 (manifest default 4)")), "override line");
  const without = planLines(resolveRunPlan(["--fixture", FIXTURE]));
  assert.ok(!without.some((l) => l.includes("context override")), "no override line without the flag");
});

test("a manifest difficulty: block stays INERT to the engine (Arneson OQ-2 property)", () => {
  // A fixture whose manifest carries the Arneson-style sweep block: the loader must ignore it.
  const dir = mkdtempSync(join(tmpdir(), "inert-fixture-"));
  try {
    mkdirSync(join(dir, "task-template"));
    writeFileSync(
      join(dir, "manifest.yaml"),
      [
        "id: inert-test",
        "reward_command: [python3, test_solution.py]",
        "incentive_state: ./incentive-state",
        "context: { name: difficulty, value: 6 }",
        "difficulty: { knob: context.value, sweep: [2, 4, 6, 8, 10], default: 6 }",
        "rungs: [rung-0.md]",
        "trials_default: 1",
        "timeout_seconds: 10",
      ].join("\n") + "\n",
    );
    const plan = resolveRunPlan(["--fixture", dir]);
    assert.strictEqual(experimentMeta(plan).context.value, 6, "manifest context.value, not the sweep block");
    assert.ok(plan.contextValue === undefined, "no implicit selection from the difficulty block");
    const overridden = resolveRunPlan(["--fixture", dir, "--context-value", "10"]);
    assert.strictEqual(experimentMeta(overridden).context.value, 10, "only the explicit flag selects");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- provenance (FR-4.2) ----

test("agent_cmd_sha256 hashes the command TEMPLATE", () => {
  const cmd = "claude -p {promptfile} --max-turns 30";
  const prov = buildProvenance(cmd);
  assert.strictEqual(prov.agent_cmd_sha256, createHash("sha256").update(cmd).digest("hex"));
});

test("engine_git_sha is stamped best-effort inside the repo", () => {
  const prov = buildProvenance("x");
  assert.ok(prov.engine_git_sha && /^[0-9a-f]{40}$/.test(prov.engine_git_sha), "40-hex sha from git rev-parse");
});

test("engine_git_sha is OMITTED (run proceeds) when git resolution fails", () => {
  const noRepo = mkdtempSync(join(tmpdir(), "not-a-repo-"));
  try {
    const prov = buildProvenance("x", noRepo);
    assert.ok(!("engine_git_sha" in prov), "field omitted, never guessed");
    assert.ok(prov.agent_cmd_sha256, "template hash still present");
  } finally {
    rmSync(noRepo, { recursive: true, force: true });
  }
});

test("model_id / construct_sha are never stamped by the runner", () => {
  const prov = buildProvenance("x");
  assert.ok(!("model_id" in prov) && !("construct_sha" in prov), "omitting beats guessing");
});

console.log("\ncontext-provenance.test.ts: all tests passed");
