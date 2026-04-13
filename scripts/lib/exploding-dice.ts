/**
 * exploding-dice.ts — Exploding/acing dice probability calculator
 *
 * Purpose: Compute probabilities for exploding dice mechanics where
 * rolling the maximum face value lets you roll again and add.
 * Used in Savage Worlds, DCC RPG, Feng Shui, and others.
 *
 * Input:  { sides, target?, max_depth? }
 * Output: { expected_value, probability_at_least?, tail_probabilities }
 *
 * Expected value formula for exploding die with s sides:
 *   E = s(s+1) / (2(s-1))
 *
 * Tail probability calculation:
 *   For a value V achievable at explosion depth d:
 *   P(result = V) is the sum over all explosion paths that produce V.
 *   At depth d, the die has exploded d times (rolled max d times),
 *   contributing d*s to the running total, then the final roll is
 *   V - d*s which must be in [1, s-1] (or s if we're still iterating).
 *
 * Part of Gygax v3 probability scripts (Sprint 11).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExplodingDiceInput {
  sides: number;
  target?: number;
  max_depth?: number;
}

export interface TailProbabilityEntry {
  value: number;
  probability: number;
}

export interface ExplodingDiceOutput {
  expected_value: number;
  probability_at_least?: number;
  tail_probabilities: TailProbabilityEntry[];
}

// ---------------------------------------------------------------------------
// Core function (pure, no I/O)
// ---------------------------------------------------------------------------

export function run(input: ExplodingDiceInput): ExplodingDiceOutput {
  const { sides, target, max_depth = 10 } = input;

  if (sides < 2 || !Number.isInteger(sides)) {
    throw new Error(`Die sides must be an integer >= 2, got: ${sides}`);
  }
  if (max_depth < 1 || !Number.isInteger(max_depth)) {
    throw new Error(`Max depth must be a positive integer, got: ${max_depth}`);
  }

  const s = sides;

  // Expected value: E = s(s+1) / (2(s-1))
  // Derivation: E = sum_{k=0}^{inf} (1/s)^k * (s+1)/2 * ... but the closed form is:
  // E = (s+1)/2 + (1/s)*E  =>  E - E/s = (s+1)/2  =>  E(s-1)/s = (s+1)/2
  // E = s(s+1) / (2(s-1))
  const expected_value = (s * (s + 1)) / (2 * (s - 1));

  // Build probability distribution up to max_depth explosions.
  // At each depth d (0-indexed), the die has exploded d times.
  // P(reaching depth d) = (1/s)^d
  // At depth d, if d < max_depth: roll 1..s, if s: explode again, else stop.
  // At depth d == max_depth: roll 1..s and always stop (no further explosion).
  //
  // We build a map: value -> probability
  const probMap = new Map<number, number>();

  function addProb(value: number, prob: number) {
    probMap.set(value, (probMap.get(value) || 0) + prob);
  }

  // For each depth level d (0 = first roll, 1 = first explosion, etc.)
  for (let d = 0; d <= max_depth; d++) {
    // Probability of reaching this depth: (1/s)^d
    const pReach = Math.pow(1 / s, d);
    // Running total from explosions: d * s (each explosion contributed max face)
    const base = d * s;

    if (d < max_depth) {
      // At this depth, faces 1..(s-1) terminate; face s causes explosion
      for (let face = 1; face < s; face++) {
        addProb(base + face, pReach * (1 / s));
      }
      // Face s: continue to next depth (don't add here, handled at depth d+1)
    } else {
      // At max depth, all faces 1..s terminate (no further explosion)
      for (let face = 1; face <= s; face++) {
        addProb(base + face, pReach * (1 / s));
      }
    }
  }

  // Sort by value and build tail_probabilities array
  const values = Array.from(probMap.keys()).sort((a, b) => a - b);
  const tail_probabilities: TailProbabilityEntry[] = values.map((v) => ({
    value: v,
    probability: probMap.get(v)!,
  }));

  const result: ExplodingDiceOutput = {
    expected_value,
    tail_probabilities,
  };

  // If target specified, compute P(result >= target)
  if (target !== undefined) {
    let pAtLeast = 0;
    for (const entry of tail_probabilities) {
      if (entry.value >= target) {
        pAtLeast += entry.probability;
      }
    }
    result.probability_at_least = pAtLeast;
  }

  return result;
}

// ---------------------------------------------------------------------------
// CLI wrapper: reads JSON from stdin, writes JSON to stdout
// ---------------------------------------------------------------------------

if (typeof process !== "undefined" && process.argv[1]?.endsWith("exploding-dice.ts")) {
  let data = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk: string) => { data += chunk; });
  process.stdin.on("end", () => {
    try {
      const input: ExplodingDiceInput = JSON.parse(data);
      const output = run(input);
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });
}
