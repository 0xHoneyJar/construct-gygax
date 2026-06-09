/**
 * rundir.test.ts — isolation + containment (cycle-007, Sprint 1).
 * Convention: `npx tsx scripts/lib/ladder/rundir.test.ts` (from the repo root)
 */
import assert from "node:assert";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createRunDir, assertInsideRunsRoot, LadderError } from "./rundir.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, "..", "..", "..", "evals", "awareness-ladder");
const RUNS_ROOT = join(FIXTURE, "runs");
const BATCH = "test-batch-rundir";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    rmSync(join(RUNS_ROOT, BATCH), { recursive: true, force: true });
    process.exit(1);
  }
}

console.log("ladder/rundir — isolation + containment\n");

rmSync(join(RUNS_ROOT, BATCH), { recursive: true, force: true }); // clean slate

test("createRunDir produces a fresh template copy", () => {
  const dir = createRunDir(FIXTURE, BATCH, 0, 1);
  assert.strictEqual(dir, join(RUNS_ROOT, BATCH, "rung-0", "trial-1"));
  for (const f of ["solution.py", "test_solution.py"]) {
    assert.ok(existsSync(join(dir, f)), `${f} copied`);
    assert.strictEqual(
      readFileSync(join(dir, f), "utf8"),
      readFileSync(join(FIXTURE, "task-template", f), "utf8"),
      `${f} byte-identical to template`,
    );
  }
});

test("createRunDir throws LadderError on an existing target (no-clobber)", () => {
  assert.throws(
    () => createRunDir(FIXTURE, BATCH, 0, 1),
    (e: unknown) => e instanceof LadderError && /already exists/.test((e as Error).message),
  );
});

test("sibling trials do not collide", () => {
  const dir = createRunDir(FIXTURE, BATCH, 0, 2);
  assert.ok(existsSync(join(dir, "solution.py")));
});

test("createRunDir rejects a traversal batch id", () => {
  assert.throws(
    () => createRunDir(FIXTURE, "../../escape", 0, 1),
    (e: unknown) => e instanceof LadderError && /escapes the runs root/.test((e as Error).message),
  );
});

test("assertInsideRunsRoot accepts paths inside the root", () => {
  assertInsideRunsRoot(join(RUNS_ROOT, "b", "rung-1", "trial-3"), RUNS_ROOT);
  assertInsideRunsRoot(RUNS_ROOT, RUNS_ROOT); // the root itself is inside
});

test("assertInsideRunsRoot rejects paths outside the root", () => {
  for (const bad of [
    join(FIXTURE, "task-template"), // sibling of runs/
    "/tmp/elsewhere",
    join(RUNS_ROOT, "..", "task-template"), // traversal back out
  ]) {
    assert.throws(
      () => assertInsideRunsRoot(bad, RUNS_ROOT),
      (e: unknown) => e instanceof LadderError && /escapes the runs root/.test((e as Error).message),
      `should reject: ${bad}`,
    );
  }
});

test("assertInsideRunsRoot rejects a prefix-sibling (runs-evil/)", () => {
  assert.throws(
    () => assertInsideRunsRoot(RUNS_ROOT + "-evil/x", RUNS_ROOT),
    (e: unknown) => e instanceof LadderError,
  );
});

test("default runs root is evals/awareness-ladder/runs (repo-root cwd convention)", () => {
  assertInsideRunsRoot(resolve("evals", "awareness-ladder", "runs", "x")); // inside → ok
  assert.throws(() => assertInsideRunsRoot(resolve("evals", "awareness-ladder", "task-template")));
});

rmSync(join(RUNS_ROOT, BATCH), { recursive: true, force: true }); // cleanup

console.log("\nrundir.test.ts: all tests passed");
