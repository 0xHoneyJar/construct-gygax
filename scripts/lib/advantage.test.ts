/**
 * advantage.test.ts — Tests for advantage/disadvantage probability calculator
 *
 * Test fixtures from SDD Section 3.2:
 *   d20 advantage DC 11 -> P ~ 0.7500 (equivalent to +5 on flat roll)
 *
 * Verification: d20 advantage, P(max of 2d20 >= 11)
 *   P(max >= 11) = 1 - P(max <= 10) = 1 - (10/20)^2 = 1 - 0.25 = 0.75
 *   Flat P(d20 >= 11) = 10/20 = 0.5
 *   With +5: P(d20+5 >= 11) = P(d20 >= 6) = 15/20 = 0.75
 *   So effective bonus at DC 11 = +5. Confirmed.
 */

import assert from "node:assert";
import { run } from "./advantage";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

console.log("advantage.ts");

// ---- SDD fixture: d20 advantage DC 11 ----

test("d20 advantage P(>= 11) = 0.75", () => {
  const result = run({ sides: 20, mode: "advantage", target: 11 });
  assert.ok(
    Math.abs(result.probability_at_least! - 0.75) < 0.001,
    `Expected 0.75, got ${result.probability_at_least}`
  );
});

test("d20 advantage effective bonus at DC 11 ~ +5", () => {
  const result = run({ sides: 20, mode: "advantage" });
  const entry = result.effective_bonus_curve.find((e) => e.dc === 11);
  assert.ok(entry, "Should have entry for DC 11");
  assert.ok(
    Math.abs(entry!.effective_bonus - 5) < 0.1,
    `Expected ~+5, got ${entry!.effective_bonus}`
  );
});

// ---- Advantage mean ----

test("d20 advantage mean ~ 13.825", () => {
  // Mean of max(d20, d20) = (2*20+1)/3 * 20/(20) ... actually:
  // E[max(X,Y)] for uniform(1,n) = n - sum_{k=1}^{n-1} (k/n)^2
  // = 20 - (1/400)*sum_{k=1}^{19} k^2
  // = 20 - (19*20*39)/(6*400)
  // = 20 - 14820/2400
  // = 20 - 6.175 = 13.825
  const result = run({ sides: 20, mode: "advantage" });
  assert.ok(
    Math.abs(result.mean - 13.825) < 0.01,
    `Expected ~13.825, got ${result.mean}`
  );
});

// ---- Disadvantage ----

test("d20 disadvantage P(>= 11) = 0.25", () => {
  // P(min >= 11) = P(both >= 11) = (10/20)^2 = 0.25
  const result = run({ sides: 20, mode: "disadvantage", target: 11 });
  assert.ok(
    Math.abs(result.probability_at_least! - 0.25) < 0.001,
    `Expected 0.25, got ${result.probability_at_least}`
  );
});

test("d20 disadvantage mean ~ 7.175", () => {
  // E[min(X,Y)] = E[X] + E[Y] - E[max(X,Y)]
  // = 10.5 + 10.5 - 13.825 = 7.175
  const result = run({ sides: 20, mode: "disadvantage" });
  assert.ok(
    Math.abs(result.mean - 7.175) < 0.01,
    `Expected ~7.175, got ${result.mean}`
  );
});

// ---- Effective bonus at extremes ----

test("d20 advantage effective bonus at DC 1 ~ 0 (always succeed anyway)", () => {
  const result = run({ sides: 20, mode: "advantage" });
  const entry = result.effective_bonus_curve.find((e) => e.dc === 1);
  assert.ok(entry, "Should have entry for DC 1");
  // P(adv >= 1) = 1, P(flat >= 1) = 1 => bonus ~ 0
  assert.ok(
    Math.abs(entry!.effective_bonus) < 0.5,
    `Expected ~0, got ${entry!.effective_bonus}`
  );
});

test("d20 advantage effective bonus at DC 20 ~ 0.95", () => {
  // P(adv >= 20) = 1 - (19/20)^2 = 1 - 361/400 = 39/400 = 0.0975
  // Flat equivalent: P(d20 >= 20 - b) = 0.0975 => (20 - 20 + b + 1)/20 = 0.0975
  // b = 20*0.0975 - 1 = 1.95 - 1 = 0.95
  const result = run({ sides: 20, mode: "advantage" });
  const entry = result.effective_bonus_curve.find((e) => e.dc === 20);
  assert.ok(entry, "Should have entry for DC 20");
  assert.ok(
    Math.abs(entry!.effective_bonus - 0.95) < 0.1,
    `Expected ~0.95, got ${entry!.effective_bonus}`
  );
});

// ---- Effective bonus curve has correct length ----

test("effective_bonus_curve has exactly sides entries", () => {
  const result = run({ sides: 20, mode: "advantage" });
  assert.strictEqual(result.effective_bonus_curve.length, 20);
});

// ---- Modifier support ----

test("d20 advantage with +2 modifier, DC 13 = same as no modifier DC 11", () => {
  // With +2 modifier, P(max(d20,d20)+2 >= 13) = P(max >= 11) = 0.75
  const result = run({ sides: 20, mode: "advantage", target: 13, modifier: 2 });
  assert.ok(
    Math.abs(result.probability_at_least! - 0.75) < 0.001,
    `Expected 0.75, got ${result.probability_at_least}`
  );
});

// ---- d6 advantage (non-d20) ----

test("d6 advantage P(>= 4) = 1 - (3/6)^2 = 0.75", () => {
  const result = run({ sides: 6, mode: "advantage", target: 4 });
  assert.ok(
    Math.abs(result.probability_at_least! - 0.75) < 0.001,
    `Expected 0.75, got ${result.probability_at_least}`
  );
});

// ---- Symmetry check ----

test("advantage + disadvantage means sum to s+1", () => {
  const adv = run({ sides: 20, mode: "advantage" });
  const dis = run({ sides: 20, mode: "disadvantage" });
  // E[max] + E[min] = E[X] + E[Y] = 2 * E[X] = 21
  assert.ok(
    Math.abs(adv.mean + dis.mean - 21) < 0.01,
    `Expected sum 21, got ${adv.mean + dis.mean}`
  );
});

// ---- Validation ----

test("invalid mode throws", () => {
  assert.throws(
    () => run({ sides: 20, mode: "super" as any }),
    /Mode must be/
  );
});

console.log("\nAll advantage tests passed.\n");
