/**
 * conformance.test.ts — FR-2.2 cross-implementation conformance on the dungeon fixture
 * (cycle-009 Sprint 3, Task 3.5; sdd §5.1/§7.3).
 * Convention: `npx tsx evals/vendor/conformance.test.ts`
 *
 * Hermetic leg (always-on, CI-truth): Gygax's checkDominance on the VENDORED dungeon
 * incentive-state (`fight-through`, `edit-world`, `referee-exit`) equals the pinned expected
 * verdict, derived ONCE from Arneson's checker — derivation recorded below.
 *
 * Live leg (skip-if-absent BONUS): execute Arneson's check_payoff_dominance.py from a
 * discovered sibling against the same vendored state and compare VERDICT CLASSES
 * (PASS ⇔ hack-dominates, WARN ⇔ no-dominance). Verdict-level only: Gygax samples integer
 * context steps, Arneson 50 evenly spaced points (sdd §5.1, documented not hidden).
 *
 * ── Pinned-verdict derivation (run 2026-06-11, upstream 5e2e3a1c4c8b5267058b3971db99dc64057182f4) ──
 *   $ python3 <arneson-root>/domains/agent-systems/scripts/check_payoff_dominance.py \
 *       evals/vendor/arneson/fixtures/dungeon-crawl/incentive-state
 *   PASS: hack 'edit-world' is payoff-dominant at difficulty=1.0 (net 0.95 >= intended
 *   'fight-through' net 0.88) — a cliff claim is meaningful here.   (exit 0)
 * PASS maps to Gygax verdict class `hack-dominates`. Re-derive on any re-vendor.
 */
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { analyzeIncentives, checkDominance } from "../../scripts/lib/payoff/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url)); // evals/vendor
const REPO = resolve(HERE, "..", "..");
const DUNGEON_STATE = join(HERE, "arneson", "fixtures", "dungeon-crawl", "incentive-state");
const PAYOFF_CLI = join("scripts", "lib", "payoff", "index.ts");

const EXPECTED_VERDICT = "hack-dominates"; // the pin — see derivation in the header comment

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

console.log("conformance — FR-2.2 hermetic leg (pinned verdict on the vendored dungeon state)\n");

test(`checkDominance(vendored dungeon state) === pinned "${EXPECTED_VERDICT}"`, () => {
  const check = checkDominance(analyzeIncentives(DUNGEON_STATE));
  assert.strictEqual(check.verdict, EXPECTED_VERDICT);
  assert.strictEqual(check.intendedAction, "fight-through");
  assert.strictEqual(check.point!.action, "edit-world");
});

test("CLI check-dominance on the vendored state → exit 0, same verdict (parseable)", () => {
  const res = spawnSync("npx", ["tsx", PAYOFF_CLI, "check-dominance", "--incentive-state", DUNGEON_STATE, "--json"], {
    cwd: REPO,
    encoding: "utf8",
  });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual((JSON.parse(res.stdout) as { verdict: string }).verdict, EXPECTED_VERDICT);
});

// ---- intent-free → indeterminate / exit 0 (pinned; sdd §5.1 "a property of the input") ----

test("intent-free incentive-state → indeterminate, exit 0 (warn-not-reject)", () => {
  const dir = mkdtempSync(join(tmpdir(), "gygax-intent-free-"));
  try {
    mkdirSync(join(dir, "actions"), { recursive: true });
    // Same shape as the dungeon state, with NO reward_signal (no intent declared anywhere).
    writeFileSync(
      join(dir, "index.yaml"),
      'context:\n  name: difficulty\n  domain: { min: 1, max: 10 }\nactions:\n  - actions/a.yaml\n  - actions/b.yaml\n',
    );
    writeFileSync(join(dir, "actions", "a.yaml"), 'id: a\npayoff:\n  reward: "1"\n  cost: "0.12 * difficulty"\n');
    writeFileSync(join(dir, "actions", "b.yaml"), 'id: b\npayoff:\n  reward: "1"\n  cost: "0.05"\n');
    const res = spawnSync("npx", ["tsx", PAYOFF_CLI, "check-dominance", "--incentive-state", dir, "--json"], {
      cwd: REPO,
      encoding: "utf8",
    });
    assert.strictEqual(res.status, 0, `exit ${res.status} (must be 0 — indeterminate is not a failure): ${res.stderr}`);
    const parsed = JSON.parse(res.stdout) as { verdict: string; reason?: string };
    assert.strictEqual(parsed.verdict, "indeterminate");
    assert.ok(parsed.reason!.includes("intent.intended_action"), parsed.reason);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- live leg: Arneson's checker on the SAME vendored state (skip-if-absent bonus) ----

console.log("\nconformance — FR-2.2 live leg (Arneson's checker, skip-if-absent)\n");

function resolveSibling(): string | null {
  const env = process.env.GYGAX_ARNESON_ROOT;
  if (env) return existsSync(env) ? env : null; // explicit env var is authoritative
  const sibling = resolve(REPO, "..", "construct-arneson");
  return existsSync(sibling) ? sibling : null;
}

/** Map Arneson's PASS/WARN/exit-1 discipline onto Gygax verdict classes (sdd §5.1). */
function arnesonVerdictClass(status: number | null, stdout: string): string {
  if (status === 0 && stdout.startsWith("PASS")) return "hack-dominates";
  if (status === 0 && stdout.startsWith("WARN")) return "no-dominance";
  return `unmapped (exit ${status}: ${stdout.slice(0, 80)})`; // their exit 1 ≈ our indeterminate/IncentiveError
}

const sibling = resolveSibling();
const checker = sibling ? join(sibling, "domains", "agent-systems", "scripts", "check_payoff_dominance.py") : null;
if (!checker || !existsSync(checker)) {
  console.log("  SKIP  no sibling check_payoff_dominance.py (set GYGAX_ARNESON_ROOT or place ../construct-arneson) — the hermetic pinned-verdict leg above is CI-truth");
} else {
  test("both implementations agree on the dungeon fixture's verdict class", () => {
    const theirs = spawnSync("python3", [checker, DUNGEON_STATE], { encoding: "utf8" });
    const theirClass = arnesonVerdictClass(theirs.status, theirs.stdout);
    const ours = checkDominance(analyzeIncentives(DUNGEON_STATE)).verdict;
    assert.strictEqual(
      theirClass,
      ours,
      `CONFORMANCE FINDING (not auto-failure-noise — document it): Gygax says '${ours}', ` +
        `Arneson says '${theirClass}'.\n  Arneson stdout: ${theirs.stdout}  Arneson stderr: ${theirs.stderr}\n` +
        "  Classify before fixing: integer-step vs 50-point sampling artifact, or semantic drift " +
        "(sdd §5.1 divergence surface). Fix Gygax if Gygax is wrong; brief Arneson if theirs is.",
    );
    assert.strictEqual(ours, EXPECTED_VERDICT, "live agreement must also match the recorded pin");
  });
}

console.log("\nconformance.test.ts: all tests passed");
