/**
 * index.ts — ladder harness CLI: `run` and `score` (cycle-007, Sprint 3; FR-2).
 *
 *   run   — per (rung × trial): createRunDir → runAgent → scoreRun → sidecar. Sequential to
 *           cap burst spend; writes batch.json (command TEMPLATE, never the expanded env) +
 *           sidecars/. `--dry-run` prints the full plan + resolved command, spawning nothing.
 *   score — re-score an existing kept batch WITHOUT spawning any agent (artifact permanence):
 *           re-runs the scorer over each kept run dir, rewriting sidecars byte-identically.
 *
 * The manifest is data (read via `yq`, the repo loader convention). Output discipline:
 * progress to stderr, machine/plan to stdout (Nakamoto convention, sdd.md §4.1).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { createRunDir, assertInsideRunsRoot, LadderError } from "./rundir.ts";
import { runAgent, DEFAULT_AGENT_CMD, type RunResult } from "./runner.ts";
import { scoreRun, sidecarFromScore } from "./scorer.ts";
import type { ExperimentMeta, Producer, RunMeta, Sidecar } from "../trace/sidecar.ts";

interface Manifest {
  id: string;
  reward_command: string[];
  incentive_state: string; // relative to the fixture dir
  context: { name: string; value: number };
  rungs: string[]; // relative to the fixture dir
  trials_default: number;
  timeout_seconds: number;
}

function loadYaml(file: string): any {
  if (file.endsWith(".json")) return JSON.parse(readFileSync(file, "utf8"));
  try {
    return JSON.parse(execFileSync("yq", ["-o=json", ".", file], { encoding: "utf8" }));
  } catch (e) {
    throw new LadderError(`failed to parse ${file} via yq: ${(e as Error).message}`);
  }
}

function loadManifest(fixtureDir: string): Manifest {
  const m = loadYaml(join(fixtureDir, "manifest.yaml")) as Record<string, any>;
  if (!Array.isArray(m.reward_command) || m.reward_command.length === 0) {
    throw new LadderError("manifest.reward_command must be a non-empty array");
  }
  if (!Array.isArray(m.rungs) || m.rungs.length === 0) throw new LadderError("manifest.rungs must be a non-empty array");
  return {
    id: m.id,
    reward_command: m.reward_command,
    incentive_state: m.incentive_state,
    context: { name: m.context?.name, value: Number(m.context?.value) },
    rungs: m.rungs,
    trials_default: Number(m.trials_default ?? 5),
    timeout_seconds: Number(m.timeout_seconds ?? 300),
  };
}

const RUNG_NAMES = ["blind", "reward-aware", "adversarial"] as const;

interface Plan {
  fixtureDir: string;
  manifest: Manifest;
  rungs: number[];
  trials: number;
  agentCmd: string;
  timeoutSec: number;
}

interface BatchManifest {
  batch_id: string;
  fixture: string;
  agent_cmd_template: string; // the TEMPLATE, never the expanded environment
  rungs: number[];
  trials_per_rung: number;
  timeout_seconds: number;
  created_at: string;
}

function producer(agentCmd: string): Producer {
  return { kind: "real-agent", id: "claude-cli", detail: agentCmd };
}

function experimentMeta(plan: Plan): ExperimentMeta {
  return {
    id: plan.manifest.id,
    fixture: plan.fixtureDir,
    incentive_state: resolve(plan.fixtureDir, plan.manifest.incentive_state),
    context: plan.manifest.context,
  };
}

/** Plan lines for --dry-run: one per (rung × trial) + the resolved command. */
export function planLines(plan: Plan): string[] {
  const lines: string[] = [];
  lines.push(`fixture: ${plan.fixtureDir}`);
  lines.push(`agent command: ${plan.agentCmd}`);
  lines.push(`timeout: ${plan.timeoutSec}s · ${plan.rungs.length} rungs × ${plan.trials} trials = ${plan.rungs.length * plan.trials} runs`);
  for (const rung of plan.rungs) {
    for (let trial = 1; trial <= plan.trials; trial++) {
      lines.push(`  rung ${rung} (${RUNG_NAMES[rung]}) trial ${trial}`);
    }
  }
  return lines;
}

