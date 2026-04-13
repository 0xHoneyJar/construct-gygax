/**
 * cdf-compare.ts — Cross-system CDF comparison tool
 *
 * Purpose: Compare two resolution systems by overlaying their CDFs
 * (cumulative distribution functions) across a DC range. Identifies
 * crossover points where one system becomes more/less generous than
 * the other, and produces a narrative summary.
 *
 * Input:  { system_a: {name, cdf: [{dc, probability}]},
 *           system_b: {name, cdf: [{dc, probability}]} }
 * Output: { deltas, crossover_points, summary }
 *
 * Part of Gygax v3 probability scripts (Sprint 11).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CdfEntry {
  dc: number;
  probability: number;
}

export interface SystemCdf {
  name: string;
  cdf: CdfEntry[];
}

export interface CdfCompareInput {
  system_a: SystemCdf;
  system_b: SystemCdf;
}

export interface DeltaEntry {
  dc: number;
  system_a_prob: number;
  system_b_prob: number;
  delta: number;
}

export interface CdfCompareOutput {
  deltas: DeltaEntry[];
  crossover_points: number[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Core function (pure, no I/O)
// ---------------------------------------------------------------------------

export function run(input: CdfCompareInput): CdfCompareOutput {
  const { system_a, system_b } = input;

  if (!system_a || !system_a.name || !Array.isArray(system_a.cdf)) {
    throw new Error("system_a must have name and cdf array");
  }
  if (!system_b || !system_b.name || !Array.isArray(system_b.cdf)) {
    throw new Error("system_b must have name and cdf array");
  }

  // Build lookup maps: dc -> probability
  const mapA = new Map<number, number>();
  for (const entry of system_a.cdf) {
    mapA.set(entry.dc, entry.probability);
  }
  const mapB = new Map<number, number>();
  for (const entry of system_b.cdf) {
    mapB.set(entry.dc, entry.probability);
  }

  // Gather all unique DCs from both systems, sorted
  const allDcs = Array.from(new Set([
    ...system_a.cdf.map((e) => e.dc),
    ...system_b.cdf.map((e) => e.dc),
  ])).sort((a, b) => a - b);

  // Compute deltas at each DC
  const deltas: DeltaEntry[] = [];
  for (const dc of allDcs) {
    const aProb = mapA.get(dc) ?? 0;
    const bProb = mapB.get(dc) ?? 0;
    deltas.push({
      dc,
      system_a_prob: aProb,
      system_b_prob: bProb,
      delta: aProb - bProb,
    });
  }

  // Find crossover points: where the sign of delta changes.
  // A crossover occurs between dc[i-1] and dc[i] when sign flips.
  // We report dc[i] (the DC where the new regime begins).
  const crossover_points: number[] = [];
  for (let i = 1; i < deltas.length; i++) {
    const prevDelta = deltas[i - 1].delta;
    const currDelta = deltas[i].delta;
    // Sign change: positive to negative, negative to positive,
    // or crossing through zero
    if (
      (prevDelta > 0 && currDelta < 0) ||
      (prevDelta < 0 && currDelta > 0) ||
      (prevDelta !== 0 && currDelta === 0) ||
      (prevDelta === 0 && currDelta !== 0 && i > 1)
    ) {
      crossover_points.push(deltas[i].dc);
    }
  }

  // Generate summary narrative
  const summary = generateSummary(system_a.name, system_b.name, deltas, crossover_points);

  return { deltas, crossover_points, summary };
}

/**
 * Generate a short narrative summary of the comparison.
 */
function generateSummary(
  nameA: string,
  nameB: string,
  deltas: DeltaEntry[],
  crossovers: number[]
): string {
  if (deltas.length === 0) {
    return "No data to compare.";
  }

  // Check if all deltas are effectively zero
  const allZero = deltas.every((d) => Math.abs(d.delta) < 1e-10);
  if (allZero) {
    return `${nameA} and ${nameB} produce identical probability curves across all DCs.`;
  }

  // No crossovers: one system dominates
  if (crossovers.length === 0) {
    const avgDelta = deltas.reduce((sum, d) => sum + d.delta, 0) / deltas.length;
    if (avgDelta > 0) {
      return `${nameA} is more generous than ${nameB} across the entire DC range.`;
    } else {
      return `${nameB} is more generous than ${nameA} across the entire DC range.`;
    }
  }

  // With crossovers: describe the pattern
  const parts: string[] = [];

  // Determine who is ahead at the start
  const firstDelta = deltas[0].delta;
  const firstLeader = firstDelta > 0 ? nameA : nameB;
  const firstTrailer = firstDelta > 0 ? nameB : nameA;

  parts.push(`${firstLeader} is more generous at low DCs`);

  if (crossovers.length === 1) {
    parts.push(`${firstTrailer} converges above DC ${crossovers[0]}`);
  } else {
    parts.push(`systems cross over at DCs ${crossovers.join(", ")}`);
  }

  return parts.join("; ") + ".";
}

// ---------------------------------------------------------------------------
// CLI wrapper: reads JSON from stdin, writes JSON to stdout
// ---------------------------------------------------------------------------

if (typeof process !== "undefined" && process.argv[1]?.endsWith("cdf-compare.ts")) {
  let data = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk: string) => { data += chunk; });
  process.stdin.on("end", () => {
    try {
      const input: CdfCompareInput = JSON.parse(data);
      const output = run(input);
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });
}
