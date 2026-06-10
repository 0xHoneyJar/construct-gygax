/**
 * grade.ts — grade-on-ingest (cycle-008, Split Run from Grade; item 1).
 *
 * The judge's half of the pairing: Gygax grades a batch produced by ANY conformant producer
 * (Arneson's real-agent sandbox, or its own ladder runner) without depending on the runner.
 * An external producer hands over artifacts + UNGRADED sidecars (completed runs with no
 * `observation`); Gygax fills each `observation` by re-running the reward command against the
 * handed-over artifacts (the artifact-grounded scorer — never the producer's self-report).
 *
 * Trust rule (strengthened by this cycle): the grader never trusts a real-agent producer's
 * grade. real-agent-observed runs are graded HERE from artifacts. A simulation-derived run has
 * no real artifacts to re-run — it must arrive already graded, and is trusted-but-labelled by
 * its weaker claim strength; Gygax never fabricates a grade for a simulation.
 *
 * run_dir resolves relative to the batch directory (observed-trace-batch.v1.md), with a
 * fixture-relative fallback for batches the Gygax runner wrote under <fixture>/runs/.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { TraceError, isGraded, type Sidecar } from "./sidecar.ts";
import type { Batch } from "./ingest.ts";
import { scoreRun } from "../ladder/scorer.ts";

export interface GradeResult {
  batch: Batch; // same object, ungraded completed sidecars now carry observations
  graded: number; // newly graded this pass
  preGraded: number; // arrived already graded (left as-is unless regrade)
}

export interface GradeOpts {
  /** Fixture dir (template + reward command). Defaults to batch.json `fixture`, then the
   *  sidecar's `experiment.fixture`. */
  fixtureDir?: string;
  /** Override the reward command; defaults to the fixture manifest's `reward_command`. */
  rewardCommand?: string[];
  /** Re-grade even already-graded real-agent runs (enforce the trust rule on a handed-over
   *  batch that arrived with producer-supplied observations). Never touches simulations. */
  regrade?: boolean;
}

function loadYaml(file: string): any {
  if (file.endsWith(".json")) return JSON.parse(readFileSync(file, "utf8"));
  try {
    return JSON.parse(execFileSync("yq", ["-o=json", ".", file], { encoding: "utf8" }));
  } catch (e) {
    throw new TraceError(`failed to parse ${file} via yq: ${(e as Error).message}`);
  }
}

function resolveFixtureDir(batchDir: string, batch: Batch, opts: GradeOpts): string {
  if (opts.fixtureDir) return resolve(opts.fixtureDir);
  const batchJson = join(batchDir, "batch.json");
  if (existsSync(batchJson)) {
    const bm = JSON.parse(readFileSync(batchJson, "utf8")) as Record<string, unknown>;
    if (typeof bm.fixture === "string") return resolve(bm.fixture);
  }
  const ref = batch.sidecars[0] ?? batch.excluded[0];
  if (ref?.experiment.fixture) return resolve(ref.experiment.fixture);
  throw new TraceError(`cannot locate the fixture to grade ${batchDir} — no --fixture, no batch.json fixture, no experiment.fixture`);
}

/** Resolve a run's artifact dir: batch-relative first (the contract), fixture-relative fallback. */
function resolveRunDir(batchDir: string, fixtureDir: string, runDirRel: string): string {
  if (isAbsolute(runDirRel) && existsSync(runDirRel)) return runDirRel;
  const batchRel = resolve(batchDir, runDirRel);
  if (existsSync(batchRel)) return batchRel;
  const fixtureRel = resolve(fixtureDir, runDirRel);
  if (existsSync(fixtureRel)) return fixtureRel;
  throw new TraceError(`run artifacts not found for run_dir "${runDirRel}" (looked under batch dir ${batchDir} and fixture ${fixtureDir})`);
}

function gradeOne(sidecar: Sidecar, batchDir: string, fixtureDir: string, rewardCommand: string[]): void {
  if (sidecar.claim_strength === "simulation-derived") {
    throw new TraceError(
      `cannot grade a simulation-derived run from artifacts (${sidecar.run.run_dir}): a simulation ` +
        "has no real run to re-execute — it must arrive already graded (trusted-but-labelled).",
    );
  }
  const runDir = resolveRunDir(batchDir, fixtureDir, sidecar.run.run_dir);
  const templateDir = join(fixtureDir, "task-template");
  const score = scoreRun(runDir, templateDir, rewardCommand);
  sidecar.observation = {
    classification: score.classification,
    exit_code: score.exitCode,
    anomaly_note: score.anomalyNote,
    artifacts: score.artifacts,
  };
}

/** Grade every ungraded completed run in the batch (re-running the reward command against its
 *  artifacts). Fail-fast: if a completed run cannot be graded, throw — a partially-graded batch
 *  would silently bias ratios (analysis-path error regime). Idempotent on already-graded runs
 *  unless `regrade` is set. */
export function gradeBatch(batchDir: string, batch: Batch, opts: GradeOpts = {}): GradeResult {
  const targets = batch.sidecars.filter((s) => opts.regrade ? s.claim_strength === "real-agent-observed" : !isGraded(s));
  let preGraded = batch.sidecars.filter(isGraded).length;
  if (targets.length === 0) return { batch, graded: 0, preGraded };

  const fixtureDir = resolveFixtureDir(batchDir, batch, opts);
  const rewardCommand = opts.rewardCommand ?? (() => {
    const manifestPath = join(fixtureDir, "manifest.yaml");
    if (!existsSync(manifestPath)) throw new TraceError(`fixture has no manifest.yaml: ${manifestPath}`);
    const m = loadYaml(manifestPath) as Record<string, unknown>;
    if (!Array.isArray(m.reward_command) || m.reward_command.length === 0) {
      throw new TraceError(`fixture manifest.reward_command must be a non-empty array: ${manifestPath}`);
    }
    return m.reward_command as string[];
  })();

  let graded = 0;
  for (const s of targets) {
    const wasGraded = isGraded(s);
    gradeOne(s, batchDir, fixtureDir, rewardCommand);
    graded += 1;
    if (wasGraded) preGraded -= 1; // it counted as pre-graded but we re-graded it
  }
  return { batch, graded, preGraded };
}
