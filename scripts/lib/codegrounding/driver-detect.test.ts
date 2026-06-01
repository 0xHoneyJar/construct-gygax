/**
 * driver-detect.test.ts — unit tests for the contract detector + refusal spec.
 *
 * Sprint 1 ACs (grimoires/loa/sprint.md:L75): driver absent → refuse and print the EXACT
 * 4-function spec; never a silent fallback for a digital engine.
 *
 * Convention: `npx tsx scripts/lib/codegrounding/driver-detect.test.ts`
 */
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  detectDriver,
  validateDriverShape,
  DRIVER_SPEC,
  DRIVER_FUNCTIONS,
} from "./driver-detect.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "__fixtures__");

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

console.log("driver-detect.ts");

// ---- detection ----

test("detects the conventional gygax.driver.ts at repo root", () => {
  const result = detectDriver(join(FIXTURES, "reference-engine"));
  assert.strictEqual(result.found, true);
  if (result.found) assert.match(result.module, /reference-engine\/gygax\.driver\.ts$/);
});

test("refuses with spec when no driver file is present", () => {
  const result = detectDriver(join(FIXTURES, "no-driver-engine"));
  assert.strictEqual(result.found, false);
  if (!result.found) assert.strictEqual(result.spec, DRIVER_SPEC);
});

test("refusal spec names all 5 contract functions verbatim", () => {
  for (const fn of DRIVER_FUNCTIONS) {
    assert.ok(DRIVER_SPEC.includes(fn), `spec missing function ${fn}`);
  }
});

test("refusal spec names the gygaxDriver export and JSON-serializable requirement", () => {
  assert.ok(DRIVER_SPEC.includes("gygaxDriver"), "spec missing gygaxDriver");
  assert.ok(DRIVER_SPEC.includes("JSON-serializable"), "spec missing JSON-serializable note");
});

// ---- shape validation ----

test("validateDriverShape accepts a conformant driver", () => {
  const ok = validateDriverShape({
    gygaxDriver: {
      getInitialState() {},
      legalActions() {},
      applyAction() {},
      isTerminal() {},
      outcome() {},
    },
  });
  assert.strictEqual(ok.ok, true);
});

test("validateDriverShape reports the missing export", () => {
  const r = validateDriverShape({});
  assert.strictEqual(r.ok, false);
  if (!r.ok) assert.deepStrictEqual(r.missing, ["gygaxDriver export"]);
});

test("validateDriverShape reports missing functions", () => {
  const r = validateDriverShape({ gygaxDriver: { getInitialState() {} } });
  assert.strictEqual(r.ok, false);
  if (!r.ok) {
    assert.ok(r.missing.includes("legalActions"));
    assert.ok(r.missing.includes("applyAction"));
    assert.ok(r.missing.includes("isTerminal"));
    assert.ok(r.missing.includes("outcome"));
  }
});

console.log("\nAll driver-detect tests passed.\n");
