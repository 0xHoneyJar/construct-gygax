/**
 * dice-pool.test.ts — Tests for binomial success-counting dice pool calculator
 *
 * Test fixtures from SDD Section 3.2:
 *   pool=5, die_sides=10, success_threshold=7 (p=0.4),
 *   required_successes=2 -> P(k>=2) ~ 0.6630
 */

import assert from "node:assert";
import { run } from "./dice-pool";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

console.log("dice-pool.ts");

// ---- SDD fixture: Storyteller-style pool ----

test("5d10 threshold 7, need 2+ successes: P ~ 0.6630", () => {
  const result = run({
    pool: 5,
    die_sides: 10,
    success_threshold: 7,
    required_successes: 2,
  });
  assert.ok(
    Math.abs(result.probability_k_or_more_successes - 0.6630) < 0.001,
    `Expected ~0.6630, got ${result.probability_k_or_more_successes}`
  );
});

test("5d10 threshold 7: expected_successes = 2.0", () => {
  // p = 4/10 = 0.4, E = 5 * 0.4 = 2.0
  const result = run({
    pool: 5,
    die_sides: 10,
    success_threshold: 7,
    required_successes: 1,
  });
  assert.ok(
    Math.abs(result.expected_successes - 2.0) < 1e-10,
    `Expected 2.0, got ${result.expected_successes}`
  );
});

// ---- Distribution properties ----

test("distribution sums to 1.0", () => {
  const result = run({
    pool: 5,
    die_sides: 10,
    success_threshold: 7,
    required_successes: 0,
  });
  const total = result.distribution.reduce((sum, e) => sum + e.probability, 0);
  assert.ok(
    Math.abs(total - 1.0) < 1e-10,
    `Distribution sums to ${total}, expected 1.0`
  );
});

test("distribution has pool+1 entries", () => {
  const result = run({
    pool: 5,
    die_sides: 10,
    success_threshold: 7,
    required_successes: 0,
  });
  assert.strictEqual(result.distribution.length, 6); // 0..5
});

test("distribution entries are indexed 0..pool", () => {
  const result = run({
    pool: 3,
    die_sides: 6,
    success_threshold: 5,
    required_successes: 0,
  });
  for (let k = 0; k <= 3; k++) {
    assert.strictEqual(result.distribution[k].k, k);
  }
});

// ---- Edge cases ----

test("required_successes = 0: P(k >= 0) = 1.0", () => {
  const result = run({
    pool: 5,
    die_sides: 10,
    success_threshold: 7,
    required_successes: 0,
  });
  assert.ok(
    Math.abs(result.probability_k_or_more_successes - 1.0) < 1e-10,
    `Expected 1.0, got ${result.probability_k_or_more_successes}`
  );
});

test("required_successes > pool: P = very low but defined", () => {
  const result = run({
    pool: 2,
    die_sides: 6,
    success_threshold: 6,
    required_successes: 3,
  });
  // Can't get 3 successes from 2 dice
  assert.ok(
    Math.abs(result.probability_k_or_more_successes) < 1e-10,
    `Expected ~0, got ${result.probability_k_or_more_successes}`
  );
});

test("pool = 0: P(k >= 0) = 1, P(k >= 1) = 0", () => {
  const result0 = run({
    pool: 0,
    die_sides: 6,
    success_threshold: 4,
    required_successes: 0,
  });
  assert.ok(Math.abs(result0.probability_k_or_more_successes - 1.0) < 1e-10);

  const result1 = run({
    pool: 0,
    die_sides: 6,
    success_threshold: 4,
    required_successes: 1,
  });
  assert.ok(Math.abs(result1.probability_k_or_more_successes) < 1e-10);
});

// ---- Shadowrun-style: 6d6 threshold 5, need 3+ ----

test("Shadowrun-style: 6d6, threshold 5, need 3+ successes", () => {
  // p = (6-5+1)/6 = 2/6 = 1/3
  // P(X >= 3) from binomial(6, 1/3)
  // P(X=0) = (2/3)^6 = 64/729
  // P(X=1) = 6*(1/3)*(2/3)^5 = 6*32/729 = 192/729
  // P(X=2) = 15*(1/3)^2*(2/3)^4 = 15*16/729 = 240/729
  // P(X<3) = (64+192+240)/729 = 496/729
  // P(X>=3) = 1 - 496/729 = 233/729 ~ 0.3196
  const result = run({
    pool: 6,
    die_sides: 6,
    success_threshold: 5,
    required_successes: 3,
  });
  assert.ok(
    Math.abs(result.probability_k_or_more_successes - 233 / 729) < 0.001,
    `Expected ~0.3196, got ${result.probability_k_or_more_successes}`
  );
});

// ---- Validation ----

test("invalid pool throws", () => {
  assert.throws(
    () => run({ pool: -1, die_sides: 6, success_threshold: 4, required_successes: 1 }),
    /non-negative integer/
  );
});

test("threshold out of range throws", () => {
  assert.throws(
    () => run({ pool: 3, die_sides: 6, success_threshold: 7, required_successes: 1 }),
    /between 1 and/
  );
});

console.log("\nAll dice-pool tests passed.\n");
