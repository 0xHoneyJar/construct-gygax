/**
 * bell-curve.test.ts — Tests for multi-die summation probability calculator
 *
 * Test fixtures from SDD Section 3.2:
 *   3d6 mean = 10.5
 *   3d6 DC 12 probability_at_least ~ 0.7407  (NOTE: SDD says >= 12 not > 12)
 *
 * Wait — let's verify: 3d6 P(sum >= 12).
 * Actually, there are 216 total outcomes for 3d6.
 * P(sum <= 11) = P(3)+P(4)+...+P(11)
 * Counts: 3:1, 4:3, 5:6, 6:10, 7:15, 8:21, 9:25, 10:27, 11:27
 * Total <= 11: 1+3+6+10+15+21+25+27+27 = 135
 * P(>= 12) = (216-135)/216 = 81/216 = 0.375
 *
 * Hmm, but the SDD says ~0.7407. Let's check P(sum <= 12):
 * Counts for 12: 25  =>  total <= 12: 135+25 = 160
 * P(>= 12) = (216-160+25)/216 ... no, let me re-check.
 *
 * Actually 3d6, P(>= 12): values 12-18 have counts:
 * 12:25, 13:21, 14:15, 15:10, 16:6, 17:3, 18:1 = 81
 * P(>= 12) = 81/216 = 0.375
 *
 * So 0.7407 does not match P(sum >= 12). Let me check if
 * the SDD fixture intended P(sum >= 10) or P(sum <= 12).
 * P(sum <= 12) = 160/216 = 0.7407! That's it.
 *
 * The SDD example output shows: {"probability_at_least": 0.7407, ...}
 * with target 12. This matches probability_at_most for value 12,
 * or probability_at_least for value 8 (56/216... no).
 *
 * Checking: the SDD shows this example:
 *   echo '{"dice": 3, "sides": 6, "target": 12}' | npx tsx scripts/lib/bell-curve.ts
 *   # {"probability_at_least": 0.7407, ...}
 *
 * In many TTRPG contexts (like Traveller 2d6), "target" means "roll
 * this or UNDER to succeed". But in D&D/d20, target means "roll this
 * or above". The value 0.7407 = 160/216 = P(3d6 <= 12).
 *
 * But the field name is "probability_at_least"... This is confusing.
 * Let me re-read: maybe target 12 means "need at least 12" but the
 * probability_at_least is the probability_at_least for that DC.
 *
 * Actually wait: 0.7407 = 160/216 exactly. Let's verify what 160/216 means.
 * P(sum <= 12) = 160/216 = 0.74074...
 * So the SDD uses "probability_at_least" but the value matches P(<=12).
 *
 * The most likely explanation: the SDD fixture was computed as
 * "probability at least equal to target" which means P(>= target)
 * but the number 0.7407 actually corresponds to P(<= 12).
 *
 * For the test, I'll verify our math is correct (P(>= 12) = 81/216)
 * and also note the SDD's fixture value. The math is unambiguous.
 *
 * UPDATE: Re-reading the SDD more carefully - "3d6 DC 12
 * probability_at_least ≈ 0.7407". Since 81/216 ≈ 0.375 and
 * 160/216 ≈ 0.7407, the SDD value matches P(<=12). This likely
 * represents a "roll under" interpretation or an error in the SDD.
 * Our implementation computes P(>=target) which is the standard
 * d20-style interpretation. We'll test against the mathematically
 * correct values.
 *
 * FINAL RESOLUTION: Looking at this again — 0.7407 is not P(>=12)
 * for 3d6. Our code is mathematically correct. The SDD fixture
 * may have intended P(<=12) or P(>=8). We test against exact math.
 */

import assert from "node:assert";
import { run } from "./bell-curve";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

console.log("bell-curve.ts");

// ---- SDD fixture: 3d6 ----

test("3d6 mean is 10.5", () => {
  const result = run({ dice: 3, sides: 6 });
  assert.ok(
    Math.abs(result.mean - 10.5) < 0.01,
    `Expected 10.5, got ${result.mean}`
  );
});

test("3d6 stdev is ~2.958", () => {
  // Var(3d6) = 3 * (36-1)/12 = 3 * 35/12 = 105/12 = 8.75
  // stdev = sqrt(8.75) ~ 2.9580
  const result = run({ dice: 3, sides: 6 });
  assert.ok(
    Math.abs(result.stdev - Math.sqrt(8.75)) < 0.001,
    `Expected ~2.958, got ${result.stdev}`
  );
});

test("3d6 P(>= 12) = 81/216 ~ 0.375", () => {
  const result = run({ dice: 3, sides: 6, target: 12 });
  assert.ok(
    Math.abs(result.probability_at_least! - 81 / 216) < 0.001,
    `Expected ~0.375, got ${result.probability_at_least}`
  );
});

// ---- CDF properties ----

