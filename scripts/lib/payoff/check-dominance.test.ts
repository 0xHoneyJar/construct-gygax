/**
 * check-dominance.test.ts — verdict semantics + CLI contract (cycle-009, Sprint 3; FR-2.1).
 * Convention: `npx tsx scripts/lib/payoff/check-dominance.test.ts`
 *
 * Pure-function semantics per sdd §5.1: `hack-dominates` iff some non-intended action's
 * net >= intendedNet (EPS = 1e-9) at some integer context step, scanning contexts ascending;
 * `indeterminate` on missing intent / no candidate hacks — exit 0 at the CLI (all three
 * verdicts), exit 1 only on IncentiveError. Cross-implementation conformance on the vendored
 * dungeon fixture lives in evals/vendor/conformance.test.ts.
 */
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { analyzeIncentives } from "./index.ts";
import { checkDominance } from "./check-dominance.ts";
import { buildMatrix, type IncentiveState } from "./matrix.ts";
import { analyzeDominance } from "./dominance.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const DUNGEON_STATE = join(REPO, "evals", "vendor", "arneson", "fixtures", "dungeon-crawl", "incentive-state");
const PAYOFF_CLI = join("scripts", "lib", "payoff", "index.ts");

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

/** Build an IncentiveAnalysis from a synthetic state (matrix + dominance, no goodhart). */
function analysisOf(state: IncentiveState) {
  const matrix = buildMatrix(state);
  return { matrix, dominance: analyzeDominance(matrix, state.intendedAction) };
}

const mkState = (actions: IncentiveState["actions"], intendedAction?: string): IncentiveState => ({
  context: "difficulty",
  domain: { min: 1, max: 5 },
  actions,
  intendedAction,
});

console.log("payoff — checkDominance verdict semantics (cycle-009 Sprint 3)\n");

// ---- hack-dominates on the vendored dungeon incentive-state ----

test("dungeon state → hack-dominates with the first ascending (context, action) point", () => {
  const check = checkDominance(analyzeIncentives(DUNGEON_STATE));
  assert.strictEqual(check.verdict, "hack-dominates");
  assert.strictEqual(check.intendedAction, "fight-through");
  assert.ok(check.point, "dominating point present");
  // contexts scan ascending: edit-world (net 0.95) already >= fight-through (0.88) at d=1
  assert.strictEqual(check.point!.context, 1);
  assert.strictEqual(check.point!.action, "edit-world");
  assert.ok(Math.abs(check.point!.net - 0.95) < 1e-12, `net ${check.point!.net}`);
  assert.ok(Math.abs(check.point!.intendedNet - 0.88) < 1e-12, `intendedNet ${check.point!.intendedNet}`);
  assert.strictEqual(check.reason, undefined, "no reason on a determinate verdict");
});

// ---- no-dominance ----

test("intended action strictly best everywhere → no-dominance (no point, no reason)", () => {
  const check = checkDominance(
    analysisOf(
      mkState(
        [
          { id: "honest", reward: "10", cost: "0" },
          { id: "cheat", reward: "1", cost: "0" },
        ],
        "honest",
      ),
    ),
  );
  assert.deepStrictEqual(check, { verdict: "no-dominance", intendedAction: "honest" });
});

test("a hack dominant only at a later context step is found (ascending scan reports it)", () => {
  // cheat net = difficulty - 4: below honest (0) at 1..3, ties at 4, exceeds at 5.
  const check = checkDominance(
    analysisOf(
      mkState(
        [
          { id: "honest", reward: "0", cost: "0" },
          { id: "cheat", reward: "difficulty", cost: "4" },
        ],
        "honest",
      ),
    ),
  );
  assert.strictEqual(check.verdict, "hack-dominates");
  assert.strictEqual(check.point!.context, 4, "first step where cheat net >= honest net");
  assert.strictEqual(check.point!.action, "cheat");
});

test("EPS tolerance: a hack within 1e-9 below the intended net still counts as dominating", () => {
  const check = checkDominance(
    analysisOf(
      mkState(
        [
          { id: "honest", reward: "1", cost: "0" },
          { id: "cheat", reward: "0.9999999999995", cost: "0" }, // 5e-13 below — inside EPS
        ],
        "honest",
      ),
    ),
  );
  assert.strictEqual(check.verdict, "hack-dominates");
});

