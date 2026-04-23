/**
 * opposed-roll.test.ts — Tests for opposed roll probability calculator
 *
 * Covers: single vs single, single vs fixed, sum vs sum,
 * tie resolution, delta distribution, modifiers.
 */

import assert from "node:assert";
import { run } from "./opposed-roll";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

console.log("opposed-roll.ts");

// ---- d6 vs d6: canonical symmetric case ----

test("d6 vs d6: symmetric — attacker and defender each win ~41.67%", () => {
  const result = run({
    attacker: { type: "single", sides: 6 },
    defender: { type: "single", sides: 6 },
  });
  // 15/36 = 0.41667 for each side, 6/36 = 0.16667 tie
  assert.ok(
    Math.abs(result.attacker_wins - 15 / 36) < 1e-10,
    `Expected attacker_wins ~0.4167, got ${result.attacker_wins}`
  );
  assert.ok(
    Math.abs(result.defender_wins - 15 / 36) < 1e-10,
    `Expected defender_wins ~0.4167, got ${result.defender_wins}`
  );
  assert.ok(
    Math.abs(result.tie - 6 / 36) < 1e-10,
    `Expected tie ~0.1667, got ${result.tie}`
  );
});

test("d6 vs d6: probabilities sum to 1.0", () => {
  const result = run({
    attacker: { type: "single", sides: 6 },
    defender: { type: "single", sides: 6 },
  });
  const total = result.attacker_wins + result.defender_wins + result.tie;
  assert.ok(Math.abs(total - 1.0) < 1e-10, `Sum = ${total}, expected 1.0`);
});

test("d6 vs d6: means are both 3.5", () => {
  const result = run({
    attacker: { type: "single", sides: 6 },
    defender: { type: "single", sides: 6 },
  });
  assert.ok(Math.abs(result.attacker_mean - 3.5) < 1e-10);
  assert.ok(Math.abs(result.defender_mean - 3.5) < 1e-10);
});

// ---- Tie resolution ----

test("tie_goes_to attacker: ties absorbed into attacker_wins", () => {
  const result = run({
    attacker: { type: "single", sides: 6 },
    defender: { type: "single", sides: 6 },
    tie_goes_to: "attacker",
  });
  assert.ok(
    Math.abs(result.attacker_wins - 21 / 36) < 1e-10,
    `Expected 21/36, got ${result.attacker_wins}`
  );
  assert.ok(Math.abs(result.tie) < 1e-10, `Expected tie=0, got ${result.tie}`);
});

test("tie_goes_to defender: ties absorbed into defender_wins", () => {
  const result = run({
    attacker: { type: "single", sides: 6 },
    defender: { type: "single", sides: 6 },
    tie_goes_to: "defender",
  });
  assert.ok(
    Math.abs(result.defender_wins - 21 / 36) < 1e-10,
    `Expected 21/36, got ${result.defender_wins}`
  );
  assert.ok(Math.abs(result.tie) < 1e-10);
});

// ---- Single die vs fixed value (attack vs AC) ----

test("d20 vs fixed 15: P(attacker wins) = 6/20 = 0.30", () => {
  // d20 must roll strictly greater than 15: faces 16-20 = 5 faces
  // Wait — attacker wins when d20 > 15, which is 5/20 = 0.25
  // Tie when d20 = 15, which is 1/20 = 0.05
  const result = run({
    attacker: { type: "single", sides: 20 },
    defender: { type: "fixed", value: 15 },
  });
  assert.ok(
    Math.abs(result.attacker_wins - 5 / 20) < 1e-10,
    `Expected 0.25, got ${result.attacker_wins}`
  );
  assert.ok(
    Math.abs(result.tie - 1 / 20) < 1e-10,
    `Expected 0.05 tie, got ${result.tie}`
  );
});