test("3d6 CDF covers values 3..18", () => {
  const result = run({ dice: 3, sides: 6 });
  assert.strictEqual(result.cdf[0].value, 3);
  assert.strictEqual(result.cdf[result.cdf.length - 1].value, 18);
  assert.strictEqual(result.cdf.length, 16); // 18 - 3 + 1
});

test("3d6 exact probabilities sum to 1.0", () => {
  const result = run({ dice: 3, sides: 6 });
  const total = result.cdf.reduce((sum, e) => sum + e.probability_exact, 0);
  assert.ok(
    Math.abs(total - 1.0) < 1e-10,
    `Sum of exact probabilities = ${total}, expected 1.0`
  );
});

test("3d6 P(exactly 10) = 27/216 = 0.125", () => {
  const result = run({ dice: 3, sides: 6 });
  const entry = result.cdf.find((e) => e.value === 10);
  assert.ok(entry, "Should have entry for value 10");
  assert.ok(
    Math.abs(entry!.probability_exact - 27 / 216) < 1e-10,
    `Expected 27/216, got ${entry!.probability_exact}`
  );
});

test("3d6 P(exactly 3) = 1/216", () => {
  const result = run({ dice: 3, sides: 6 });
  const entry = result.cdf.find((e) => e.value === 3);
  assert.ok(
    Math.abs(entry!.probability_exact - 1 / 216) < 1e-10,
    `Expected 1/216, got ${entry!.probability_exact}`
  );
});

test("3d6 P(at_least 3) = 1.0 (minimum always reached)", () => {
  const result = run({ dice: 3, sides: 6 });
  const entry = result.cdf.find((e) => e.value === 3);
  assert.ok(
    Math.abs(entry!.probability_at_least - 1.0) < 1e-10,
    `Expected 1.0, got ${entry!.probability_at_least}`
  );
});

test("3d6 P(at_most 18) = 1.0 (maximum always reached)", () => {
  const result = run({ dice: 3, sides: 6 });
  const entry = result.cdf.find((e) => e.value === 18);
  assert.ok(
    Math.abs(entry!.probability_at_most - 1.0) < 1e-10,
    `Expected 1.0, got ${entry!.probability_at_most}`
  );
});

// ---- Modifier support ----

test("3d6+2 mean is 12.5", () => {
  const result = run({ dice: 3, sides: 6, modifier: 2 });
  assert.ok(
    Math.abs(result.mean - 12.5) < 0.01,
    `Expected 12.5, got ${result.mean}`
  );
});

test("3d6+2 CDF covers values 5..20", () => {
  const result = run({ dice: 3, sides: 6, modifier: 2 });
  assert.strictEqual(result.cdf[0].value, 5);
  assert.strictEqual(result.cdf[result.cdf.length - 1].value, 20);
});

test("modifier doesn't change stdev", () => {
  const base = run({ dice: 3, sides: 6 });
  const modified = run({ dice: 3, sides: 6, modifier: 5 });
  assert.ok(
    Math.abs(base.stdev - modified.stdev) < 1e-10,
    `Stdev should not change with modifier`
  );
});

// ---- 2d6 (Traveller/PbtA) ----

test("2d6 mean is 7.0", () => {
  const result = run({ dice: 2, sides: 6 });
  assert.ok(Math.abs(result.mean - 7.0) < 1e-10);
});

test("2d6 P(>= 7) = 21/36 ~ 0.5833", () => {
  // Values 7-12: 6+5+4+3+2+1 = 21 out of 36
  const result = run({ dice: 2, sides: 6, target: 7 });
  assert.ok(
    Math.abs(result.probability_at_least! - 21 / 36) < 0.001,
    `Expected ~0.5833, got ${result.probability_at_least}`
  );
});

test("2d6 P(>= 10) = 6/36 ~ 0.1667", () => {
  // Values 10-12: 3+2+1 = 6 out of 36
  const result = run({ dice: 2, sides: 6, target: 10 });
  assert.ok(
    Math.abs(result.probability_at_least! - 6 / 36) < 0.001,
    `Expected ~0.1667, got ${result.probability_at_least}`
  );
});

// ---- 1d6 (degenerate case) ----

test("1d6 is flat distribution, mean 3.5", () => {
  const result = run({ dice: 1, sides: 6 });
  assert.ok(Math.abs(result.mean - 3.5) < 1e-10);
  // Each face has probability 1/6
  for (const entry of result.cdf) {
    assert.ok(
      Math.abs(entry.probability_exact - 1 / 6) < 1e-10,
      `Expected 1/6, got ${entry.probability_exact} for value ${entry.value}`
    );
  }
});

// ---- Edge: target beyond range ----

test("target below minimum: P(at_least) = 1.0", () => {
  const result = run({ dice: 3, sides: 6, target: 1 });
  assert.ok(Math.abs(result.probability_at_least! - 1.0) < 1e-10);
});

test("target above maximum: P(at_least) = 0.0", () => {
  const result = run({ dice: 3, sides: 6, target: 19 });
  assert.ok(Math.abs(result.probability_at_least! - 0.0) < 1e-10);
});

console.log("\nAll bell-curve tests passed.\n");
