/**
 * dice-probability.ts — Single-die probability calculator
 *
 * Purpose: Compute basic probability facts for a single fair die.
 * Supports standard die sizes: d4, d6, d8, d10, d12, d20, d100.
 *
 * Input:  { sides: 4|6|8|10|12|20|100, target?: number }
 * Output: { probability_per_face, expected_value, probability_at_least?, probability_exact? }
 *
 * Part of Gygax v3 probability scripts (Sprint 11).
 * Invoked by /augury for single-die resolution math.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiceProbabilityInput {
  sides: 4 | 6 | 8 | 10 | 12 | 20 | 100;
  target?: number;
}

export interface DiceProbabilityOutput {
  probability_per_face: number;
  expected_value: number;
  probability_at_least?: number;
  probability_exact?: number;
}

// ---------------------------------------------------------------------------
// Valid die sizes
// ---------------------------------------------------------------------------

const VALID_SIDES = new Set([4, 6, 8, 10, 12, 20, 100]);

// ---------------------------------------------------------------------------
// Core function (pure, no I/O)
// ---------------------------------------------------------------------------

export function run(input: DiceProbabilityInput): DiceProbabilityOutput {
  const { sides, target } = input;

  if (!VALID_SIDES.has(sides)) {
    throw new Error(`Invalid die size: ${sides}. Must be one of: 4, 6, 8, 10, 12, 20, 100`);
  }

  const probability_per_face = 1 / sides;

  // Expected value of a fair die: (1 + s) / 2
  const expected_value = (1 + sides) / 2;

  const result: DiceProbabilityOutput = {
    probability_per_face,
    expected_value,
  };

  if (target !== undefined) {
    if (target < 1) {
      // Every roll meets a target below 1
      result.probability_at_least = 1;
      result.probability_exact = 0;
    } else if (target > sides) {
      // No roll can meet a target above the max face
      result.probability_at_least = 0;
      result.probability_exact = 0;
    } else {
      // P(roll >= target) = (sides - target + 1) / sides
      result.probability_at_least = (sides - target + 1) / sides;
      // P(roll == target) = 1 / sides
      result.probability_exact = 1 / sides;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// CLI wrapper: reads JSON from stdin, writes JSON to stdout
// ---------------------------------------------------------------------------

if (typeof process !== "undefined" && process.argv[1]?.endsWith("dice-probability.ts")) {
  let data = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk: string) => { data += chunk; });
  process.stdin.on("end", () => {
    try {
      const input: DiceProbabilityInput = JSON.parse(data);
      const output = run(input);
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });
}
