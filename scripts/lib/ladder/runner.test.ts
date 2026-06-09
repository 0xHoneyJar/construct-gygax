/**
 * runner.test.ts — agent runner against STUB agents (cycle-007, Sprint 3).
 * Convention: `npx tsx scripts/lib/ladder/runner.test.ts`
 *
 * No real agent in `npm test` (sdd.md §7 determinism). Stub "agents" are tiny executable
 * scripts written to a temp dir; each deterministically edits/sleeps/exits to exercise one
 * RunResult branch. Run dirs are created under the real runs root (containment) + cleaned up.
 * The agent command template points at a stub: `<stub-path> {promptfile}`.
 */
import assert from "node:assert";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runAgent, buildArgv, DEFAULT_AGENT_CMD } from "./runner.ts";
import { createRunDir, LadderError } from "./rundir.ts";
import { planLines, resolveRunPlan } from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, "..", "..", "..", "evals", "awareness-ladder");
const RUNS_ROOT = join(FIXTURE, "runs");
const BATCH = "test-batch-runner";

const stubRoot = mkdtempSync(join(tmpdir(), "ladder-stub-"));
function stub(name: string, body: string): string {
  const p = join(stubRoot, name);
  writeFileSync(p, `#!/bin/sh\n${body}\n`);
  chmodSync(p, 0o755);
  return p;
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    rmSync(join(RUNS_ROOT, BATCH), { recursive: true, force: true });
    rmSync(stubRoot, { recursive: true, force: true });
    process.exit(1);
  }
}

rmSync(join(RUNS_ROOT, BATCH), { recursive: true, force: true });
let n = 0;
const freshDir = () => createRunDir(FIXTURE, BATCH, 0, ++n);

console.log("ladder/runner — stub-agent behavior\n");

// ---- buildArgv (command templating) ----

test("buildArgv substitutes {promptfile} (path) as a single token", () => {
  assert.deepStrictEqual(buildArgv("agent --file {promptfile}", "/x/p.md", "CONTENTS"), ["agent", "--file", "/x/p.md"]);
});

test("buildArgv substitutes {prompt} (contents) as ONE token even with whitespace/newlines", () => {
  assert.deepStrictEqual(buildArgv("claude -p {prompt} --flag", "/x/p.md", "line one\nline two now"), ["claude", "-p", "line one\nline two now", "--flag"]);
});

test("buildArgv handles {promptfile} embedded in a token", () => {
  assert.deepStrictEqual(buildArgv("agent --prompt={promptfile}", "/x/p.md", "C"), ["agent", "--prompt=/x/p.md"]);
});

test("buildArgv throws without any placeholder", () => {
  assert.throws(() => buildArgv("claude -p", "/x", "C"), (e: unknown) => e instanceof LadderError && /placeholder/.test((e as Error).message));
});

test("buildArgv throws on an empty template", () => {
  assert.throws(() => buildArgv("   ", "/x", "C"), (e: unknown) => e instanceof LadderError && /empty/.test((e as Error).message));
});

test("DEFAULT_AGENT_CMD carries the {prompt} placeholder", () => {
  assert.ok(DEFAULT_AGENT_CMD.includes("{prompt}"));
});

// ---- runAgent: the four status branches ----

test("completed: stub exits 0, narration = its stdout, exitCode 0", () => {
  const s = stub("ok.sh", 'echo "stub ran, prompt=$1"; exit 0');
  const r = runAgent(freshDir(), "/the/prompt.md", `${s} {promptfile}`, 30);
  assert.strictEqual(r.status, "completed");
  assert.strictEqual(r.exitCode, 0);
  assert.ok(r.narration.includes("stub ran, prompt=/the/prompt.md"), "narration captured + placeholder substituted");
  assert.ok(r.durationMs >= 0);
});

test("completed: stub exits nonzero → still completed, exitCode preserved (scorer decides pass/fail)", () => {
  const s = stub("exit3.sh", "exit 3");
  const r = runAgent(freshDir(), "/p", `${s} {promptfile}`, 30);
  assert.strictEqual(r.status, "completed");
  assert.strictEqual(r.exitCode, 3);
});

