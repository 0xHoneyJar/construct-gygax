/**
 * crossover.ts — first-crossing & spike detection over a swept MetricSeries (cycle-005, FR-1, B.5/B.6).
 *
 * Two complementary detectors (SDD §1.2 crossover.ts; knob-leverage-taxonomy.md L4):
 *   1. firstCrossing — first axis point where a metric crosses a DECLARED threshold (K2).
 *   2. detectSpikes  — drastic jumps with NO declared threshold (Hopson "flag drastic jumps", K3),
 *      flagging the *envelope* and NOT the regular `floor` stair-steps.
 *
 * Numeric sweep, not CAS (R2). Metric-agnostic — operates on abstract MetricSeries.
 */
import type { MetricSeries } from "./sweep.ts";

export type Op = ">" | "<" | ">=" | "<=";

export interface Threshold {
  metric: string;
  op: Op;
  value: number;
}

export interface Crossover {
  metric: string;
  op: Op;
  value: number;
  x: number | null; // null = "no crossing in domain" (honest, not fabricated)
  at?: number; // the metric value at the crossing
  note?: string;
}

/** Parse a test string like "> 8" / ">=100" into a Threshold. */
export function parseThreshold(metric: string, test: string): Threshold {
  const m = String(test).trim().match(/^(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) throw new Error(`unparseable threshold test '${test}' for metric '${metric}' (want e.g. "> 8")`);
  return { metric, op: m[1] as Op, value: Number(m[2]) };
}

function holds(v: number, op: Op, target: number): boolean {
  switch (op) {
    case ">": return v > target;
    case "<": return v < target;
    case ">=": return v >= target;
    case "<=": return v <= target;
  }
}

/** First axis point where the series satisfies the threshold; null if it never does in-domain. */
export function firstCrossing(series: MetricSeries, threshold: Threshold): Crossover {
  for (const s of series.samples) {
    if (holds(s.value, threshold.op, threshold.value)) {
      return { metric: threshold.metric, op: threshold.op, value: threshold.value, x: s.x, at: s.value };
    }
  }
  return {
    metric: threshold.metric,
    op: threshold.op,
    value: threshold.value,
    x: null,
    note: "no crossing in domain",
  };
}

export interface Spike {
  metric: string;
  x: number;
  value: number;
  jump: number; // signed step-over-step change at x
  relativeJump: number; // |jump| / local trend scale
}

export interface SpikeOpts {
  spikeFactor?: number; // |jump| must exceed this multiple of the local trend
  window?: number; // half-width of the local-trend window
  minAbsJump?: number; // absolute floor so unit stair-steps never qualify
}

// Defaults resolve the SDD §10 spike-sensitivity question. Validated by the A.0 golden test:
// the envelope spike (+28) fires; the `floor` stair-steps (≤+2, and the unit-step armor series)
// do not. `minAbsJump` alone kills unit stairs; `spikeFactor` separates the +28 from the +2 kink.
const DEFAULTS: Required<SpikeOpts> = { spikeFactor: 4, window: 3, minAbsJump: 3 };

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Flag axis points whose step-over-step change is drastic relative to the local trend — the
 * envelope spike — WITHOUT a declared threshold. Regular `floor` stair-steps (small, regular unit
 * jumps) are not flagged: `minAbsJump` rejects unit steps, and `spikeFactor` rejects jumps that are
 * only modestly above the surrounding trend.
 */
export function detectSpikes(series: MetricSeries, opts: SpikeOpts = {}): Spike[] {
  const { spikeFactor, window, minAbsJump } = { ...DEFAULTS, ...opts };
  const v = series.samples;
  if (v.length < 3) return [];
  const diffs: number[] = [];
  for (let i = 1; i < v.length; i++) diffs.push(v[i].value - v[i - 1].value);

  const spikes: Spike[] = [];
  for (let i = 0; i < diffs.length; i++) {
    const d = diffs[i];
    if (Math.abs(d) < minAbsJump) continue;
    // local trend: median |diff| in a window around i, excluding i itself.
    const lo = Math.max(0, i - window);
    const hi = Math.min(diffs.length - 1, i + window);
    const neighborhood: number[] = [];
    for (let j = lo; j <= hi; j++) if (j !== i) neighborhood.push(Math.abs(diffs[j]));
    const scale = Math.max(1, median(neighborhood));
    const relativeJump = Math.abs(d) / scale;
    if (relativeJump > spikeFactor) {
      const at = v[i + 1]; // diff i is the jump INTO sample i+1
      spikes.push({ metric: series.id, x: at.x, value: at.value, jump: d, relativeJump });
    }
  }
  return spikes;
}
