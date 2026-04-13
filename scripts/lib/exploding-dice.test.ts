/**
 * exploding-dice.test.ts — Tests for exploding dice probability calculator
 *
 * Test fixtures from SDD Section 3.2:
 *   Exploding d6 expected_value = 4.2 (formula: 6*7/(2*5) = 4.2)
 */

import assert from "node:assert";
import { run } from "./exploding-dice";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

console.log("exploding-dice.ts");

// ---- SDD fixture: exploding d6 ----

test("exploding d6 expected_value = 4.2", () => {
  const result = run({ sides: 6 });
  assert.ok(
    Math.abs(result.expected_value - 4.2) < 0.001,
    `Expected 4.2, got ${result.expected_value}`
  );
});

// ---- Expected values for other dice ----

test("exploding d4 expected_value = 4*5/(2*3) = 10/3 ~ 3.333", () => {
  const result = run({ sides: 4 });
  const expected = (4 * 5) / (2 * 3);
  assert.ok(
    Math.abs(result.expected_value - expected) < 0.001,
    `Expected ${expected}, got ${result.expected_value}`
  );
});

test("exploding d8 expected_value = 8*9/(2*7) = 72/14 ~ 5.143", () => {
  const result = run({ sides: 8 });
  const expected = (8 * 9) / (2 * 7);
  assert.ok(
    Math.abs(result.expected_value - expected) < 0.001,
    `Expected ${expected}, got ${result.expected_value}`
  );
});

test("exploding d10 expected_value = 10*11/(2*9) ~ 6.111", () => {
  const result = run({ sides: 10 });
  const expected = (10 * 11) / (2 * 9);
  assert.ok(
    Math.abs(result.expected_value - expected) < 0.001,
    `Expected ${expected}, got ${result.expected_value}`
  );
});

test("exploding d12 expected_value = 12*13/(2*11) ~ 7.091", () => {
  const result = run({ sides: 12 });
  const expected = (12 * 13) / (2 * 11);
  assert.ok(
    Math.abs(result.expected_value - expected) < 0.001,
    `Expected ${expected}, got ${result.expected_value}`
  );
});

// ---- Tail probabilities structure ----

test("exploding d6 tail_probabilities starts at 1", () => {
  const result = run({ sides: 6 });
  assert.strictEqual(result.tail_probabilities[0].value, 1);
});

test("exploding d6 P(1) = P(2) = P(3) = P(4) = P(5) = 1/6", () => {
  const result = run({ sides: 6 });
  for (let v = 1; v <= 5; v++) {
    const entry = result.tail_probabilities.find((e) => e.value === v);
    assert.ok(entry, `Should have entry for value ${v}`);
    assert.ok(
      Math.abs(entry!.probability - 1 / 6) < 1e-10,
      `P(${v}) should be 1/6, got ${entry!.probability}`
    );
  }
});

test("exploding d6 has no entry for value 6 (it always explodes)", () => {
  const result = run({ sides: 6 });
  // Value 6 is impossible without max_depth being 0, because rolling 6
  // always triggers an explosion. The result would be 6 + next roll.
  // So the minimum result after one explosion is 6 + 1 = 7.
  const entry = result.tail_probabilities.find((e) => e.value === 6);
  // With default depth, there should be no entry for exactly 6
  assert.ok(
    !entry || entry.probability < 1e-10,
    `Value 6 should not appear (always explodes)`
  );
});

test("exploding d6 P(7) = (1/6)*(1/6) for first explosion + roll 1", () => {
  // To get 7: roll 6 (explode), then roll 1. P = (1/6)*(1/6) = 1/36
  const result = run({ sides: 6 });
  const entry = result.tail_probabilities.find((e) => e.value === 7);
  assert.ok(entry, "Should have entry for value 7");
  assert.ok(
    Math.abs(entry!.probability - 1 / 36) < 1e-10,
    `P(7) should be 1/36, got ${entry!.probability}`
  );
});

// ---- Probabilities sum to ~1.0 ----

test("tail probabilities sum to ~1.0 (within depth truncation)", () => {
  const result = run({ sides: 6, max_depth: 10 });
  const total = result.tail_probabilities.reduce((sum, e) => sum + e.probability, 0);
  // With max_depth=10, we miss (1/6)^11 ~ 3.6e-9 probability mass
  assert.ok(
    Math.abs(total - 1.0) < 1e-6,
    `Sum of probabilities = ${total}, expected ~1.0`
  );
});

// ---- Target probability ----

test("exploding d6 P(>= 1) = 1.0", () => {
  const result = run({ sides: 6, target: 1 });
  assert.ok(
    Math.abs(result.probability_at_least! - 1.0) < 1e-6,
    `Expected 1.0, got ${result.probability_at_least}`
  );
});

test("exploding d6 P(>= 4) = P(4) + P(5) + P(7) + P(8) + ... ", () => {
  // P(>= 4) = 1 - P(1) - P(2) - P(3) = 1 - 3/6 = 0.5
  const result = run({ sides: 6, target: 4 });
  assert.ok(
    Math.abs(result.probability_at_least! - 0.5) < 0.001,
    `Expected 0.5, got ${result.probability_at_least}`
  );
});

test("exploding d6 P(>= 7) = (1/6) * 1.0 = 1/6 ~ 0.1667", () => {
  // To reach 7+, must explode at least once. P(explosion) = 1/6.
  // Given explosion, always get at least 7 (6+1).
  const result = run({ sides: 6, target: 7 });
  assert.ok(
    Math.abs(result.probability_at_least! - 1 / 6) < 0.001,
    `Expected ~0.1667, got ${result.probability_at_least}`
  );
});

// ---- Max depth control ----

test("max_depth=1 limits explosion chain", () => {
  const result = run({ sides: 6, max_depth: 1 });
  // With max_depth=1: first roll 1-5 stops, roll 6 explodes once then stops
  // Max possible value: 6 + 6 = 12
  const maxVal = Math.max(...result.tail_probabilities.map((e) => e.value));
  assert.strictEqual(maxVal, 12, `Max value with depth 1 should be 12, got ${maxVal}`);
});

test("max_depth=2 allows higher values than depth=1", () => {
  const result = run({ sides: 6, max_depth: 2 });
  const maxVal = Math.max(...result.tail_probabilities.map((e) => e.value));
  assert.strictEqual(maxVal, 18, `Max value with depth 2 should be 18, got ${maxVal}`);
});

// ---- Validation ----

test("invalid sides throws", () => {
  assert.throws(
    () => run({ sides: 1 }),
    /integer >= 2/
  );
});

test("invalid max_depth throws", () => {
  assert.throws(
    () => run({ sides: 6, max_depth: 0 }),
    /positive integer/
  );
});

console.log("\nAll exploding-dice tests passed.\n");
