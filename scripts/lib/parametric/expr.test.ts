/**
 * expr.test.ts — adversarial + correctness tests for the restricted interpreter (B.3, R5/R6).
 * Convention: `npx tsx scripts/lib/parametric/expr.test.ts`
 */
import assert from "node:assert";
import { compile, validateFormula, FormulaError } from "./expr.ts";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

function rejects(formula: string, allowed: string[] = ["wave"]) {
  assert.throws(() => compile(formula, allowed), FormulaError, `expected FormulaError for: ${formula}`);
}

console.log("expr.ts — restricted arithmetic interpreter\n");

// ---- K1 / fail-closed: reject anything outside the whitelist ----

test("rejects eval", () => rejects("eval(1)"));
test("rejects new Function", () => rejects("new Function(1)"));
test("rejects member access (Math.floor)", () => rejects("Math.floor(1)"));
test("rejects property access a.b", () => rejects("wave.constructor"));
test("rejects computed member a[0]", () => rejects("wave[0]"));
test("rejects unknown function", () => rejects("sqrt(wave)"));
test("rejects unknown identifier", () => rejects("depth + 1"));
test("rejects statement separators", () => rejects("1; 2"));
test("rejects assignment", () => rejects("wave = 1"));
test("rejects trailing garbage", () => rejects("1 + 2 foo"));
test("rejects empty formula", () => rejects(""));
test("rejects a bare whitelisted function name with no args", () => rejects("floor"));
test("rejects wrong arity for unary func", () => rejects("floor(1, 2)"));

// ---- accepts the whitelist + the A.0 fixture formulas ----

test("accepts the A.0 fixture model formulas", () => {
  assert.strictEqual(validateFormula("12", ["wave"]), null);
  assert.strictEqual(validateFormula("min(4, floor(wave / 4))", ["wave"]), null);
  assert.strictEqual(validateFormula("60 + 6*wave + 200*floor(wave / 16)", ["wave"]), null);
  assert.strictEqual(validateFormula("3 + floor(wave / 5)", ["wave"]), null);
});

test("accepts composed metric formulas with multiple names", () => {
  const names = ["wave", "player_attack", "enemy_armor", "enemy_hp", "damage_per_hit"];
  assert.strictEqual(validateFormula("max(1, player_attack - enemy_armor)", names), null);
  assert.strictEqual(validateFormula("ceil(enemy_hp / damage_per_hit)", names), null);
});

// ---- correctness ----

test("evaluates floor/min/max correctly", () => {
  const f = compile("min(4, floor(wave / 4))", ["wave"]);
  assert.strictEqual(f({ wave: 3 }), 0);
  assert.strictEqual(f({ wave: 8 }), 2);
  assert.strictEqual(f({ wave: 20 }), 4); // capped by min(4, 5)
});

test("respects operator precedence", () => {
  assert.strictEqual(compile("2 + 3 * 4", [])({}), 14);
  assert.strictEqual(compile("(2 + 3) * 4", [])({}), 20);
  assert.strictEqual(compile("-5 + 2", [])({}), -3);
  assert.strictEqual(compile("10 % 3", [])({}), 1);
});

test("evaluates a multi-name composed formula", () => {
  const f = compile("max(1, player_attack - enemy_armor)", ["player_attack", "enemy_armor"]);
  assert.strictEqual(f({ player_attack: 12, enemy_armor: 4 }), 8);
  assert.strictEqual(f({ player_attack: 12, enemy_armor: 20 }), 1); // floored at 1
});

test("division by zero throws FormulaError (not Infinity)", () => {
  assert.throws(() => compile("wave / 0", ["wave"])({ wave: 5 }), FormulaError);
});

console.log("\nAll expr.ts tests passed.\n");
