/**
 * runner.ts — the ONLY agent-touching code in the cycle (cycle-007, Sprint 3; FR-2).
 *
 * `runAgent` spawns a real agent in an isolated run dir with the rung prompt and a timeout.
 * It NEVER throws per-trial: a paid 15-run batch must not die because one agent hangs or the
 * spawn fails (sdd.md §6 regime 2). Failures degrade to RunStatus `timeout` / `runner-error`;
 * the caller emits a sidecar with no observation, and scoring is the caller's separate step
 * (the runner's captured exit code is metadata only — ground truth is the scorer's own re-run,
 * sdd.md §5.2). Narration = captured stdout, a secondary field, never classified on.
 *
 * The agent command is DATA, not code: a template string with a `{promptfile}` placeholder.
 * The runner knows nothing about what the agent is — swapping models/CLIs is a flag, not an
 * edit (sdd.md §2; OQ-1). Argv is tokenized; `{promptfile}` is substituted as a single arg
 * (never word-split, never shell-interpolated) — there is no shell in the spawn path.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { RunStatus } from "../trace/sidecar.ts";
import { LadderError, assertInsideRunsRoot } from "./rundir.ts";

export const DEFAULT_AGENT_CMD = "claude -p {prompt} --permission-mode acceptEdits";

export interface RunResult {
  status: RunStatus;
  exitCode: number | null; // metadata only; null when killed by signal / spawn failure
  durationMs: number;
  narration: string; // captured stdout (secondary field)
}

/** Split a command template into argv on whitespace and substitute two placeholders, each as a
 *  SINGLE argv token (never word-split, never shell-interpolated — there is no shell here):
 *    {prompt}     → the rung prompt's CONTENTS (what `claude -p <text>` expects)
 *    {promptfile} → the rung prompt's file PATH (for agents that read a file)
 *  At least one placeholder must appear. Multi-line {prompt} contents stay one token because
 *  spawn receives argv directly; quoting is intentionally unsupported (template is config). */
export function buildArgv(template: string, promptFile: string, promptText: string): string[] {
  const tokens = template.trim().split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) throw new LadderError("agent command template is empty");
  let sawPlaceholder = false;
  const argv = tokens.map((t) => {
    let out = t;
    if (out.includes("{prompt}")) {
      sawPlaceholder = true;
      out = out.replace("{prompt}", promptText);
    }
    if (out.includes("{promptfile}")) {
      sawPlaceholder = true;
      out = out.replace("{promptfile}", promptFile);
    }
    return out;
  });
  if (!sawPlaceholder) {
    throw new LadderError(`agent command template lacks a {prompt} or {promptfile} placeholder: ${template}`);
  }
  return argv;
}

/** Run one agent trial. cwd = the isolated run dir (containment-asserted). Never throws
 *  per-trial — every failure mode maps to a RunStatus the caller can record as a sidecar. */
export function runAgent(
  runDir: string,
  promptFile: string,
  agentCmdTemplate: string,
  timeoutSec: number,
): RunResult {
  assertInsideRunsRoot(runDir);
  let promptText = "";
  if (agentCmdTemplate.includes("{prompt}")) {
    try {
      promptText = readFileSync(promptFile, "utf8");
    } catch (e) {
      return { status: "runner-error", exitCode: null, durationMs: 0, narration: `cannot read prompt file ${promptFile}: ${(e as Error).message}` };
    }
  }
  const argv = buildArgv(agentCmdTemplate, promptFile, promptText);
  const started = performance.now();
  const res = spawnSync(argv[0], argv.slice(1), {
    cwd: runDir,
    encoding: "utf8",
    timeout: timeoutSec * 1000,
    killSignal: "SIGKILL",
    maxBuffer: 32 * 1024 * 1024,
  });
  const durationMs = Math.round(performance.now() - started);
  const narration = (res.stdout ?? "") + (res.stderr ? `\n[stderr]\n${res.stderr}` : "");

  if (res.error && (res.error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
    return { status: "timeout", exitCode: null, durationMs, narration };
  }
  if (res.error) {
    // ENOENT (no such agent binary), EACCES, etc. — harness failure, not an agent result.
    return { status: "runner-error", exitCode: null, durationMs, narration: narration || String(res.error) };
  }
  if (res.signal) {
    // killed by a signal we did not request as timeout → treat as runner-error
    return { status: "runner-error", exitCode: null, durationMs, narration };
  }
  return { status: "completed", exitCode: res.status ?? null, durationMs, narration };
}
