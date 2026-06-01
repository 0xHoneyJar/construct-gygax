/**
 * sim-orchestrator.ts — F2 Simulation Orchestrator (Sprint 3, Tasks 3.1–3.3)
 *
 * grimoires/loa/sprint.md:L197-199; SDD §1.4, §3.2, §4.2.
 *
 * Three responsibilities:
 *   1. proposeScenario() — build a ScenarioSpec (entry fn + input space) from F1's StructuralMap.
 *   2. THE APPROVAL GATE — runSimulation() refuses to execute until `approvedBy` is set. This is
 *      the load-bearing UX that guards against "silently measuring the wrong thing"
 *      (prd.md:L187-189; SDD §4.2). approveScenario() is the only blessed way to set it.
 *   3. Monte-Carlo playout — drive the engine through the gygaxDriver contract inside the
 *      Sprint-1 sandbox (network-denied, capped), constructing valid states VIA THE DRIVER, not
 *      by guessing signatures (prd.md:L190). Aggregate into a labeled SimDistribution.
 *
 * No LLM in the per-step loop — resolution is mechanical in the sandbox (SDD §5.1). Randomness is
 * a seeded PRNG so a labeled distribution is reproducible (and tests are deterministic).
 *
 * Runs under tsx (orchestration side); spawns the sandbox child (plain node).
 */
import { Sandbox, type SandboxCaps } from "./sandbox.ts";
import type { StructuralMap } from "./static-analyzer.ts";

export interface ScenarioSpec {
  entryFn: string;
  via: "gygaxDriver";
  inputSpace: { actor: string; maxSteps: number };
  runs: number;
  approvedBy?: string; // GATE: must be set before any execution (prd.md:L189)
  label: string;
}

export interface SimStats {
  mean: number;
  p50: number;
  p90: number;
  stdev: number;
}
export interface SimDistribution {
  scenarioLabel: string;
  n: number;
  stats: SimStats;
  histogram: { bucket: number | string; count: number }[];
}

/** Thrown when execution is attempted before the scenario is approved (SDD §6.1). */
export class ScenarioNotApprovedError extends Error {
  constructor(label: string) {
    super(
      `refusing to run "${label}": scenario not approved. Call approveScenario() first — ` +
        `Gygax never runs a sim you haven't seen and approved (prd.md:L187-189).`,
    );
    this.name = "ScenarioNotApprovedError";
  }
}

/**
 * Propose a scenario from F1's structural map. Picks the most-referenced traced function as the
 * entry point (the busiest hub of real wiring), falling back to generic driver self-play.
 */
export function proposeScenario(
  map: StructuralMap,
  opts: { runs?: number; actor?: string; maxSteps?: number } = {},
): ScenarioSpec {
  const freq = new Map<string, number>();
  for (const l of map.loops) {
    freq.set(l.from, (freq.get(l.from) ?? 0) + 1);
    freq.set(l.to, (freq.get(l.to) ?? 0) + 1);
  }
  let entryFn = "gygaxDriver";
  let best = 0;
  for (const [name, n] of freq) {
    if (n > best) {
      best = n;
      entryFn = name;
    }
  }
  const runs = opts.runs ?? 1000;
  const actor = opts.actor ?? "a";
  const maxSteps = opts.maxSteps ?? 200;
  return {
    entryFn,
    via: "gygaxDriver",
    inputSpace: { actor, maxSteps },
    runs,
    approvedBy: undefined,
    // Label identifies the SCENARIO SHAPE, not the run count — `runs` may be edited at approval,
    // and n is reported separately on the distribution. Keeps the label stable + honest.
    label: `${entryFn} self-play (actor=${actor})`,
  };
}

/** The ONLY blessed way to set approval. Returns a new spec; never mutates in place. */
export function approveScenario(spec: ScenarioSpec, approver: string): ScenarioSpec {
  if (!approver) throw new Error("approveScenario requires a non-empty approver");
  return { ...spec, approvedBy: approver };
}

/** A metric extracts one number per playout. Default = steps-to-terminal. */
export type Metric = (outcome: unknown, finalState: unknown, steps: number) => number;
const STEPS_METRIC: Metric = (_o, _s, steps) => steps;

/** Seeded PRNG (mulberry32) — deterministic, reproducible distributions. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

function aggregate(label: string, values: number[]): SimDistribution {
  const n = values.length;
  const mean = n ? values.reduce((s, v) => s + v, 0) / n : 0;
  const variance = n ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / n : 0;
  const sorted = [...values].sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const histogram = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, count]) => ({ bucket, count }));
  return {
    scenarioLabel: label,
    n,
    stats: {
      mean: Number(mean.toFixed(4)),
      p50: percentile(sorted, 50),
      p90: percentile(sorted, 90),
      stdev: Number(Math.sqrt(variance).toFixed(4)),
    },
    histogram,
  };
}

export interface RunOptions {
  repoPath: string;
  driverModule: string;
  metric?: Metric;
  seed?: number;
  caps?: SandboxCaps;
  network?: "deny" | "allow";
}

/**
 * Run the approved scenario: N seeded Monte-Carlo playouts through the gygaxDriver in the sandbox.
 * @throws ScenarioNotApprovedError if `spec.approvedBy` is unset (the gate).
 */
export async function runSimulation(
  spec: ScenarioSpec,
  opts: RunOptions,
): Promise<SimDistribution> {
  // ---- THE GATE — refuse before doing anything else (no sandbox spawned) ----
  if (!spec.approvedBy) throw new ScenarioNotApprovedError(spec.label);

  const metric = opts.metric ?? STEPS_METRIC;
  const seed = opts.seed ?? 1;
  const caps = opts.caps ?? { wallMs: 5000, memMB: 256 };
  const { actor, maxSteps } = spec.inputSpace;

  const box = await Sandbox.start({
    repoPath: opts.repoPath,
    driverModule: opts.driverModule,
    caps,
    network: opts.network ?? "deny",
  });

  const values: number[] = [];
  try {
    for (let run = 0; run < spec.runs; run++) {
      const rng = mulberry32(seed + run * 0x9e3779b1);
      let state = await box.call("getInitialState");
      let steps = 0;
      while (steps < maxSteps) {
        if (await box.call("isTerminal", state)) break;
        const actions = (await box.call("legalActions", state, actor)) as unknown[];
        if (!Array.isArray(actions) || actions.length === 0) break;
        const action = actions[Math.floor(rng() * actions.length)];
        state = await box.call("applyAction", state, action);
        steps++;
      }
      const outcome = await box.call("outcome", state);
      values.push(metric(outcome, state, steps));
    }
  } finally {
    await box.close();
  }

  return aggregate(spec.label, values);
}

/** Render a SimDistribution to Markdown for a balance/playtest report (SDD §4.3). */
export function renderSimDistributionMarkdown(dist: SimDistribution): string {
  const lines: string[] = [];
  lines.push(`# Simulation — ${dist.scenarioLabel}`);
  lines.push("");
  lines.push(`_n = ${dist.n} runs, executed through the gygaxDriver in the sandbox (network-denied, capped)._`);
  lines.push("");
  lines.push("| mean | p50 | p90 | stdev |");
  lines.push("|------|-----|-----|-------|");
  lines.push(`| ${dist.stats.mean} | ${dist.stats.p50} | ${dist.stats.p90} | ${dist.stats.stdev} |`);
  lines.push("");
  lines.push("## Histogram");
  lines.push("");
  lines.push("| value | count |");
  lines.push("|-------|-------|");
  for (const h of dist.histogram) lines.push(`| ${h.bucket} | ${h.count} |`);
  lines.push("");
  return lines.join("\n");
}
