/**
 * bell-curve.ts — Multi-die summation probability calculator
 *
 * Purpose: Compute the full probability distribution for rolling
 * multiple dice and summing them (e.g. 3d6, 2d6+3, 4d6).
 * Core mechanic in Traveller/Cepheus, GURPS, and similar systems.
 *
 * Input:  { dice, sides, modifier?, target? }
 * Output: { mean, stdev, cdf, probability_at_least? }
 *
 * Uses convolution (polynomial multiplication) to build the exact
 * distribution. For NdS, the distribution of sum(d1..dN) is the
 * N-fold convolution of the uniform distribution on {1..S}.
 *
 * Part of Gygax v3 probability scripts (Sprint 11).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BellCurveInput {
  dice: number;
  sides: number;
  modifier?: number;
  target?: number;
}

export interface CdfEntry {
  value: number;
  probability_at_least: number;
  probability_at_most: number;
  probability_exact: number;
}

export interface BellCurveOutput {
  mean: number;
  stdev: number;
  cdf: CdfEntry[];
  probability_at_least?: number;
}

// ---------------------------------------------------------------------------
// Core function (pure, no I/O)
// ---------------------------------------------------------------------------

export function run(input: BellCurveInput): BellCurveOutput {
  const { dice, sides, modifier = 0, target } = input;

  if (dice < 1 || !Number.isInteger(dice)) {
    throw new Error(`Number of dice must be a positive integer, got: ${dice}`);
  }
  if (sides < 2 || !Number.isInteger(sides)) {
    throw new Error(`Die sides must be an integer >= 2, got: ${sides}`);
  }

  // Build the distribution via convolution.
  // We represent a distribution as an array where index i holds P(sum = i + offset).
  // For one die: P(1)=P(2)=...=P(s) = 1/s, stored as dist[0..s-1].
  // Offset starts at 1 (minimum value of one die).

  // Start with distribution for one die: uniform on {1..sides}
  let dist = new Array(sides).fill(1 / sides);
  // Current minimum sum value represented by dist[0]
  let minVal = 1;

  // Convolve (dice - 1) more times
  for (let d = 1; d < dice; d++) {
    const newLen = dist.length + sides - 1;
    const newDist = new Array(newLen).fill(0);

    for (let i = 0; i < dist.length; i++) {
      for (let face = 0; face < sides; face++) {
        newDist[i + face] += dist[i] * (1 / sides);
      }
    }

    dist = newDist;
    minVal += 1; // each die adds at least 1
  }

  // Apply modifier: shift all values but probabilities stay the same
  const effectiveMin = minVal + modifier;

  // Mean of NdS + mod = N * (S+1)/2 + mod
  const mean = dice * (sides + 1) / 2 + modifier;

  // Variance of NdS = N * (S^2 - 1) / 12
  const variance = dice * (sides * sides - 1) / 12;
  const stdev = Math.sqrt(variance);

  // Build CDF entries
  const cdf: CdfEntry[] = [];

  // First pass: exact probabilities
  for (let i = 0; i < dist.length; i++) {
    cdf.push({
      value: effectiveMin + i,
      probability_exact: dist[i],
      probability_at_least: 0, // filled in next pass
      probability_at_most: 0,  // filled in next pass
    });
  }

  // Fill probability_at_most (cumulative from left)
  let cumLeft = 0;
  for (let i = 0; i < cdf.length; i++) {
    cumLeft += cdf[i].probability_exact;
    cdf[i].probability_at_most = cumLeft;
  }

  // Fill probability_at_least (cumulative from right)
  let cumRight = 0;
  for (let i = cdf.length - 1; i >= 0; i--) {
    cumRight += cdf[i].probability_exact;
    cdf[i].probability_at_least = cumRight;
  }

  // Build result
  const result: BellCurveOutput = { mean, stdev, cdf };

  // If target specified, find P(sum >= target)
  if (target !== undefined) {
    const entry = cdf.find((e) => e.value === target);
    if (entry) {
      result.probability_at_least = entry.probability_at_least;
    } else if (target < cdf[0].value) {
      // Target below minimum: always succeed
      result.probability_at_least = 1;
    } else {
      // Target above maximum: never succeed
      result.probability_at_least = 0;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// CLI wrapper: reads JSON from stdin, writes JSON to stdout
// ---------------------------------------------------------------------------

if (typeof process !== "undefined" && process.argv[1]?.endsWith("bell-curve.ts")) {
  let data = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk: string) => { data += chunk; });
  process.stdin.on("end", () => {
    try {
      const input: BellCurveInput = JSON.parse(data);
      const output = run(input);
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });
}