test("timeout: a stub that sleeps past the timeout → status timeout, exitCode null", () => {
  const s = stub("hang.sh", "sleep 10");
  const r = runAgent(freshDir(), "/p", `${s} {promptfile}`, 1);
  assert.strictEqual(r.status, "timeout");
  assert.strictEqual(r.exitCode, null);
  assert.ok(r.durationMs < 5000, "killed near the 1s timeout, not after the full 10s sleep");
});

test("runner-error: a nonexistent agent binary → status runner-error, exitCode null", () => {
  const r = runAgent(freshDir(), "/p", `${join(stubRoot, "does-not-exist-xyz")} {promptfile}`, 30);
  assert.strictEqual(r.status, "runner-error");
  assert.strictEqual(r.exitCode, null);
});

test("{prompt}: a stub receives the prompt file CONTENTS as argv (not the path)", () => {
  const s = stub("echo-arg.sh", 'printf "%s" "$1" > captured.txt');
  const promptPath = join(stubRoot, "rung.md");
  writeFileSync(promptPath, "make this work\nedit files here");
  const dir = freshDir();
  const r = runAgent(dir, promptPath, `${s} {prompt}`, 30);
  assert.strictEqual(r.status, "completed");
  assert.strictEqual(readFileSync(join(dir, "captured.txt"), "utf8"), "make this work\nedit files here", "contents, not path, passed as one arg");
});

test("runAgent edits in cwd = the run dir (agent really touches files)", () => {
  const s = stub("edit.sh", 'echo "# edited by stub" >> solution.py');
  const dir = freshDir();
  const r = runAgent(dir, "/p", `${s} {promptfile}`, 30);
  assert.strictEqual(r.status, "completed");
  assert.ok(readFileSync(join(dir, "solution.py"), "utf8").includes("# edited by stub"), "stub wrote into the run dir");
});

test("runAgent refuses a run dir outside the runs root (containment)", () => {
  const s = stub("ok2.sh", "exit 0");
  assert.throws(
    () => runAgent(join(FIXTURE, "task-template"), "/p", `${s} {promptfile}`, 30),
    (e: unknown) => e instanceof LadderError && /escapes the runs root/.test((e as Error).message),
  );
});

// ---- --dry-run plan output (Task 3.2) ----

test("planLines lists every rung×trial + the resolved command, spawning nothing", () => {
  const plan = resolveRunPlan(["--fixture", FIXTURE, "--rungs", "0,1,2", "--trials", "5", "--agent-cmd", "claude -p {promptfile}"]);
  const lines = planLines(plan);
  assert.ok(lines[1].includes("claude -p {promptfile}"), "resolved command shown");
  assert.ok(lines.some((l) => l.includes("3 rungs × 5 trials = 15 runs")));
  const trialLines = lines.filter((l) => /rung \d+ \(\w/.test(l) && l.includes("trial"));
  assert.strictEqual(trialLines.length, 15, "one plan line per run");
  assert.ok(trialLines.some((l) => l.includes("rung 2 (adversarial) trial 5")));
});

test("resolveRunPlan defaults rungs/trials/timeout from the manifest", () => {
  const plan = resolveRunPlan(["--fixture", FIXTURE]);
  assert.deepStrictEqual(plan.rungs, [0, 1, 2]);
  assert.strictEqual(plan.trials, 5);
  assert.strictEqual(plan.timeoutSec, 300);
  assert.strictEqual(plan.agentCmd, DEFAULT_AGENT_CMD);
});

test("resolveRunPlan rejects an unknown flag", () => {
  assert.throws(() => resolveRunPlan(["--bogus", "x"]), (e: unknown) => e instanceof LadderError);
});

rmSync(join(RUNS_ROOT, BATCH), { recursive: true, force: true });
rmSync(stubRoot, { recursive: true, force: true });
assert.ok(!existsSync(join(RUNS_ROOT, BATCH)), "runs cleaned up");

console.log("\nrunner.test.ts: all tests passed");
