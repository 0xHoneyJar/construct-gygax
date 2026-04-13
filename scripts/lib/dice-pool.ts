/**
 * dice-pool.ts — Binomial success-counting dice pool calculator
 *
 * Purpose: Compute probabilities for "roll N dice, count successes"
 * mechanics found in Shadowrun, Storyteller (World of Darkness),
 * Forged in the Dark, and similar systems.
 *
 * Input:  { pool, die_sides, success_threshold, required_successes }
 * Output: { probability_k_or_more_successes, expected_successes, distribution }
 *
 * Uses binomial distribution: P(X=k) = C(n,k) * p^k * (1-p)^(n-k)
 * where p = (die_sides - success_threshold + 1) / die_sides
 *
 * Part of Gygax v3 probability scripts (Sprint 11).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DicePoolInput {
  pool: number;
  die_sides: number;
  success_threshold: number;
  required_successes: number;
}

export interface DistributionEntry {
  k: number;
  probability: number;
}

export interface DicePoolOutput {
  probability_k_or_more_successes: number;
  expected_successes: number;
  distribution: DistributionEntry[];
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/**
 * Compute binomial coefficient C(n, k) using multiplicative formula.
 * Avoids factorial overflow for reasonable pool sizes.
 */
function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;

  // Optimize by using the smaller k
  if (k > n - k) k = n - k;

  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

/**
 * Compute P(X = k) for a binomial distribution.
 */
function binomialPmf(n: number, k: number, p: number): number {
  return binomial(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

// ---------------------------------------------------------------------------
// Core function (pure, no I/O)
// ---------------------------------------------------------------------------

export function run(input: DicePoolInput): DicePoolOutput {
  const { pool, die_sides, success_threshold, required_successes } = input;

  if (pool < 0 || !Number.isInteger(pool)) {
    throw new Error(`Pool size must be a non-negative integer, got: ${pool}`);
  }
  if (die_sides < 2 || !Number.isInteger(die_sides)) {
    throw new Error(`Die sides must be an integer >= 2, got: ${die_sides}`);
  }
  if (success_threshold < 1 || success_threshold > die_sides) {
    throw new Error(
      `Success threshold must be between 1 and ${die_sides}, got: ${success_threshold}`
    );
  }
  if (required_successes < 0 || !Number.isInteger(required_successes)) {
    throw new Error(`Required successes must be a non-negative integer, got: ${required_successes}`);
  }

  // Probability of a single die being a success:
  // faces that meet or exceed the threshold
  const p = (die_sides - success_threshold + 1) / die_sides;

  // Expected successes: n * p
  const expected_successes = pool * p;

  // Build the full distribution: P(X = k) for k = 0..pool
  const distribution: DistributionEntry[] = [];
  for (let k = 0; k <= pool; k++) {
    distribution.push({
      k,
      probability: binomialPmf(pool, k, p),
    });
  }

  // P(X >= required_successes) = sum of P(X=k) for k >= required_successes
  let probability_k_or_more = 0;
  for (let k = required_successes; k <= pool; k++) {
    probability_k_or_more += distribution[k].probability;
  }

  return {
    probability_k_or_more_successes: probability_k_or_more,
    expected_successes,
    distribution,
  };
}

// ---------------------------------------------------------------------------
// CLI wrapper: reads JSON from stdin, writes JSON to stdout
// ---------------------------------------------------------------------------

if (typeof process !== "undefined" && process.argv[1]?.endsWith("dice-pool.ts")) {
  let data = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk: string) => { data += chunk; });
  process.stdin.on("end", () => {
    try {
      const input: DicePoolInput = JSON.parse(data);
      const output = run(input);
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });
}