function runBatch(plan: Plan, batchId: string, write: (msg: string) => void): { batchDir: string; counts: Record<string, number> } {
  const runsRoot = join(plan.fixtureDir, "runs");
  const batchDir = join(runsRoot, batchId);
  assertInsideRunsRoot(batchDir, runsRoot);
  const sidecarsDir = join(batchDir, "sidecars");
  mkdirSync(sidecarsDir, { recursive: true });
  const counts: Record<string, number> = {};

  const batchManifest: BatchManifest = {
    batch_id: batchId,
    fixture: plan.fixtureDir,
    agent_cmd_template: plan.agentCmd, // template only
    rungs: plan.rungs,
    trials_per_rung: plan.trials,
    timeout_seconds: plan.timeoutSec,
    created_at: new Date().toISOString(),
  };
  writeFileSync(join(batchDir, "batch.json"), JSON.stringify(batchManifest, null, 2) + "\n");

  const templateDir = join(plan.fixtureDir, "task-template");
  for (const rung of plan.rungs) {
    const promptFile = resolve(plan.fixtureDir, plan.manifest.rungs[rung]);
    for (let trial = 1; trial <= plan.trials; trial++) {
      write(`rung ${rung} (${RUNG_NAMES[rung]}) trial ${trial}/${plan.trials} ...`);
      const runDir = createRunDir(plan.fixtureDir, batchId, rung, trial);
      const result = runAgent(runDir, promptFile, plan.agentCmd, plan.timeoutSec);
      const startedAt = new Date().toISOString();
      const sidecar = buildSidecar(plan, runDir, rung, trial, result, startedAt, templateDir);
      writeFileSync(join(sidecarsDir, `rung-${rung}-trial-${trial}.json`), JSON.stringify(sidecar, null, 2) + "\n");
      counts[sidecar.run.status] = (counts[sidecar.run.status] ?? 0) + 1;
      write(`  → ${sidecar.run.status}${sidecar.observation ? " / " + sidecar.observation.classification : ""}`);
    }
  }
  return { batchDir, counts };
}

/** Build the sidecar for one trial: score only if the agent actually completed. */
function buildSidecar(
  plan: Plan,
  runDir: string,
  rung: number,
  trial: number,
  result: RunResult,
  startedAt: string,
  templateDir: string,
): Sidecar {
  const runDirRel = join(...runDir.split(/[\\/]/).slice(-2)); // batch-relative: rung-<r>/trial-<t> (observed-trace-batch.v1.md)
  const run: RunMeta = {
    rung,
    rung_name: RUNG_NAMES[rung],
    trial,
    status: result.status,
    run_dir: runDirRel,
    started_at: startedAt,
    duration_ms: result.durationMs,
  };
  if (result.status !== "completed") {
    return {
      schema: "observed-trace/v1",
      claim_strength: "real-agent-observed",
      producer: producer(plan.agentCmd),
      experiment: experimentMeta(plan),
      run,
      narration: result.narration,
    };
  }
  const score = scoreRun(runDir, templateDir, plan.manifest.reward_command);
  return sidecarFromScore(score, {
    producer: producer(plan.agentCmd),
    experiment: experimentMeta(plan),
    run,
    narration: result.narration,
  });
}

/** Re-score a kept batch without spawning: re-run the scorer over each run dir, rewrite
 *  sidecars. Completed-run classification is byte-identical; excluded runs stay excluded. */
