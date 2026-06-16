/**
 * archetypes.test.ts — golden/CI proof for the FR-2 archetype schema + validator (cycle-011).
 * Convention: `tsx scripts/lib/archetypes/archetypes.test.ts` (via `npm run test:archetypes`).
 *
 * Asserts: all 9 built-ins validate green against the authored schema; the worked "Speedrunner"
 * user archetype validates and merges; a malformed archetype fails with a field-level error and is
 * excluded (never silently dropped); an id collision is rejected loud; the CLI exits 0/1 correctly.
 */
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import {
  loadYaml,
  loadSchema,
  validateArchetype,
  extractArchetypes,
  loadAndMerge,
  DEFAULT_BUILTINS,
  DEFAULT_USER_DIR,
  SCHEMA_PATH,
} from "./validate.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const TSX = join(ROOT, "node_modules", ".bin", "tsx");
const VALIDATE = join(HERE, "validate.ts");
const SPEEDRUNNER = join(DEFAULT_USER_DIR, "speedrunner.yaml");

const EXPECTED_BUILTIN_IDS = [
  "optimizer",
  "explorer",
  "storyteller",
  "rules-lawyer",
  "newcomer",
  "veteran",
  "gm",
  "anxious-player",
  "chaos-agent",
].sort();

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

/** A minimal schema-valid archetype YAML, parameterized by id + first-test severity. */
function archetypeYaml(id: string, severity: string): string {
  return `id: ${id}
name: "Test ${id}"
description: "A test archetype."
motivation: "Be a test."
blind_spots:
  - "Only exists for tests"
tests_for:
  - severity: ${severity}
    category: "Test category"
    description: "A test finding"
behavioral_weightings:
  default:
    risk_tolerance: medium
    optimization_drive: medium
    system_engagement: deep
    primary_focus: "Testing"
    secondary_focus: "More testing"
    engagement_style: "Run the tests"
`;
}

console.log("cabal archetypes — schema + validator proof (FR-2)\n");

const schema = loadSchema();

test("schema.yaml loads and exposes a root object node", () => {
  const root = loadSchema(SCHEMA_PATH);
  assert.strictEqual(root.type, "object", "schema root must be an object node");
});

test("all 9 built-ins validate green against the schema (built-ins are ground truth)", () => {
  const builtins = extractArchetypes(loadYaml(DEFAULT_BUILTINS)) as Array<Record<string, unknown>>;
  assert.strictEqual(builtins.length, 9, `expected 9 built-ins, found ${builtins.length}`);
  assert.deepStrictEqual(
    builtins.map((a) => a.id as string).sort(),
    EXPECTED_BUILTIN_IDS,
    "built-in id set drifted from the schema's ground truth",
  );
  const failures: string[] = [];
  for (const arch of builtins) {
    const res = validateArchetype(arch, schema);
    if (!res.valid) failures.push(`${arch.id}: ${res.errors.join("; ")}`);
  }
  assert.deepStrictEqual(failures, [], `built-ins failed validation (schema too narrow — widen it):\n${failures.join("\n")}`);
});

test("the worked 'Speedrunner' user archetype validates green", () => {
  const doc = loadYaml(SPEEDRUNNER);
  const [arch] = extractArchetypes(doc);
  assert.strictEqual((arch as Record<string, unknown>).id, "speedrunner");
  const res = validateArchetype(arch, schema);
  assert.deepStrictEqual(res.errors, [], `Speedrunner should be valid: ${res.errors.join("; ")}`);
});

test("a bad enum value fails with a field-level error naming the path and the offending value", () => {
  const bad = mkArch("bad-archetype");
  (bad.tests_for as Array<Record<string, unknown>>)[0].severity = "lethal";
  const res = validateArchetype(bad, schema);
  assert.strictEqual(res.valid, false, "expected validation to fail");
  assert.ok(
    res.errors.some((e) => e.includes("tests_for[0].severity") && e.includes("lethal")),
    `expected a field-level severity error, got: ${res.errors.join("; ")}`,
  );
});

test("a missing required field fails with a 'required, but missing' error", () => {
  const arch = mkArch("missing-fields") as Record<string, unknown>;
  delete arch.blind_spots;
  const res = validateArchetype(arch, schema);
  assert.strictEqual(res.valid, false);
  assert.ok(
    res.errors.some((e) => e.includes("blind_spots") && e.includes("required")),
    `expected a blind_spots required error, got: ${res.errors.join("; ")}`,
  );
});

