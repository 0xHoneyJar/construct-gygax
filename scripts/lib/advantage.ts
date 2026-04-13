/**
 * advantage.ts — 5e-style advantage/disadvantage probability calculator
 *
 * Purpose: Compute the probability distribution for "roll 2, keep high"
 * (advantage) or "roll 2, keep low" (disadvantage) mechanics.
 * Calculates the effective bonus curve — what flat modifier on a
 * single roll produces equivalent probability at each DC.
 *
 * Input:  { sides, mode: "advantage"|"disadvantage", target?, modifier? }
 * Output: { mean, stdev, effective_bonus_curve, probability_at_least? }
 *
 * Key formulas for a fair die with s sides:
 *   Advantage:    P(max >= x) = 1 - ((x-1)/s)^2
 *   Disadvantage: P(min >= x) = ((s-x+1)/s)^2
 *
 * Effective bonus at DC x = the value b such that:
 *   P(advantage >= x) = P(flat_roll >= x - b) = (s - x + b + 1) / s
 *   Solving: b = s * P(adv >= x) - (s - x + 1)
 *
 * Part of Gygax v3 probability scripts (Sprint 11).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdvantageInput {
  sides: number;
  mode: "advantage" | "disadvantage";
  target?: number;
  modifier?: number;
}

export interface EffectiveBonusEntry {
  dc: number;
  effective_bonus: number;
}

export interface AdvantageOutput {
  mean: number;
  stdev: number;
  effective_bonus_curve: EffectiveBonusEntry[];
  probability_at_least?: number;
}

// ---------------------------------------------------------------------------
// Core function (pure, no I/O)
// ---------------------------------------------------------------------------

export function run(input: AdvantageInput): AdvantageOutput {
  const { sides, mode, target, modifier = 0 } = input;

  if (sides < 2 || !Number.isInteger(sides)) {
    throw new Error(`Die sides must be an integer >= 2, got: ${sides}`);
  }
  if (mode !== "advantage" && mode !== "disadvantage") {
    throw new Error(`Mode must be "advantage" or "disadvantage", got: "${mode}"`);
  }

  const s = sides;

  // Build the full PMF for the kept die.
  // For advantage (max of 2 dice):
  //   P(max = x) = (2x - 1) / s^2
  // For disadvantage (min of 2 dice):
  //   P(min = x) = (2(s - x) + 1) / s^2

  const pmf: number[] = new Array(s); // pmf[i] = P(result = i+1)

  if (mode === "advantage") {
    for (let x = 1; x <= s; x++) {
      pmf[x - 1] = (2 * x - 1) / (s * s);
    }
  } else {
    for (let x = 1; x <= s; x++) {
      pmf[x - 1] = (2 * (s - x) + 1) / (s * s);
    }
  }

  // Mean and variance from the PMF
  let mean = 0;
  let meanSq = 0;
  for (let x = 1; x <= s; x++) {
    const val = x + modifier;
    mean += val * pmf[x - 1];
    meanSq += val * val * pmf[x - 1];
  }
  const variance = meanSq - mean * mean;
  const stdev = Math.sqrt(Math.max(0, variance));

  // Build P(result >= dc) for dc = 1..s (before modifier)
  // Then compute effective bonus curve.
  const effective_bonus_curve: EffectiveBonusEntry[] = [];

  for (let dc = 1; dc <= s; dc++) {
    // P(kept die + modifier >= dc)
    let pAtLeast: number;

    if (mode === "advantage") {
      // P(max >= dc) = 1 - P(max < dc) = 1 - P(max <= dc-1)
      // P(max <= k) = (k/s)^2
      const k = dc - modifier - 1;
      if (k < 0) {
        pAtLeast = 1;
      } else if (k >= s) {
        pAtLeast = 0;
      } else {
        pAtLeast = 1 - (k / s) * (k / s);
      }
    } else {
      // P(min >= dc) = P(both dice >= dc)
      // P(single die >= dc) = (s - dc + 1) / s
      const effDc = dc - modifier;
      if (effDc < 1) {
        pAtLeast = 1;
      } else if (effDc > s) {
        pAtLeast = 0;
      } else {
        const pSingle = (s - effDc + 1) / s;
        pAtLeast = pSingle * pSingle;
      }
    }

    // Flat roll probability: P(d + modifier >= dc) = (s - (dc - modifier) + 1) / s
    // = (s - dc + modifier + 1) / s
    const flatProb = Math.min(1, Math.max(0, (s - dc + modifier + 1) / s));

    // Effective bonus: what additional modifier b would make flat roll match?
    // P(d + modifier + b >= dc) = pAtLeast
    // (s - dc + modifier + b + 1) / s = pAtLeast
    // b = s * pAtLeast - (s - dc + modifier + 1)
    // b = s * pAtLeast - s + dc - modifier - 1
    const effective_bonus = s * pAtLeast - (s - dc + modifier + 1);

    effective_bonus_curve.push({ dc, effective_bonus });
  }

  const result: AdvantageOutput = {
    mean,
    stdev,
    effective_bonus_curve,
  };

  // If target specified, compute P(result >= target)
  if (target !== undefined) {
    if (mode === "advantage") {
      const k = target - modifier - 1;
      if (k < 0) {
        result.probability_at_least = 1;
      } else if (k >= s) {
        result.probability_at_least = 0;
      } else {
        result.probability_at_least = 1 - (k / s) * (k / s);
      }
    } else {
      const effTarget = target - modifier;
      if (effTarget < 1) {
        result.probability_at_least = 1;
      } else if (effTarget > s) {
        result.probability_at_least = 0;
      } else {
        const pSingle = (s - effTarget + 1) / s;
        result.probability_at_least = pSingle * pSingle;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// CLI wrapper: reads JSON from stdin, writes JSON to stdout
// ---------------------------------------------------------------------------

if (typeof process !== "undefined" && process.argv[1]?.endsWith("advantage.ts")) {
  let data = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk: string) => { data += chunk; });
  process.stdin.on("end", () => {
    try {
      const input: AdvantageInput = JSON.parse(data);
      const output = run(input);
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });
}