test("d20+5 vs fixed 15: attacker beats more often", () => {
  // d20+5 ranges from 6-25. Attacker wins when d20+5 > 15, i.e. d20 > 10
  // That's faces 11-20 = 10/20 = 0.50
  // Tie when d20+5 = 15, i.e. d20 = 10 = 1/20 = 0.05
  const result = run({
    attacker: { type: "single", sides: 20, modifier: 5 },
    defender: { type: "fixed", value: 15 },
  });
  assert.ok(
    Math.abs(result.attacker_wins - 10 / 20) < 1e-10,
    `Expected 0.50, got ${result.attacker_wins}`
  );
  assert.ok(
    Math.abs(result.tie - 1 / 20) < 1e-10,
    `Expected 0.05 tie, got ${result.tie}`
  );
});

// ---- Sum vs sum (Cepheus opposed: 2d6 vs 2d6) ----

test("2d6 vs 2d6: symmetric, means are 7", () => {
  const result = run({
    attacker: { type: "sum", dice: 2, sides: 6 },
    defender: { type: "sum", dice: 2, sides: 6 },
  });
  assert.ok(Math.abs(result.attacker_mean - 7) < 1e-10);
  assert.ok(Math.abs(result.defender_mean - 7) < 1e-10);
  // Symmetric: attacker_wins = defender_wins
  assert.ok(
    Math.abs(result.attacker_wins - result.defender_wins) < 1e-10,
    `Should be symmetric: a=${result.attacker_wins}, d=${result.defender_wins}`
  );
});

test("2d6 vs 2d6: probabilities sum to 1.0", () => {
  const result = run({
    attacker: { type: "sum", dice: 2, sides: 6 },
    defender: { type: "sum", dice: 2, sides: 6 },
  });
  const total = result.attacker_wins + result.defender_wins + result.tie;
  assert.ok(Math.abs(total - 1.0) < 1e-10, `Sum = ${total}`);
});

// ---- Asymmetric: d8 vs d6 (attacker has larger die) ----

test("d8 vs d6: attacker wins more than defender", () => {
  const result = run({
    attacker: { type: "single", sides: 8 },
    defender: { type: "single", sides: 6 },
  });
  assert.ok(
    result.attacker_wins > result.defender_wins,
    `d8 should beat d6 more often: a=${result.attacker_wins}, d=${result.defender_wins}`
  );
  assert.ok(Math.abs(result.attacker_mean - 4.5) < 1e-10);
  assert.ok(Math.abs(result.defender_mean - 3.5) < 1e-10);
});

// ---- Delta distribution ----

test("delta distribution sums to 1.0", () => {
  const result = run({
    attacker: { type: "single", sides: 6 },
    defender: { type: "single", sides: 6 },
  });
  const total = result.delta_distribution.reduce((s, e) => s + e.probability, 0);
  assert.ok(Math.abs(total - 1.0) < 1e-10, `Delta sum = ${total}`);
});

test("d6 vs d6 delta distribution: delta=0 has probability 6/36", () => {
  const result = run({
    attacker: { type: "single", sides: 6 },
    defender: { type: "single", sides: 6 },
  });
  const tieEntry = result.delta_distribution.find((e) => e.delta === 0);
  assert.ok(tieEntry, "Should have delta=0 entry");
  assert.ok(
    Math.abs(tieEntry.probability - 6 / 36) < 1e-10,
    `Expected 6/36, got ${tieEntry.probability}`
  );
});

test("d6 vs d6 delta range is -5 to +5", () => {
  const result = run({
    attacker: { type: "single", sides: 6 },
    defender: { type: "single", sides: 6 },
  });
  const deltas = result.delta_distribution.map((e) => e.delta);
  assert.strictEqual(Math.min(...deltas), -5);
  assert.strictEqual(Math.max(...deltas), 5);
  assert.strictEqual(result.delta_distribution.length, 11); // -5 to +5
});

// ---- Validation ----

test("invalid die sides throws", () => {
  assert.throws(
    () =>
      run({
        attacker: { type: "single", sides: 1 },
        defender: { type: "single", sides: 6 },
      }),
    /integer >= 2/
  );
});

test("invalid spec type throws", () => {
  assert.throws(
    () =>
      run({
        attacker: { type: "pool" as any, sides: 6 },
        defender: { type: "single", sides: 6 },
      }),
    /type must be/
  );
});

console.log("\nAll opposed-roll tests passed.\n");