test("behavioral_weightings missing `default` is rejected", () => {
  const arch = mkArch("no-default") as Record<string, unknown>;
  arch.behavioral_weightings = { d20: (arch.behavioral_weightings as Record<string, unknown>).default };
  const res = validateArchetype(arch, schema);
  assert.strictEqual(res.valid, false);
  assert.ok(
    res.errors.some((e) => e.includes("behavioral_weightings.default") && e.includes("required key")),
    `expected a missing-default error, got: ${res.errors.join("; ")}`,
  );
});

test("a non-kebab-case id is rejected by pattern", () => {
  const arch = mkArch("Bad_Id") as Record<string, unknown>;
  const res = validateArchetype(arch, schema);
  assert.strictEqual(res.valid, false);
  assert.ok(res.errors.some((e) => e.startsWith("id")), `expected an id pattern error, got: ${res.errors.join("; ")}`);
});

test("loadAndMerge resolves built-ins + Speedrunner with zero errors", () => {
  const { archetypes, errors } = loadAndMerge(DEFAULT_BUILTINS, DEFAULT_USER_DIR, schema);
  assert.deepStrictEqual(errors, [], `expected no merge errors, got: ${errors.join("; ")}`);
  const ids = archetypes.map((a) => a.id as string);
  assert.ok(ids.includes("speedrunner"), "Speedrunner should appear in the merged roster");
  assert.strictEqual(archetypes.length, 9 + 1, "expected 9 built-ins + 1 user archetype");
  // built-ins come first, deterministic order
  assert.deepStrictEqual(ids.slice(0, 9).sort(), EXPECTED_BUILTIN_IDS);
});

test("an id collision with a built-in is rejected loud (not silently shadowed)", () => {
  const dir = mkdtempSync(join(tmpdir(), "arch-collide-"));
  try {
    writeFileSync(join(dir, "dupe.yaml"), archetypeYaml("optimizer", "major"));
    const { archetypes, errors } = loadAndMerge(DEFAULT_BUILTINS, dir, schema);
    assert.strictEqual(archetypes.length, 9, "colliding archetype must not be added");
    assert.ok(
      errors.some((e) => e.includes('"optimizer"') && e.includes("collides")),
      `expected a collision error naming optimizer, got: ${errors.join("; ")}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an invalid user file is excluded AND reported (never silently dropped)", () => {
  const dir = mkdtempSync(join(tmpdir(), "arch-invalid-"));
  try {
    writeFileSync(join(dir, "broken.yaml"), archetypeYaml("broken-one", "lethal"));
    const { archetypes, errors } = loadAndMerge(DEFAULT_BUILTINS, dir, schema);
    assert.strictEqual(archetypes.length, 9, "invalid archetype must be excluded");
    assert.ok(
      errors.some((e) => e.includes("broken.yaml") && e.includes("severity")),
      `expected a reported field-level error, got: ${errors.join("; ")}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI exits 0 for a valid file (Speedrunner)", () => {
  const out = execFileSync(TSX, [VALIDATE, SPEEDRUNNER], { encoding: "utf8" });
  assert.ok(out.includes("PASS"), `expected PASS output, got: ${out}`);
});

test("CLI exits 1 for a malformed file", () => {
  const dir = mkdtempSync(join(tmpdir(), "arch-cli-"));
  try {
    const f = join(dir, "broken.json");
    const arch = mkArch("cli-broken") as Record<string, unknown>;
    (arch.tests_for as Array<Record<string, unknown>>)[0].severity = "lethal";
    writeFileSync(f, JSON.stringify(arch));
    let status = 0;
    try {
      execFileSync(TSX, [VALIDATE, f], { encoding: "utf8", stdio: "pipe" });
    } catch (e) {
      status = (e as { status?: number }).status ?? -1;
    }
    assert.strictEqual(status, 1, "CLI should exit 1 on a malformed file");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

console.log("\nAll archetype schema+validator tests passed.\n");

// ─── helpers ────────────────────────────────────────────────────────────────────────────────────

/** A minimal valid archetype as a JS object (for in-process shape mutation tests). */
function mkArch(id: string): Record<string, unknown> {
  return {
    id,
    name: `Test ${id}`,
    description: "A test archetype.",
    motivation: "Be a test.",
    blind_spots: ["Only exists for tests"],
    tests_for: [{ severity: "major", category: "Test category", description: "A test finding" }],
    behavioral_weightings: {
      default: {
        risk_tolerance: "medium",
        optimization_drive: "medium",
        system_engagement: "deep",
        primary_focus: "Testing",
        secondary_focus: "More testing",
        engagement_style: "Run the tests",
      },
    },
  };
}
