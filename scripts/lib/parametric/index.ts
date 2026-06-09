/**
 * index.ts — parametric sweep orchestration + public surface (cycle-005, FR-1, B.7).
 *
 * Loads `model:` + `tunability` + composed `metrics:`/`thresholds:` from a game-state directory,
 * runs sweep → first-crossing → spike detection, and renders a deterministic report. Mirrors the
 * F1/F2 module shape (pure-ish core, thin I/O shell, CLI tail). YAML is read via `yq` (the repo's
 * existing convention — no in-process YAML dependency; see drift-reconciler.ts).
 */
import { readdirSync, statSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";
import { sweepMetrics, type Model, type MetricDef, type MetricSeries } from "./sweep.ts";
import { firstCrossing, detectSpikes, parseThreshold, type Threshold, type Crossover, type Spike } from "./crossover.ts";
import { rankKnobs } from "./sensitivity.ts";
import { renderSweepReport, type SweepResult, type TunabilityTag } from "./report.ts";

export type { SweepResult } from "./report.ts";

export class MissingModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingModelError";
  }
}

interface LoadedGameState {
  models: Model[];
  metricDefs: MetricDef[];
  thresholds: Threshold[];
  tags: TunabilityTag[];
}

function loadYaml(file: string): unknown {
  const ext = extname(file);
  if (ext === ".json") return JSON.parse(readFileSync(file, "utf8"));
  try {
    const json = execFileSync("yq", ["-o=json", ".", file], { encoding: "utf8" });
    return JSON.parse(json);
  } catch (e) {
    throw new Error(`failed to parse ${file} via yq (is yq installed?): ${(e as Error).message}`);
  }
}

function walkYaml(dir: string, out: string[]): void {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    const st = statSync(full);
    if (st.isDirectory()) walkYaml(full, out);
    else if ([".yaml", ".yml"].includes(extname(full))) out.push(full);
  }
}

/** Extract models, composed metric defs, declared thresholds, and tunability tags from a game-state dir. */
export function loadGameState(gameStateDir: string): LoadedGameState {
  const files: string[] = [];
  walkYaml(gameStateDir, files);
  files.sort(); // deterministic order

  const models: Model[] = [];
  const metricDefs: MetricDef[] = [];
  const thresholds: Threshold[] = [];
  const tags: TunabilityTag[] = [];

  for (const file of files) {
    const doc = loadYaml(file) as Record<string, any> | null;
    if (!doc || typeof doc !== "object") continue;
    const id = typeof doc.id === "string" ? doc.id : undefined;

    // tunability tag (models AND structural non-model entities)
    if (id && (doc.tunability === "engine-default" || doc.tunability === "structural")) {
      tags.push({ id, tunability: doc.tunability });
    }

    // model: block → a swept Model
    if (id && doc.model && typeof doc.model === "object") {
      const m = doc.model;
      if (typeof m.variable === "string" && m.domain && typeof m.formula === "string") {
        models.push({
          id,
          variable: m.variable,
          domain: { min: Number(m.domain.min), max: Number(m.domain.max) },
          formula: m.formula,
          tunability: doc.tunability === "engine-default" || doc.tunability === "structural" ? doc.tunability : undefined,
        });
      }
    }

    // composed metric defs
    if (Array.isArray(doc.metrics)) {
      for (const md of doc.metrics) {
        if (md && typeof md.id === "string" && typeof md.formula === "string") {
          metricDefs.push({ id: md.id, formula: md.formula, role: md.role });
        }
      }
    }

    // declared thresholds
    if (Array.isArray(doc.thresholds)) {
      for (const t of doc.thresholds) {
        if (t && typeof t.metric === "string" && typeof t.test === "string") {
          thresholds.push(parseThreshold(t.metric, t.test));
        }
      }
    }
  }

  return { models, metricDefs, thresholds, tags };
}

export interface RunSweepOpts {
  spikeFactor?: number;
  window?: number;
  minAbsJump?: number;
}

/** Run the full parametric sweep on a game-state directory. */
export function runSweep(gameStateDir: string, opts: RunSweepOpts = {}): SweepResult {
  const { models, metricDefs, thresholds, tags } = loadGameState(gameStateDir);
  if (models.length === 0) {
    throw new MissingModelError(
      `no \`model:\` entities found under ${gameStateDir} — /augury --sweep needs at least one parametric model`,
    );
  }

  const series = sweepMetrics(models, metricDefs);
  const byId = new Map<string, MetricSeries>(series.map((s) => [s.id, s]));
  const variable = models[0].variable;
  const domain = models[0].domain;

  const crossovers: Crossover[] = thresholds.map((t) => {
    const s = byId.get(t.metric);
    if (!s) return { metric: t.metric, op: t.op, value: t.value, x: null, note: `metric '${t.metric}' not found` };
    return firstCrossing(s, t);
  });

  const spikes: Spike[] = series.flatMap((s) => detectSpikes(s, opts));

  // FR-2 knob surfacing: rank tunable knobs by leverage on the primary metric (if one is declared).
  const primary = metricDefs.find((m) => m.role === "primary") ?? metricDefs[metricDefs.length - 1];
  let knobs: SweepResult["knobs"];
  if (primary) {
    const threshold = thresholds.find((t) => t.metric === primary.id);
    knobs = rankKnobs(models, metricDefs, { primaryMetric: primary.id, threshold, delta: 1 });
  }

  return { variable, domain, series, crossovers, spikes, tags, knobs };
}

// CLI: `npx tsx scripts/lib/parametric/index.ts <gameStateDir> [outDir]`
if (process.argv[1]?.endsWith("index.ts") && process.argv[1]?.includes("parametric")) {
  const [, , gameStateDir, outDir] = process.argv;
  if (!gameStateDir) {
    process.stderr.write("usage: index.ts <gameStateDir> [outDir]\n");
    process.exit(2);
  }
  const result = runSweep(gameStateDir);
  const md = renderSweepReport(result);
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    const path = join(outDir, "sweep-report.md");
    writeFileSync(path, md, "utf8");
    process.stdout.write(`sweep report written: ${path}\n`);
  } else {
    process.stdout.write(md + "\n");
  }
  process.stdout.write(
    `crossings=${result.crossovers.filter((c) => c.x !== null).length} spikes=${result.spikes.length} models=${result.series.filter((s) => s.kind === "model").length}\n`,
  );
}
