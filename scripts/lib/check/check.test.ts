/**
 * check.test.ts — proof for `/gygax check` (cycle-011, FR-3).
 * Convention: `tsx scripts/lib/check/check.test.ts` (via `npm run test:check`).
 *
 * Asserts: a healthy repo reports 4/4 green + overall PASS + CLI exit 0; an injected malformed user
 * archetype flips the archetype-schema check to FAIL + overall FAIL + CLI exit 1; and the cycle-011
 * source has ZERO Arneson coupling (NFR-3, T34.2 — kept as a test so check.ts stays 4 sub-checks).
 */
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { runHealthCheck, renderHealthSummary } from "./check.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const TSX = join(ROOT, "node_modules", ".bin", "tsx");
const CHECK = join(HERE, "check.ts");

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

const MALFORMED_ARCHETYPE = `id: broken-check
name: "Broken"
description: "x"
motivation: "x"
blind_spots:
  - "x"
tests_for:
  - severity: lethal
    category: "x"
    description: "x"
behavioral_weightings:
  default:
    risk_tolerance: medium
    optimization_drive: medium
    system_engagement: deep
    primary_focus: "x"
    secondary_focus: "x"
    engagement_style: "x"
`;

console.log("gygax check — diagnostic health proof (FR-3)\n");

test("healthy repo: 4 sub-checks, all PASS, overall PASS", () => {
  const summary = runHealthCheck();
  assert.strictEqual(summary.checks.length, 4, "expected exactly 4 curated sub-checks (FR-3.1)");
  assert.deepStrictEqual(
    summary.checks.map((c) => c.name),
    ["golden-integrity", "expected-findings", "archetype-schema", "game-state-sanity"],
    "sub-check set/order drifted",
  );
  const failing = summary.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.detail}`);
  assert.deepStrictEqual(failing, [], `expected all green, got failures:\n${failing.join("\n")}`);
  assert.strictEqual(summary.pass, true);
});

test("renderHealthSummary emits a PASS verdict line", () => {
  const out = renderHealthSummary(runHealthCheck());
  assert.ok(out.includes("OVERALL: PASS"), `expected PASS verdict, got:\n${out}`);
});

test("a malformed user archetype flips archetype-schema to FAIL and overall to FAIL", () => {
  const dir = mkdtempSync(join(tmpdir(), "check-bad-"));
  try {
    writeFileSync(join(dir, "broken.yaml"), MALFORMED_ARCHETYPE);
    const summary = runHealthCheck({ userDir: dir });
    const arch = summary.checks.find((c) => c.name === "archetype-schema")!;
    assert.strictEqual(arch.pass, false, "archetype-schema should FAIL on a malformed user archetype");
    assert.ok(arch.detail.includes("severity"), `expected a field-level detail, got: ${arch.detail}`);
    assert.strictEqual(summary.pass, false, "overall verdict should be FAIL");
    assert.ok(renderHealthSummary(summary).includes("OVERALL: FAIL"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI exits 0 on a healthy repo", () => {
  const out = execFileSync(TSX, [CHECK], { encoding: "utf8" });
  assert.ok(out.includes("OVERALL: PASS"), `expected PASS output, got:\n${out}`);
});

test("CLI exits 1 when a check fails", () => {
  const dir = mkdtempSync(join(tmpdir(), "check-cli-"));
  try {
    writeFileSync(join(dir, "broken.yaml"), MALFORMED_ARCHETYPE);
    const harness = join(dir, "harness.ts");
    writeFileSync(
      harness,
      `import { runHealthCheck } from ${JSON.stringify(CHECK)};\n` +
        `const s = runHealthCheck({ userDir: ${JSON.stringify(dir)} });\n` +
        `process.exit(s.pass ? 0 : 1);\n`,
    );
    let status = 0;
    try {
      execFileSync(TSX, [harness], { encoding: "utf8", stdio: "pipe" });
    } catch (e) {
      status = (e as { status?: number }).status ?? -1;
    }
    assert.strictEqual(status, 1, "CLI/orchestrator should exit 1 when any check fails");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("NFR-3: cycle-011 source has zero Arneson coupling", () => {
  const sources = [
    join(ROOT, "scripts", "lib", "check", "check.ts"),
    join(ROOT, "scripts", "lib", "archetypes", "validate.ts"),
    join(ROOT, "scripts", "lib", "parametric", "svg.ts"),
    join(ROOT, "scripts", "lib", "parametric", "mermaid.ts"),
  ];
  // Coupling = an import/require of an Arneson module path, not the word in a comment.
  const couples = (src: string): boolean =>
    src.split("\n").some((line) => /\b(import|require)\b/.test(line) && /arneson/i.test(line));
  for (const f of sources) {
    assert.ok(!couples(readFileSync(f, "utf8")), `${f} must not import Arneson internals (NFR-3 — no coupling)`);
  }
});

console.log("\nAll gygax check tests passed.\n");
