/**
 * index.ts — observed-trace orchestration + CLI (cycle-007, Sprint 2; FR-3/4/5).
 *
 * `analyzeTrace(batchDir)` is the seam Arneson later targets: sidecars in, claim-tagged
 * predicted-vs-observed report out. The incentive-state and context default to what the
 * sidecars themselves declare (`experiment.incentive_state`, `experiment.context.value`,
 * repo-root-relative), overridable by flags. CLI follows the repo convention: progress to
 * stderr, report to stdout (construct-runtime Nakamoto convention; sdd.md §4.1).
 *
 *   npx tsx scripts/lib/trace/index.ts <sidecar-dir-or-batch-dir> \
 *     [--incentive-state <dir>] [--context <n>]
 */
import { basename, resolve } from "node:path";
import { loadBatch, type Batch } from "./ingest.ts";
import { gradeBatch } from "./grade.ts";
import { diffPredictedVsObserved, type PolicyDiff } from "./diff.ts";
import { detectCliff, type CliffResult } from "./cliff.ts";
import { contextAxis, type ContextAxis } from "./context-axis.ts";
import { renderTraceReport, type AxisForecast, type BatchMeta } from "./report.ts";
import { TraceError, type Sidecar, type SidecarClaim } from "./sidecar.ts";
import { analyzeIncentives } from "../payoff/index.ts";

export interface TraceAnalysis {
  batch: Batch;
  diff: PolicyDiff;
  cliff: CliffResult;
  /** v1.1 (FR-1.3): non-null iff the batch varies on context.value. */
  axis: ContextAxis | null;
  report: string;
  graded: number; // runs graded on ingest this pass (cycle-008)
}

/** Render a sidecar's provenance as a stable display tuple (FR-4.2) — fields in schema order,
 *  only those present; opaque values, displayed never interpreted. */
function provenanceTuple(s: Sidecar): string | null {
  const p = s.producer.provenance;
  if (!p) return null;
  const parts = (["agent_cmd_sha256", "engine_git_sha", "model_id", "construct_sha"] as const)
    .filter((k) => p[k] !== undefined)
    .map((k) => `${k}=${p[k]}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export interface TraceOpts {
  incentiveState?: string;
  context?: number;
  /** Fixture dir for grade-on-ingest (template + reward command). Default: batch.json / sidecar. */
  fixtureDir?: string;
  /** Re-grade already-graded real-agent runs from artifacts (enforce the trust rule). */
  regrade?: boolean;
}

export function analyzeTrace(batchDir: string, opts: TraceOpts = {}): TraceAnalysis {
  const batch = loadBatch(batchDir);
  // Grade-on-ingest: fill `observation` for any ungraded completed run by re-running the reward
  // command against its artifacts (cycle-008). Infra-bucketed runs are never targets (v1.1).
  // No-op when the batch is already fully graded.
  const grade = gradeBatch(batchDir, batch, { fixtureDir: opts.fixtureDir, regrade: opts.regrade });
  const ref = batch.sidecars[0] ?? batch.excluded[0] ?? batch.infra[0]; // loadBatch guarantees ≥ 1 record
  const incentiveState = opts.incentiveState ?? ref.experiment.incentive_state;
  const context = opts.context ?? ref.experiment.context.value;

  const analysis = analyzeIncentives(incentiveState);
  const intendedAction = analysis.dominance.intendedAction;
  if (!intendedAction) {
    throw new TraceError(
      `incentive-state ${incentiveState} declares no intended action (reward intent) — ` +
        "cannot split forecast into hack/fix classes",
    );
  }

  const diff = diffPredictedVsObserved(batch, analysis, context, intendedAction);
  const cliff = detectCliff(diff);

  // v1.1 context axis (FR-1.3): per-value argmax looked up from the SAME analysis (no new
  // payoff computation); an out-of-domain value fails fast in the existing TraceError regime.
  const axis = contextAxis(batch);
  let axisForecasts: AxisForecast[] | undefined;
  if (axis) {
    axisForecasts = axis.values.map((value) => {
      const point = analysis.dominance.argmax.find((p) => p.context === value);
      if (!point) {
        const domain = analysis.matrix.contexts;
        throw new TraceError(
          `context ${value} (per-${axis.name} group) is outside the incentive-state domain ` +
            `(${domain[0]}..${domain[domain.length - 1]})`,
        );
      }
      return { value, action: point.action, cls: point.action === intendedAction ? "fix" : "hack" };
    });
  }

  const all = [...batch.sidecars, ...batch.excluded, ...batch.infra];
  const meta: BatchMeta = {
    label: basename(resolve(batchDir)),
    contextName: ref.experiment.context.name,
    completed: batch.sidecars.length,
    excluded: {
      runnerError: batch.excluded.filter((s) => s.run.status === "runner-error").length,
      timeout: batch.excluded.filter((s) => s.run.status === "timeout").length,
    },
    infra: batch.infra.length,
    provenance: [...new Set(all.map(provenanceTuple).filter((t): t is string => t !== null))],
    claims: [...new Set<SidecarClaim>(all.map((s) => s.claim_strength))],
  };
  const report = renderTraceReport(diff, cliff, meta, axis, axisForecasts);
  return { batch, diff, cliff, axis, report, graded: grade.graded };
}

// CLI: `npx tsx scripts/lib/trace/index.ts <dir> [--incentive-state <dir>] [--context <n>]`
if (process.argv[1]?.endsWith("index.ts") && process.argv[1]?.includes("trace")) {
  const args = process.argv.slice(2);
  let dir: string | undefined;
  const opts: TraceOpts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--incentive-state") opts.incentiveState = args[++i];
    else if (args[i] === "--context") opts.context = Number(args[++i]);
    else if (args[i] === "--fixture") opts.fixtureDir = args[++i];
    else if (args[i] === "--regrade") opts.regrade = true;
    else if (!dir) dir = args[i];
    else {
      process.stderr.write(`unexpected argument: ${args[i]}\n`);
      process.exit(2);
    }
  }
  if (!dir || (opts.context !== undefined && !Number.isFinite(opts.context))) {
    process.stderr.write("usage: index.ts <sidecar-dir-or-batch-dir> [--incentive-state <dir>] [--context <n>] [--fixture <dir>] [--regrade]\n");
    process.exit(2);
  }
  process.stderr.write(`ingesting ${dir} ...\n`);
  const result = analyzeTrace(dir, opts);
  const infraNote = result.batch.infra.length > 0 ? ` + ${result.batch.infra.length} infra` : "";
  process.stderr.write(
    `${result.batch.sidecars.length} completed + ${result.batch.excluded.length} excluded${infraNote} records; ` +
      `graded-on-ingest=${result.graded}; severity=${result.cliff.severity}\n`,
  );
  process.stdout.write(result.report + "\n");
}
