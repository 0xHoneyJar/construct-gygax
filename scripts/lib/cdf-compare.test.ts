/**
 * cdf-compare.test.ts — Tests for cross-system CDF comparison tool
 *
 * Test fixtures from SDD Section 3.2:
 *   Identical CDFs produce zero deltas, no crossover points
 */

import assert from "node:assert";
import { run } from "./cdf-compare";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

console.log("cdf-compare.ts");

// ---- Helper: build a simple flat-roll CDF (d20 style) ----

function d20Cdf(): Array<{ dc: number; probability: number }> {
  const cdf = [];
  for (let dc = 1; dc <= 20; dc++) {
    cdf.push({ dc, probability: (20 - dc + 1) / 20 });
  }
  return cdf;
}

// ---- SDD fixture: identical CDFs ----

test("identical CDFs produce zero deltas", () => {
  const cdf = d20Cdf();
  const result = run({
    system_a: { name: "System A", cdf },
    system_b: { name: "System B", cdf },
  });
  for (const entry of result.deltas) {
    assert.ok(
      Math.abs(entry.delta) < 1e-10,
      `Delta at DC ${entry.dc} should be 0, got ${entry.delta}`
    );
  }
});

test("identical CDFs produce no crossover points", () => {
  const cdf = d20Cdf();
  const result = run({
    system_a: { name: "System A", cdf },
    system_b: { name: "System B", cdf },
  });
  assert.strictEqual(
    result.crossover_points.length, 0,
    `Expected 0 crossover points, got ${result.crossover_points.length}`
  );
});

test("identical CDFs produce 'identical' summary", () => {
  const cdf = d20Cdf();
  const result = run({
    system_a: { name: "System A", cdf },
    system_b: { name: "System B", cdf },
  });
  assert.ok(
    result.summary.toLowerCase().includes("identical"),
    `Summary should mention 'identical', got: ${result.summary}`
  );
});

// ---- Deltas structure ----

test("deltas have correct structure", () => {
  const result = run({
    system_a: {
      name: "d20",
      cdf: [{ dc: 10, probability: 0.55 }, { dc: 15, probability: 0.30 }],
    },
    system_b: {
      name: "3d6",
      cdf: [{ dc: 10, probability: 0.50 }, { dc: 15, probability: 0.10 }],
    },
  });
  assert.strictEqual(result.deltas.length, 2);
  assert.strictEqual(result.deltas[0].dc, 10);
  assert.ok(Math.abs(result.deltas[0].system_a_prob - 0.55) < 1e-10);
  assert.ok(Math.abs(result.deltas[0].system_b_prob - 0.50) < 1e-10);
  assert.ok(Math.abs(result.deltas[0].delta - 0.05) < 1e-10);
});

// ---- One system dominates ----

test("system A always higher: no crossover, summary says A is more generous", () => {
  const result = run({
    system_a: {
      name: "Generous",
      cdf: [
        { dc: 5, probability: 0.90 },
        { dc: 10, probability: 0.70 },
        { dc: 15, probability: 0.50 },
      ],
    },
    system_b: {
      name: "Stingy",
      cdf: [
        { dc: 5, probability: 0.80 },
        { dc: 10, probability: 0.50 },
        { dc: 15, probability: 0.20 },
      ],
    },
  });
  assert.strictEqual(result.crossover_points.length, 0);
  assert.ok(
    result.summary.includes("Generous") && result.summary.toLowerCase().includes("more generous"),
    `Summary should note Generous is more generous, got: ${result.summary}`
  );
});

// ---- Crossover detection ----

test("single crossover detected when systems swap", () => {
  const result = run({
    system_a: {
      name: "Alpha",
      cdf: [
        { dc: 5, probability: 0.90 },
        { dc: 10, probability: 0.50 },
        { dc: 15, probability: 0.10 },
      ],
    },
    system_b: {
      name: "Beta",
      cdf: [
        { dc: 5, probability: 0.70 },
        { dc: 10, probability: 0.50 },
        { dc: 15, probability: 0.30 },
      ],
    },
  });
  // At DC 5: Alpha > Beta (delta > 0)
  // At DC 10: equal (delta = 0) — crossover
  // At DC 15: Alpha < Beta (delta < 0)
  assert.ok(
    result.crossover_points.length >= 1,
    `Expected at least 1 crossover point, got ${result.crossover_points.length}`
  );
});

test("crossover summary mentions both systems", () => {
  const result = run({
    system_a: {
      name: "Alpha",
      cdf: [
        { dc: 5, probability: 0.90 },
        { dc: 10, probability: 0.60 },
        { dc: 15, probability: 0.10 },
      ],
    },
    system_b: {
      name: "Beta",
      cdf: [
        { dc: 5, probability: 0.70 },
        { dc: 10, probability: 0.50 },
        { dc: 15, probability: 0.30 },
      ],
    },
  });
  assert.ok(
    result.summary.length > 0,
    "Summary should not be empty"
  );
});

// ---- Different DC sets ----

test("systems with different DC ranges are compared at union of DCs", () => {
  const result = run({
    system_a: {
      name: "A",
      cdf: [{ dc: 5, probability: 0.80 }, { dc: 10, probability: 0.50 }],
    },
    system_b: {
      name: "B",
      cdf: [{ dc: 10, probability: 0.40 }, { dc: 15, probability: 0.20 }],
    },
  });
  // Union: DCs 5, 10, 15
  assert.strictEqual(result.deltas.length, 3);
  // DC 5: A has 0.80, B has 0 (missing)
  assert.ok(Math.abs(result.deltas[0].system_a_prob - 0.80) < 1e-10);
  assert.ok(Math.abs(result.deltas[0].system_b_prob - 0.0) < 1e-10);
  // DC 15: A has 0 (missing), B has 0.20
  assert.ok(Math.abs(result.deltas[2].system_a_prob - 0.0) < 1e-10);
  assert.ok(Math.abs(result.deltas[2].system_b_prob - 0.20) < 1e-10);
});

// ---- Empty CDFs ----

test("empty CDFs produce empty deltas and 'no data' summary", () => {
  const result = run({
    system_a: { name: "Empty A", cdf: [] },
    system_b: { name: "Empty B", cdf: [] },
  });
  assert.strictEqual(result.deltas.length, 0);
  assert.strictEqual(result.crossover_points.length, 0);
  assert.ok(
    result.summary.toLowerCase().includes("no data"),
    `Summary should mention no data, got: ${result.summary}`
  );
});

// ---- Validation ----

test("missing system_a throws", () => {
  assert.throws(
    () => run({ system_a: null as any, system_b: { name: "B", cdf: [] } }),
    /system_a/
  );
});

test("missing system_b throws", () => {
  assert.throws(
    () => run({ system_a: { name: "A", cdf: [] }, system_b: null as any }),
    /system_b/
  );
});

console.log("\nAll cdf-compare tests passed.\n");
