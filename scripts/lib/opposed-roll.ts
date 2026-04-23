/**
 * opposed-roll.ts — Opposed roll probability calculator
 *
 * Purpose: Compute probabilities for "attacker rolls vs defender rolls"
 * mechanics where two independent rolls are compared. Covers:
 *   - Single die vs single die (d20 vs d20, contested checks)
 *   - Single die vs fixed value (attack roll vs AC)
 *   - Pool vs pool (Storyteller contested rolls)
 *   - NdS sum vs NdS sum (Cepheus opposed checks)
 *
 * Input:  { attacker, defender, tie_goes_to? }
 * Output: { attacker_wins, defender_wins, tie, attacker_mean, defender_mean, delta_distribution }
 *
 * Part of Gygax v4 probability scripts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RollSpec =
  | { type: "single"; sides: number; modifier?: number }
  | { type: "sum"; dice: number; sides: number; modifier?: number }
  | { type: "fixed"; value: number };

export interface OpposedRollInput {
  attacker: RollSpec;
  defender: RollSpec;
  tie_goes_to?: "attacker" | "defender" | "neither";
}

export interface DeltaEntry {
  delta: number;
  probability: number;
}

export interface OpposedRollOutput {
  attacker_wins: number;
  defender_wins: number;
  tie: number;
  attacker_mean: number;
  defender_mean: number;
  delta_distribution: DeltaEntry[];
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/**
 * Build the probability distribution for a roll spec.
 * Returns a Map from result value to probability.
 */
function buildDistribution(spec: RollSpec): Map<number, number> {
  if (spec.type === "fixed") {
    return new Map([[spec.value, 1]]);
  }

  if (spec.type === "single") {
    const mod = spec.modifier ?? 0;
    const dist = new Map<number, number>();
    const p = 1 / spec.sides;
    for (let face = 1; face <= spec.sides; face++) {
      dist.set(face + mod, p);
    }
    return dist;
  }

  // type === "sum": convolve dice distributions
  const mod = spec.modifier ?? 0;
  const { dice, sides } = spec;

  // Start with a single die
  let dist = new Map<number, number>();
  const p = 1 / sides;
  for (let face = 1; face <= sides; face++) {
    dist.set(face, p);
  }

  // Convolve for each additional die
  for (let d = 1; d < dice; d++) {
    const next = new Map<number, number>();
    for (const [val, prob] of dist) {
      for (let face = 1; face <= sides; face++) {
        const key = val + face;
        next.set(key, (next.get(key) ?? 0) + prob * p);
      }
    }
    dist = next;
  }

  // Apply modifier
  if (mod !== 0) {
    const shifted = new Map<number, number>();
    for (const [val, prob] of dist) {
      shifted.set(val + mod, prob);
    }
    dist = shifted;
  }

  return dist;
}

/**
 * Compute the mean of a distribution.
 */
function mean(dist: Map<number, number>): number {
  let m = 0;
  for (const [val, prob] of dist) {
    m += val * prob;
  }
  return m;
}

// ---------------------------------------------------------------------------
// Core function (pure, no I/O)
// ---------------------------------------------------------------------------

export function run(input: OpposedRollInput): OpposedRollOutput {
  const { attacker, defender, tie_goes_to = "neither" } = input;

  // Validate
  validateSpec(attacker, "attacker");
  validateSpec(defender, "defender");
  if (!["attacker", "defender", "neither"].includes(tie_goes_to)) {
    throw new Error(
      `tie_goes_to must be "attacker", "defender", or "neither", got: "${tie_goes_to}"`
    );
  }

  const aDist = buildDistribution(attacker);
  const dDist = buildDistribution(defender);

  // Compare every (attacker result, defender result) pair
  const deltaMap = new Map<number, number>();
  let attackerWins = 0;
  let defenderWins = 0;
  let tie = 0;

  for (const [aVal, aProb] of aDist) {
    for (const [dVal, dProb] of dDist) {
      const joint = aProb * dProb;
      const delta = aVal - dVal;

      deltaMap.set(delta, (deltaMap.get(delta) ?? 0) + joint);

      if (aVal > dVal) {
        attackerWins += joint;
      } else if (dVal > aVal) {
        defenderWins += joint;
      } else {
        tie += joint;
      }
    }
  }

  // Apply tie rule
  if (tie_goes_to === "attacker") {
    attackerWins += tie;
    tie = 0;
  } else if (tie_goes_to === "defender") {
    defenderWins += tie;
    tie = 0;
  }

  // Build sorted delta distribution
  const deltas = Array.from(deltaMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([delta, probability]) => ({ delta, probability }));

  return {
    attacker_wins: attackerWins,
    defender_wins: defenderWins,
    tie,
    attacker_mean: mean(aDist),
    defender_mean: mean(dDist),
    delta_distribution: deltas,
  };
}

function validateSpec(spec: RollSpec, label: string): void {
  if (spec.type === "fixed") {
    if (!Number.isFinite(spec.value)) {
      throw new Error(`${label}: fixed value must be a finite number, got: ${spec.value}`);
    }
    return;
  }
  if (spec.type === "single") {
    if (spec.sides < 2 || !Number.isInteger(spec.sides)) {
      throw new Error(`${label}: die sides must be an integer >= 2, got: ${spec.sides}`);
    }
    return;
  }
  if (spec.type === "sum") {
    if (spec.dice < 1 || !Number.isInteger(spec.dice)) {
      throw new Error(`${label}: dice count must be a positive integer, got: ${spec.dice}`);
    }
    if (spec.sides < 2 || !Number.isInteger(spec.sides)) {
      throw new Error(`${label}: die sides must be an integer >= 2, got: ${spec.sides}`);
    }
    return;
  }
  throw new Error(`${label}: type must be "single", "sum", or "fixed", got: "${(spec as any).type}"`);
}

// ---------------------------------------------------------------------------
// CLI wrapper: reads JSON from stdin, writes JSON to stdout
// ---------------------------------------------------------------------------

if (typeof process !== "undefined" && process.argv[1]?.endsWith("opposed-roll.ts")) {
  let data = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk: string) => { data += chunk; });
  process.stdin.on("end", () => {
    try {
      const input: OpposedRollInput = JSON.parse(data);
      const output = run(input);
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });
}