// ---- indeterminate (a property of the input, not a failure) ----

test("no declared intent → indeterminate with reason, no intendedAction", () => {
  const check = checkDominance(
    analysisOf(
      mkState([
        { id: "a", reward: "1", cost: "0" },
        { id: "b", reward: "2", cost: "0" },
      ]),
    ),
  );
  assert.strictEqual(check.verdict, "indeterminate");
  assert.strictEqual(check.intendedAction, undefined);
  assert.ok(check.reason!.includes("intent.intended_action"), check.reason);
});

test("only the intended action declared (no candidate hacks) → indeterminate", () => {
  const check = checkDominance(analysisOf(mkState([{ id: "honest", reward: "1", cost: "0" }], "honest")));
  assert.strictEqual(check.verdict, "indeterminate");
  assert.strictEqual(check.intendedAction, "honest");
  assert.ok(check.reason!.includes("no candidate hack actions"), check.reason);
});

test("intended action not among declared actions → indeterminate (defensive, never a throw)", () => {
  const check = checkDominance(
    analysisOf(mkState([{ id: "a", reward: "1", cost: "0" }], "ghost")),
  );
  assert.strictEqual(check.verdict, "indeterminate");
  assert.ok(check.reason!.includes("not among the declared actions"), check.reason);
});

// ---- CLI contract (FR-2.1: exit 0 for all three verdicts; exit 1 only on IncentiveError) ----

console.log("\npayoff — check-dominance CLI (FR-2.1)\n");

function cli(args: string[]) {
  return spawnSync("npx", ["tsx", PAYOFF_CLI, ...args], { cwd: REPO, encoding: "utf8" });
}

test("CLI: hack-dominates → exit 0, pinned human line on stdout", () => {
  const res = cli(["check-dominance", "--incentive-state", DUNGEON_STATE]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(
    res.stdout,
    "hack-dominates: 'edit-world' net 0.95 >= intended 'fight-through' net 0.88 at difficulty=1\n",
  );
});

test("CLI: --json → exit 0, pinned parseable shape (sdd §5.1 key order)", () => {
  const res = cli(["check-dominance", "--incentive-state", DUNGEON_STATE, "--json"]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(
    res.stdout,
    '{"verdict":"hack-dominates","point":{"context":1,"action":"edit-world","net":0.95,"intendedNet":0.88},"intendedAction":"fight-through"}\n',
  );
});

test("CLI: --help documents the sampling difference and the exit-code semantics", () => {
  const res = cli(["check-dominance", "--help"]);
  assert.strictEqual(res.status, 0);
  assert.ok(res.stdout.includes("50") && res.stdout.toLowerCase().includes("evenly spaced"), "Arneson sampling noted");
  assert.ok(res.stdout.toLowerCase().includes("integer"), "Gygax integer-step sampling noted");
  assert.ok(res.stdout.includes("exit 0") || res.stdout.includes("0  verdict computed"), "exit-0 semantics noted");
  assert.ok(res.stdout.includes("IncentiveError"), "exit-1 condition noted");
  assert.ok(res.stdout.includes("indeterminate"), "all three verdicts named");
});

test("CLI: unparseable incentive-state → exit 1 with IncentiveError on stderr", () => {
  const res = cli(["check-dominance", "--incentive-state", join(REPO, "evals", "vendor")]);
  assert.strictEqual(res.status, 1);
  assert.ok(res.stderr.includes("IncentiveError"), res.stderr);
  assert.strictEqual(res.stdout, "", "no payload on stdout");
});

test("CLI: missing --incentive-state → usage exit 2 (not a verdict, not an IncentiveError)", () => {
  const res = cli(["check-dominance"]);
  assert.strictEqual(res.status, 2);
});

test("CLI: legacy positional invocation unchanged (NFR-6 — report + dominant line)", () => {
  const res = cli([join("evals", "incentive-fixtures", "agent-reward-hack", "incentive-state")]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.startsWith("# Incentive Analysis — context `difficulty`"), "report first line");
  assert.ok(
    res.stdout.includes("dominant=delete-test dominated=3 intended_optimal=false"),
    "legacy summary line intact",
  );
});

console.log("\ncheck-dominance.test.ts: all tests passed");
