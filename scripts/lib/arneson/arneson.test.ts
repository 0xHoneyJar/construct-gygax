/**
 * arneson.test.ts — Sprint 4 (cycle-009): reciprocal discovery + read-only playout view
 * (FR-5.1/5.2, S5). Convention: `npx tsx scripts/lib/arneson/arneson.test.ts`
 *
 * Hermetic: canned playout fixtures in temp dirs; no live sibling needed (a live render is a
 * bonus, exercised manually / by the dashboard).
 */
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveArnesonRoot } from "./discover.ts";
import { loadPlayouts } from "./playouts.ts";
import { arnesonView, renderArnesonView } from "./index.ts";

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

const SINGLE_YAML = `playout_id: demo-single-20260610
scenario_id: awareness-ladder-demo
lane: real
engine_git_sha: 312531c0ce41acb603ec3debf99c447b1a6f5d42
batch_path: /tmp/somewhere/batch
counts:
  completed: 2
runs: 2
validation: conformant
started_at: "2026-06-10T04:52:07Z"
completed_at: "2026-06-10T04:58:30Z"
`;

const SWEEP_YAML = `playout_id: sweep-demo-20260611
kind: sweep
scenario_id: dungeon-walkthrough
lane: real
configs:
  - name: gemma3-12b
    agent_cmd_sha256: ab12cd
    batch_path: /tmp/cfg-a
    triage:
      fixed: 4
      hacked: 1
      failed: 0
      infra: 1
    cliff_rung: 2
    severity: capability-edge
  - name: qwen3-14b
    triage:
      fixed: 5
      hacked: 0
      failed: 0
    cliff_rung: null
completed_at: "2026-06-11T10:00:00Z"
`;

function mkRoot(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "arneson-root-"));
  mkdirSync(join(root, "grimoires", "arneson", "playouts"), { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(root, "grimoires", "arneson", "playouts", name), body);
  }
  return root;
}

const roots: string[] = [];
const root = mkRoot({ "a-single.yaml": SINGLE_YAML, "b-sweep.yaml": SWEEP_YAML });
roots.push(root);

console.log("arneson — reciprocal discovery + read-only playout view (cycle-009 Sprint 4)\n");

// ---- discovery (Task 4.1, FR-5.1) ----

test("explicit GYGAX_ARNESON_ROOT is authoritative when valid", () => {
  assert.strictEqual(resolveArnesonRoot({ GYGAX_ARNESON_ROOT: root }), root);
});

test("an INVALID explicit env root is null — no silent fall-through to the sibling probe", () => {
  const bogus = mkdtempSync(join(tmpdir(), "no-marker-"));
  roots.push(bogus);
  assert.strictEqual(resolveArnesonRoot({ GYGAX_ARNESON_ROOT: bogus }), null);
});

test("no env: sibling probe resolves or returns null — never throws", () => {
  const got = resolveArnesonRoot({});
  assert.ok(got === null || typeof got === "string");
});

// ---- playout loading (Task 4.2, FR-5.2) ----

test("single + sweep records parse with verbatim fields", () => {
  const { records, unreadable } = loadPlayouts(root);
  assert.strictEqual(unreadable, 0);
  assert.strictEqual(records.length, 2);
  const single = records.find((r) => r.kind === "single")!;
  assert.strictEqual(single.playoutId, "demo-single-20260610");
  assert.deepStrictEqual(single.counts, { completed: 2 });
  assert.strictEqual(single.engineGitSha, "312531c0ce41acb603ec3debf99c447b1a6f5d42");
  const sweep = records.find((r) => r.kind === "sweep")!;
  assert.strictEqual(sweep.configs!.length, 2);
  assert.deepStrictEqual(sweep.configs![0].triage, { fixed: 4, hacked: 1, failed: 0, infra: 1 });
  assert.strictEqual(sweep.configs![0].cliffRung, 2);
  assert.strictEqual(sweep.configs![1].cliffRung, null);
});

test("malformed file is skipped + counted, never fatal, never fabricated", () => {
  const r = mkRoot({ "good.yaml": SINGLE_YAML, "bad.yaml": "kind: sweep\n# no playout_id\n", "broken.yaml": ":::not yaml{{{" });
  roots.push(r);
  const { records, unreadable } = loadPlayouts(r);
  assert.strictEqual(records.length, 1);
  assert.strictEqual(unreadable, 2);
});

test("NFR-2 invariant: no computed numbers — every number is verbatim from a record", () => {
  // Structural assertion: the module's source contains no arithmetic on record numbers and
  // exposes none of the grading vocabulary as computed outputs.
  for (const f of ["playouts.ts", "index.ts", "discover.ts"]) {
    const src = readFileSync(join(HERE, f), "utf8");
    assert.ok(!/\b(hackRatio|fixRatio|firstCrossing|detectCliff|analyzeIncentives|gradeBatch|scoreRun)\b/.test(src), `${f} must not import/compute grading numbers`);
  }
  // Behavioral: the rendered view contains only numbers present in the fixtures.
  const view = arnesonView(root);
  const rendered = renderArnesonView(view);
  for (const n of rendered.match(/=\d+/g) ?? []) {
    assert.ok(["=2", "=4", "=1", "=0", "=5"].includes(n), `unexpected computed number ${n}`);
  }
});

// ---- view + CLI (Task 4.2, S5) ----

test("render: sweep rows carry config names, verbatim triage, cliff + severity; missing → —", () => {
  const rendered = renderArnesonView(arnesonView(root));
  assert.ok(rendered.includes("## Real-Play History (read-only"), "section header");
  assert.ok(rendered.includes("renders, it never re-grades"), "read-only note");
  assert.ok(rendered.includes("gemma3-12b: fixed=4 hacked=1 failed=0 infra=1 cliff=2 capability-edge"), "sweep config row");
  assert.ok(rendered.includes("qwen3-14b: fixed=5 hacked=0 failed=0 cliff=— —"), "missing fields render — (never invented)");
});

test("graceful absence: root null → {root: null}, exit 0, no error", () => {
  const view = arnesonView(undefined, { GYGAX_ARNESON_ROOT: "/nonexistent/nowhere" });
  assert.deepStrictEqual(view, { root: null, records: [], unreadable: 0 });
  const res = spawnSync("npx", ["tsx", join("scripts", "lib", "arneson", "index.ts"), "--root", "/nonexistent/nowhere", "--json"], {
    cwd: REPO,
    encoding: "utf8",
  });
  assert.strictEqual(res.status, 0, `absence is a state, not an error: ${res.stderr}`);
  assert.strictEqual(JSON.parse(res.stdout).root, null);
});

test("--json output is byte-stable across runs (NFR-4)", () => {
  const run = () =>
    spawnSync("npx", ["tsx", join("scripts", "lib", "arneson", "index.ts"), "--root", root, "--json"], {
      cwd: REPO,
      encoding: "utf8",
    }).stdout;
  assert.strictEqual(run(), run(), "two renders byte-identical");
});

// ---- NFR-5: banned-copy grep over rendered-string literals (Task 4.3) ----

test("NFR-5: no banned-copy phrases in report.ts / arneson module string literals", () => {
  for (const f of [join(REPO, "scripts", "lib", "trace", "report.ts"), join(HERE, "index.ts"), join(HERE, "playouts.ts")]) {
    const src = readFileSync(f, "utf8");
    for (const banned of ["proves", "validates", "high-fidelity"]) {
      assert.ok(!src.toLowerCase().includes(banned), `${f} contains banned phrase "${banned}"`);
    }
  }
});

for (const d of roots) rmSync(d, { recursive: true, force: true });
console.log("\narneson.test.ts: all tests passed");
