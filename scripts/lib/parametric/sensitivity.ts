/**
 * sensitivity.ts — knob-leverage ranking via local perturbation (cycle-005, FR-2, sprint.md C.1-C.3).
 *
 * Schreiber's "control one variable at a time" automated over a parametric model: perturb each
 * *tunable* knob by a unit step, re-sweep, measure Δ on the primary metric, rank by leverage.
 * Gated on `tunability` — `structural` invariants are NEVER perturbed/proposed (FR-3 + taxonomy L6).
 *
 * Surfaces, per the knob-leverage taxonomy (knob-leverage-taxonomy.md):
 *   - L4 crossover-mover: Δ(crossover axis) under perturbation — a first-class column.
 *   - L7 god/dump: a knob inert on EVERY metric escalates to a *balance finding*, not a knob entry.
 *   - low-primary-leverage knobs that move a *secondary* metric are flagged (not silently buried) —
 *     the bridge to FR-4 (loop/gate leverage).
 */
import { sweepMetrics, nameFor, type Model, type MetricDef, type MetricSeries } from "./sweep.ts";
import { firstCrossing, type Threshold } from "./crossover.ts";

export interface KnobLeverage {
  id: string; // entity id (hyphenated)
  tunability: "engine-default";
  primaryMetric: string;
  leverage: number; // Σ|Δ primary metric| over the domain
  direction: "increases" | "decreases" | "mixed" | "none";
  crossoverShift: number | null; // L4: Δ(crossover axis) for the primary threshold (perturbed − base)
  secondaryNote?: string; // flagged (not buried) when low on primary but moves another metric
}

export interface BalanceFinding {
  id: string;
  kind: "inert-lever"; // L7 dump: does nothing measurable on any metric
  note: string;
}

export interface KnobRanking {
  knobs: KnobLeverage[]; // ranked desc by leverage (deterministic tie-break by id)
  findings: BalanceFinding[]; // L7 escalations — NOT knobs
  excludedStructural: string[]; // tunability: structural models, never perturbed
}

export interface RankOpts {
  primaryMetric: string;
  threshold?: Threshold; // for the L4 crossover-mover column
  delta?: number; // perturbation step (default 1)
  epsilon?: number; // leverage below this counts as zero (default 1e-9)
}

const EPS = 1e-9;

function seriesMap(series: MetricSeries[]): Map<string, number[]> {
  return new Map(series.map((s) => [s.id, s.samples.map((p) => p.value)]));
}

/** Sum of absolute differences between two equal-length value arrays. */
function sumAbsDelta(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s;
}

function signOfChange(base: number[], pert: number[], eps: number): KnobLeverage["direction"] {
  let up = false;
  let down = false;
  for (let i = 0; i < base.length; i++) {
    const d = pert[i] - base[i];
    if (d > eps) up = true;
    else if (d < -eps) down = true;
  }
  if (up && down) return "mixed";
  if (up) return "increases";
  if (down) return "decreases";
  return "none";
}

export function rankKnobs(models: Model[], metricDefs: MetricDef[], opts: RankOpts): KnobRanking {
  const delta = opts.delta ?? 1;
  const eps = opts.epsilon ?? EPS;

  const base = sweepMetrics(models, metricDefs);
  const baseMap = seriesMap(base);
  const basePrimary = baseMap.get(opts.primaryMetric);
  if (!basePrimary) throw new Error(`primary metric '${opts.primaryMetric}' not found in sweep`);
  const baseSeries = base.find((s) => s.id === opts.primaryMetric)!;
  const allMetricIds = base.map((s) => s.id);

  const excludedStructural = models.filter((m) => m.tunability === "structural").map((m) => m.id);
  const candidates = models.filter((m) => m.tunability === "engine-default");

  const knobs: KnobLeverage[] = [];
  const findings: BalanceFinding[] = [];

  for (const m of candidates) {
    // Perturb this knob by wrapping its formula (+delta) — reuses the sandboxed evaluator; no new
    // formula author surface (only a numeric delta), so no new trust boundary (sprint C security).
    const perturbed = models.map((x) => (x.id === m.id ? { ...x, formula: `(${x.formula}) + ${delta}` } : x));
    const pSeries = sweepMetrics(perturbed, metricDefs);
    const pMap = seriesMap(pSeries);

    const pPrimary = pMap.get(opts.primaryMetric)!;
    const leverage = sumAbsDelta(basePrimary, pPrimary);

    // L7 / inert check: DOWNSTREAM leverage across every OTHER series. A knob trivially moves its
    // own model series — that is not leverage; exclude it so a value nothing references reads inert.
    const ownSeries = nameFor(m.id);
    let totalAll = 0;
    const movedSecondary: string[] = [];
    for (const id of allMetricIds) {
      if (id === ownSeries) continue;
      const d = sumAbsDelta(baseMap.get(id)!, pMap.get(id)!);
      totalAll += d;
      if (id !== opts.primaryMetric && d > eps) movedSecondary.push(id);
    }

    if (totalAll <= eps) {
      // Dump/inert lever — escalate to a balance finding, do NOT rank as a knob (L7).
      findings.push({
        id: m.id,
        kind: "inert-lever",
        note: `\`${m.id}\` has no measurable effect on any metric — a false lever (does nothing, or is miswired). Remove it or wire it in; it is not a tuning knob.`,
      });
      continue;
    }

    // L4 crossover-mover.
    let crossoverShift: number | null = null;
    if (opts.threshold) {
      const baseCross = firstCrossing(baseSeries, opts.threshold).x;
      const pCross = firstCrossing({ ...pSeries.find((s) => s.id === opts.primaryMetric)! }, opts.threshold).x;
      if (baseCross !== null && pCross !== null) crossoverShift = pCross - baseCross;
    }

    const knob: KnobLeverage = {
      id: m.id,
      tunability: "engine-default",
      primaryMetric: opts.primaryMetric,
      leverage,
      direction: signOfChange(basePrimary, pPrimary, eps),
      crossoverShift,
    };
    // Flag, don't bury: low on the primary metric but moves a secondary one (FR-4 loop/gate bridge).
    if (leverage <= eps && movedSecondary.length > 0) {
      knob.secondaryNote = `low leverage on ${opts.primaryMetric}, but moves ${movedSecondary.join(", ")} — do not dismiss (may sit on a loop/gate; FR-4).`;
    }
    knobs.push(knob);
  }

  // Rank desc by leverage; deterministic tie-break by id (stable across runs — C.5 / K4).
  knobs.sort((a, b) => b.leverage - a.leverage || a.id.localeCompare(b.id));
  findings.sort((a, b) => a.id.localeCompare(b.id));

  return { knobs, findings, excludedStructural };
}