function scoreBatch(batchDir: string, write: (msg: string) => void): string {
  if (!existsSync(join(batchDir, "batch.json"))) throw new LadderError(`not a batch dir (no batch.json): ${batchDir}`);
  const bm = JSON.parse(readFileSync(join(batchDir, "batch.json"), "utf8")) as BatchManifest;
  const plan: Plan = {
    fixtureDir: bm.fixture,
    manifest: loadManifest(bm.fixture),
    rungs: bm.rungs,
    trials: bm.trials_per_rung,
    agentCmd: bm.agent_cmd_template,
    timeoutSec: bm.timeout_seconds,
  };
  const sidecarsDir = join(batchDir, "sidecars");
  const templateDir = join(plan.fixtureDir, "task-template");
  for (const f of readdirSync(sidecarsDir).filter((x) => x.endsWith(".json")).sort()) {
    const prev = JSON.parse(readFileSync(join(sidecarsDir, f), "utf8")) as Sidecar;
    if (prev.run.status !== "completed") {
      write(`${f}: ${prev.run.status} (excluded, left as-is)`);
      continue;
    }
    const runDir = resolve(batchDir, prev.run.run_dir); // run_dir is batch-relative (cycle-008)
    const score = scoreRun(runDir, templateDir, plan.manifest.reward_command);
    const rescored = sidecarFromScore(score, {
      producer: prev.producer,
      experiment: prev.experiment,
      run: prev.run,
      narration: prev.narration,
    });
    writeFileSync(join(sidecarsDir, f), JSON.stringify(rescored, null, 2) + "\n");
    write(`${f}: ${rescored.observation!.classification}`);
  }
  return batchDir;
}

/** Resolve `run` CLI flags into a Plan. */
export function resolveRunPlan(args: string[]): Plan {
  let fixture = join("evals", "awareness-ladder");
  let rungs: number[] | undefined;
  let trials: number | undefined;
  let agentCmd = DEFAULT_AGENT_CMD;
  let timeoutSec: number | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--fixture") fixture = args[++i];
    else if (a === "--rungs") rungs = args[++i].split(",").map((s) => Number(s.trim()));
    else if (a === "--trials") trials = Number(args[++i]);
    else if (a === "--agent-cmd") agentCmd = args[++i];
    else if (a === "--timeout") timeoutSec = Number(args[++i]);
    else if (a === "--dry-run" || a === "--json") continue;
    else throw new LadderError(`unknown run flag: ${a}`);
  }
  const fixtureDir = isAbsolute(fixture) ? fixture : resolve(fixture);
  const manifest = loadManifest(fixtureDir);
  return {
    fixtureDir,
    manifest,
    rungs: rungs ?? manifest.rungs.map((_, i) => i),
    trials: trials ?? manifest.trials_default,
    agentCmd,
    timeoutSec: timeoutSec ?? manifest.timeout_seconds,
  };
}

function batchIdFromClock(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// CLI: `npx tsx scripts/lib/ladder/index.ts run|score [...]`
if (process.argv[1]?.endsWith("index.ts") && process.argv[1]?.includes("ladder")) {
  const [sub, ...rest] = process.argv.slice(2);
  const err = (msg: string) => {
    process.stderr.write(msg + "\n");
    process.exit(2);
  };
  try {
    if (sub === "run") {
      const plan = resolveRunPlan(rest);
      if (rest.includes("--dry-run")) {
        process.stdout.write(planLines(plan).join("\n") + "\n");
        process.exit(0);
      }
      const batchId = batchIdFromClock();
      process.stderr.write(`batch ${batchId}: ${plan.rungs.length}×${plan.trials} runs, agent='${plan.agentCmd}'\n`);
      const { batchDir, counts } = runBatch(plan, batchId, (m) => process.stderr.write(m + "\n"));
      if (rest.includes("--json")) {
        // Machine-readable result for a sibling construct driving this engine (item 2).
        process.stdout.write(JSON.stringify({
          ok: true,
          batch_dir: batchDir,
          sidecars_dir: join(batchDir, "sidecars"),
          batch_json: join(batchDir, "batch.json"),
          runs: plan.rungs.length * plan.trials,
          counts,
        }) + "\n");
      } else {
        process.stdout.write(batchDir + "\n");
      }
    } else if (sub === "score") {
      let batch: string | undefined;
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === "--batch") batch = rest[++i];
        else err(`unknown score flag: ${rest[i]}`);
      }
      if (!batch) err("usage: index.ts score --batch <dir>");
      const dir = scoreBatch(resolve(batch!), (m) => process.stderr.write(m + "\n"));
      process.stdout.write(dir + "\n");
    } else {
      err("usage: index.ts run [--fixture d --rungs 0,1,2 --trials 5 --agent-cmd '...{promptfile}...' --timeout 300 --dry-run]\n       index.ts score --batch <dir>");
    }
  } catch (e) {
    if (e instanceof LadderError) err(`LadderError: ${e.message}`);
    throw e;
  }
}
