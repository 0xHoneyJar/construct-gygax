/**
 * dice-probability.test.ts — Tests for single-die probability calculator
 *
 * Test fixtures from SDD Section 3.2:
 *   d6 has probability_per_face = 1/6 ~ 0.1667, expected_value = 3.5
 */

import assert from "node:assert";
import { run } from "./dice-probability";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

console.log("dice-probability.ts");

// ---- Basic d6 facts (SDD fixture) ----

test("d6 probability_per_face is 1/6", () => {
  const result = run({ sides: 6 });
  assert.ok(
    Math.abs(result.probability_per_face - 1 / 6) < 1e-10,
    `Expected ~0.1667, got ${result.probability_per_face}`
  );
});

test("d6 expected_value is 3.5", () => {
  const result = run({ sides: 6 });
  assert.ok(
    Math.abs(result.expected_value - 3.5) < 1e-10,
    `Expected 3.5, got ${result.expected_value}`
  );
});

// ---- Other die sizes ----

test("d20 probability_per_face is 1/20", () => {
  const result = run({ sides: 20 });
  assert.ok(Math.abs(result.probability_per_face - 0.05) < 1e-10);
});

test("d20 expected_value is 10.5", () => {
  const result = run({ sides: 20 });
  assert.ok(Math.abs(result.expected_value - 10.5) < 1e-10);
});

test("d4 expected_value is 2.5", () => {
  const result = run({ sides: 4 });
  assert.ok(Math.abs(result.expected_value - 2.5) < 1e-10);
});

test("d100 expected_value is 50.5", () => {
  const result = run({ sides: 100 });
  assert.ok(Math.abs(result.expected_value - 50.5) < 1e-10);
});

// ---- Target probabilities ----

test("d6 target 4: P(>= 4) = 3/6 = 0.5", () => {
  const result = run({ sides: 6, target: 4 });
  assert.ok(Math.abs(result.probability_at_least! - 0.5) < 1e-10);
});

test("d6 target 4: P(== 4) = 1/6", () => {
  const result = run({ sides: 6, target: 4 });
  assert.ok(Math.abs(result.probability_exact! - 1 / 6) < 1e-10);
});

test("d20 target 11: P(>= 11) = 10/20 = 0.5", () => {
  const result = run({ sides: 20, target: 11 });
  assert.ok(Math.abs(result.probability_at_least! - 0.5) < 1e-10);
});

test("d20 target 1: P(>= 1) = 1.0 (always succeed)", () => {
  const result = run({ sides: 20, target: 1 });
  assert.ok(Math.abs(result.probability_at_least! - 1.0) < 1e-10);
});

test("d20 target 20: P(>= 20) = 1/20 = 0.05", () => {
  const result = run({ sides: 20, target: 20 });
  assert.ok(Math.abs(result.probability_at_least! - 0.05) < 1e-10);
});

// ---- Edge cases ----

test("target below 1 always succeeds", () => {
  const result = run({ sides: 6, target: 0 });
  assert.strictEqual(result.probability_at_least, 1);
});

test("target above max always fails", () => {
  const result = run({ sides: 6, target: 7 });
  assert.strictEqual(result.probability_at_least, 0);
});

test("no target: probability_at_least is undefined", () => {
  const result = run({ sides: 6 });
  assert.strictEqual(result.probability_at_least, undefined);
});

test("invalid die size throws", () => {
  assert.throws(() => run({ sides: 5 as any }), /Invalid die size/);
});

console.log("\nAll dice-probability tests passed.\n");
