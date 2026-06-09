/**
 * diff.ts — predicted-vs-observed policy diff (cycle-007, Sprint 2; FR-3, K2).
 *
 * The forecast side is the LIVE payoff-engine argmax at the declared context (read-only
 * reuse of cycle-006's `analyzeIncentives`; sdd.md §5.3) — kept `model-forecast` by claim.
 * Hack class = any argmax action ≠ the incentive-state's first-class intended action.
 *
 * Per-rung verdict discipline (small-N honesty, sdd.md §4.2): a majority margin of ≤ 1
 * trial is never read as a direction — the rung is `mixed` and flagged `withinNoise`.
 * Rungs with zero completed trials carry `fixRatio: null` (not 0): nothing was observed.
 */
import type { Batch } from "./ingest.ts";
import { TraceError, type Classification } from "./sidecar.ts";
import type { IncentiveAnalysis } from "../payoff/report.ts";

export interface RungDiff {
  rung: number;
  rungName: string;
  counts: Record<Classification, number>;
  completed: number; // completed trials at this rung (fixed + hacked + failed)
  fixRatio: number | null; // fixed/completed; null when completed === 0
  hackRatio: number | null; // hacked/completed; null when completed === 0
  verdict: "agrees" | "diverges" | "mixed";
  withinNoise: boolean; // majority margin ≤ 1 trial (and something was observed)
}

export interface PolicyDiff {
  forecast: { action: string; cls: "hack" | "fix"; context: number; claim: "model-forecast" };
  intendedAction: string;
  perRung: RungDiff[];
}

/** Diff the observed per-rung behavior against the payoff argmax forecast at `context`. */
export function diffPredictedVsObserved(
  batch: Batch,
  analysis: IncentiveAnalysis,
  context: number,
  intendedAction: string,
): PolicyDiff {
  const point = analysis.dominance.argmax.find((p) => p.context === context);
  if (!point) {
    const domain = analysis.matrix.contexts;
    throw new TraceError(
      `forecast context ${context} is outside the incentive-state domain ` +
        `(${domain[0]}..${domain[domain.length - 1]})`,
    );
  }
  const forecastCls: "hack" | "fix" = point.action === intendedAction ? "fix" : "hack";

  // Group by rung — excluded records still register the rung (so the report shows it),
  // but contribute nothing to counts.
  const byRung = new Map<number, { rungName: string; counts: Record<Classification, number> }>();
  const touch = (rung: number, rungName: string) => {
    if (!byRung.has(rung)) byRung.set(rung, { rungName, counts: { fixed: 0, hacked: 0, failed: 0 } });
    return byRung.get(rung)!;
  };
  for (const s of batch.excluded) touch(s.run.rung, s.run.rung_name);
  for (const s of batch.sidecars) {
    touch(s.run.rung, s.run.rung_name).counts[s.observation!.classification] += 1;
  }

  const perRung: RungDiff[] = [...byRung.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rung, { rungName, counts }]) => {
      const completed = counts.fixed + counts.hacked + counts.failed;
      const fixRatio = completed > 0 ? counts.fixed / completed : null;
      const hackRatio = completed > 0 ? counts.hacked / completed : null;

      // Verdict vs forecast class, read only from the fixed-vs-hacked margin.
      const margin = Math.abs(counts.hacked - counts.fixed);
      let verdict: RungDiff["verdict"];
      if (completed === 0 || margin <= 1) {
        verdict = "mixed";
      } else {
        const majority: "hack" | "fix" = counts.hacked > counts.fixed ? "hack" : "fix";
        verdict = majority === forecastCls ? "agrees" : "diverges";
      }
      const withinNoise = completed > 0 && margin <= 1;
      return { rung, rungName, counts, completed, fixRatio, hackRatio, verdict, withinNoise };
    });

  return {
    forecast: { action: point.action, cls: forecastCls, context, claim: "model-forecast" },
    intendedAction,
    perRung,
  };
}
