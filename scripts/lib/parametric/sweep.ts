/**
 * sweep.ts — dense domain sweep + metric composition (cycle-005, FR-1, sprint.md B.4).
 *
 * Metric-agnostic by construction (SDD §1.2 principle 4): operates on abstract `Model`s and
 * `MetricDef`s and returns abstract `MetricSeries`. NO carmack/TTK metric name appears here — the
 * carmack metrics are just one `metricDefs` set passed in. The same engine serves progression
 * `(Cv+Cs)-(Pv+Ps)`, a variance series, or a payoff curve (gygax-evolution-roadmap.md).
 */
import { compile, type EvalFn } from "./expr.ts";

export interface Model {
  id: string;
  variable: string;
  domain: { min: number; max: number };
  formula: string;
  tunability?: "engine-default" | "structural";
}
export interface MetricDef {
  id: string;
  formula: string;
  role?: string;
}
export interface Sample {
  x: number;
  value: number;
}
export interface MetricSeries {
  id: string;
  samples: Sample[];
  kind: "model" | "metric";
  tunability?: "engine-default" | "structural";
}

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

/** Entity ids are hyphenated (`player-attack`); formulas reference them underscored (`player_attack`). */
export function nameFor(id: string): string {
  return id.replace(/-/g, "_");
}

/** Reject open/unbounded/degenerate domains before any sweep (SDD §1.8 / sprint AC). */
export function validateDomain(domain: { min: number; max: number }): void {
  if (!domain || typeof domain.min !== "number" || typeof domain.max !== "number") {
    throw new DomainError("domain must declare numeric { min, max }");
  }
  if (!Number.isFinite(domain.min) || !Number.isFinite(domain.max)) {
    throw new DomainError(`domain must be finite (got min=${domain.min}, max=${domain.max})`);
  }
  if (domain.max <= domain.min) {
    throw new DomainError(`domain max (${domain.max}) must be greater than min (${domain.min})`);
  }
}

/** Integer steps across the (inclusive) domain. */
export function domainSteps(domain: { min: number; max: number }): number[] {
  validateDomain(domain);
  const xs: number[] = [];
  for (let x = Math.ceil(domain.min); x <= Math.floor(domain.max); x++) xs.push(x);
  if (xs.length === 0) throw new DomainError("domain contains no integer steps");
  return xs;
}

/**
 * Sweep every model and metric across the shared single-axis domain (MVP). Models must share the
 * same progression `variable` and `domain`. Metrics are evaluated in declared order so each may
 * reference earlier model/metric values.
 */
export function sweepMetrics(models: Model[], metricDefs: MetricDef[]): MetricSeries[] {
  if (models.length === 0) throw new DomainError("no model: entities to sweep");

  const variable = models[0].variable;
  const domain = models[0].domain;
  for (const m of models) {
    if (m.variable !== variable) {
      throw new DomainError(
        `multi-variable models are out of scope (MVP single-axis): '${m.id}' uses '${m.variable}', expected '${variable}'`,
      );
    }
    if (m.domain.min !== domain.min || m.domain.max !== domain.max) {
      throw new DomainError(`model '${m.id}' domain differs from the shared domain`);
    }
  }
  const xs = domainSteps(domain);

  // Compile once. Models see only the variable; metrics see the variable + all model/metric names.
  const modelFns: { id: string; name: string; fn: EvalFn; tunability?: Model["tunability"] }[] = models.map((m) => ({
    id: m.id,
    name: nameFor(m.id),
    fn: compile(m.formula, [variable]),
    tunability: m.tunability,
  }));
  const known = new Set<string>([variable, ...modelFns.map((m) => m.name)]);
  const metricFns: { id: string; fn: EvalFn }[] = [];
  for (const md of metricDefs) {
    metricFns.push({ id: md.id, fn: compile(md.formula, [...known]) });
    known.add(md.id); // later metrics may reference this one
  }

  const modelSeries = new Map<string, Sample[]>(modelFns.map((m) => [m.name, []]));
  const metricSeries = new Map<string, Sample[]>(metricFns.map((m) => [m.id, []]));

  for (const x of xs) {
    const env: Record<string, number> = { [variable]: x };
    for (const m of modelFns) {
      const v = m.fn(env);
      env[m.name] = v;
      modelSeries.get(m.name)!.push({ x, value: v });
    }
    for (const m of metricFns) {
      const v = m.fn(env);
      env[m.id] = v;
      metricSeries.get(m.id)!.push({ x, value: v });
    }
  }

  const out: MetricSeries[] = [];
  for (const m of modelFns) out.push({ id: m.name, samples: modelSeries.get(m.name)!, kind: "model", tunability: m.tunability });
  for (const m of metricFns) out.push({ id: m.id, samples: metricSeries.get(m.id)!, kind: "metric" });
  return out;
}
