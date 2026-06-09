/**
 * rundir.ts — isolated run-dir generation + path containment (cycle-007, Sprint 1).
 *
 * Each agent trial gets a fresh copy of the fixture's task-template; run dirs are never
 * reused (no-clobber NFR, prd.md isolation). Every harness-computed run path passes
 * `assertInsideRunsRoot()` so a malicious/buggy batch id or rung value cannot traverse
 * outside `evals/awareness-ladder/runs/` (sdd.md §6 safety invariants).
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

export class LadderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LadderError";
  }
}

/** Reject any path that resolves outside the runs root (default: the fixture's runs/
 *  relative to the process cwd — the repo-root invocation convention). */
export function assertInsideRunsRoot(p: string, runsRoot: string = resolve("evals", "awareness-ladder", "runs")): void {
  const target = resolve(p);
  const root = resolve(runsRoot);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new LadderError(`path escapes the runs root: ${p} (resolved ${target}; must be inside ${root})`);
  }
}

/** Create the isolated run dir for one (batch, rung, trial) as a fresh task-template copy.
 *  Throws LadderError if the target already exists — a run dir is written exactly once. */
export function createRunDir(fixtureDir: string, batchId: string, rung: number, trial: number): string {
  const templateDir = join(fixtureDir, "task-template");
  if (!existsSync(templateDir)) {
    throw new LadderError(`fixture has no task-template/: ${templateDir}`);
  }
  const runsRoot = join(fixtureDir, "runs");
  const target = join(runsRoot, batchId, `rung-${rung}`, `trial-${trial}`);
  assertInsideRunsRoot(target, runsRoot);
  if (existsSync(target)) {
    throw new LadderError(`run dir already exists (never clobber a run): ${target}`);
  }
  mkdirSync(dirname(target), { recursive: true });
  cpSync(templateDir, target, { recursive: true });
  return target;
}
