/**
 * context-axis.ts — the context (difficulty) analysis axis (cycle-009, Sprint 2; FR-1.3, S1).
 *
 * Difficulty rides `experiment.context` by contract convention (observed-trace-batch.v1.md,
 * v1.1): when records in a batch VARY on `context.value`, that variance is a second analysis
 * axis alongside the rung. Cells are keyed **(value × rung)** — pooling rungs would conflate
 * the awareness axis with the difficulty axis (sdd.md §4.2). The per-rung cliff over the value
 * axis reuses `firstCrossing` — the same cycle-005 tipping-point substrate `cliff.ts` runs
 * over rungs (read-only reuse).
 *
 * Returns null when fewer than 2 distinct values exist among completed records: a single-value
 * batch has no axis to analyze, and the report section is omitted entirely (byte-stability for
 * pre-v1.1 batches).
 */
import { firstCrossing } from "../parametric/crossover.ts";
import type { MetricSeries } from "../parametric/sweep.ts";
import type { Batch } from "./ingest.ts";
import type { Classification } from "./sidecar.ts";
import { CLIFF_THRESHOLD } from "./cliff.ts";

export interface ContextCell {
  value: number;
  rung: number;
  rungName: string;
  counts: Record<Classification, number>;
  completed: number;
  /** Infra non-runs at this (value × rung): display-only, never in ratios. */
  infra: number;
  hackRatio: number | null; // hacked/completed; null when completed === 0
}

export interface ContextAxis {
  name: string; // e.g. "difficulty" (the contract convention name)
  values: number[]; // distinct context.values among completed records, ascending
  cells: ContextCell[]; // (value × rung), only observed combinations, sorted (value, rung)
  /** Per rung: first context value where hackRatio >= CLIFF_THRESHOLD (null = never crosses). */
  cliffByRung: { rung: number; rungName: string; cliffValue: number | null }[];
}

/** Group the batch over (context.value × rung). Null when <2 distinct values among completed
 *  records — no axis, section omitted. */
export function contextAxis(batch: Batch): ContextAxis | null {
  const distinct = new Set(batch.sidecars.map((s) => s.experiment.context.value));
  if (distinct.size < 2) return null;

  const key = (v: number, rung: number) => `${v}|${rung}`;
  const cells = new Map<string, ContextCell>();
  const touch = (v: number, rung: number, rungName: string): ContextCell => {
    const k = key(v, rung);
    if (!cells.has(k)) {
      cells.set(k, { value: v, rung, rungName, counts: { fixed: 0, hacked: 0, failed: 0 }, completed: 0, infra: 0, hackRatio: null });
    }
    return cells.get(k)!;
  };

  for (const s of batch.sidecars) {
    const c = touch(s.experiment.context.value, s.run.rung, s.run.rung_name);
    c.counts[s.observation!.classification] += 1;
  }
  for (const s of batch.infra) {
    touch(s.experiment.context.value, s.run.rung, s.run.rung_name).infra += 1;
  }

  const sorted = [...cells.values()].sort((a, b) => a.value - b.value || a.rung - b.rung);
  for (const c of sorted) {
    c.completed = c.counts.fixed + c.counts.hacked + c.counts.failed;
    c.hackRatio = c.completed > 0 ? c.counts.hacked / c.completed : null;
  }

  // Per-rung cliff over the value axis: firstCrossing(hackRatio >= threshold), values ascending.
  const rungs = [...new Set(sorted.map((c) => c.rung))].sort((a, b) => a - b);
  const cliffByRung = rungs.map((rung) => {
    const rungCells = sorted.filter((c) => c.rung === rung && c.hackRatio !== null);
    const series: MetricSeries = {
      id: `hack-ratio-rung-${rung}`,
      kind: "metric",
      samples: rungCells.map((c) => ({ x: c.value, value: c.hackRatio! })),
    };
    const crossing = firstCrossing(series, { metric: series.id, op: ">=", value: CLIFF_THRESHOLD });
    const rungName = sorted.find((c) => c.rung === rung)!.rungName;
    return { rung, rungName, cliffValue: crossing.x };
  });

  return {
    name: (batch.sidecars[0] ?? batch.infra[0]).experiment.context.name,
    values: [...distinct].sort((a, b) => a - b),
    cells: sorted,
    cliffByRung,
  };
}
