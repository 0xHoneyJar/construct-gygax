# `ladder/` — the run engine (drivable by a sibling)

The harness that *produces* observations: isolated run dirs, a real-agent runner, and an
artifact-grounded scorer. Per the Split-Run-from-Grade pivot (cycle-008), **running** lives here;
**grading + analysis** is the analyst's job (`scripts/lib/trace/`). A sibling construct (Arneson's
`/playout --real`) drives this engine where it lives — no relocation.

## CLI

```bash
# RUN: per (rung × trial) → isolated dir → spawn agent → grade inline → sidecar
npx tsx scripts/lib/ladder/index.ts run \
  --fixture evals/awareness-ladder \
  [--rungs 0,1,2] [--trials 5] \
  [--agent-cmd 'claude -p {prompt} --permission-mode acceptEdits'] \
  [--timeout 300] [--dry-run] [--json]

# SCORE: re-grade a kept batch without spawning (artifact permanence)
npx tsx scripts/lib/ladder/index.ts score --batch <batch-dir>
```

### `run` flags

| flag | default | meaning |
|------|---------|---------|
| `--fixture` | `evals/awareness-ladder` | fixture dir (manifest + task-template + rungs) |
| `--rungs` | manifest order | comma list of rung indices |
| `--trials` | manifest `trials_default` (5) | trials per rung |
| `--agent-cmd` | `claude -p {prompt} --permission-mode acceptEdits` | command template; `{prompt}`=rung contents, `{promptfile}`=rung path (each a single argv token; no shell) |
| `--timeout` | manifest `timeout_seconds` (300) | per-trial seconds; exceeding → `timeout` status |
| `--dry-run` | — | print the full (rung×trial) plan + resolved command; spawn nothing |
| `--json` | — | emit a machine-readable result to stdout (for programmatic drivers) |

### Machine-readable output (`--json`)

stdout is a single JSON object; stderr carries human progress (Nakamoto convention):

```json
{ "ok": true, "batch_dir": "...", "sidecars_dir": "...", "batch_json": "...",
  "runs": 15, "counts": { "completed": 14, "timeout": 1 } }
```

### Exit codes

| code | meaning |
|------|---------|
| `0` | batch completed. Per-trial agent failures are RECORDED (`runner-error`/`timeout` sidecars), not fatal — a batch with some failed trials still exits 0. |
| `2` | setup/usage failure (bad fixture, unknown flag, missing `--batch`) — a `LadderError`. |

A sibling driver: invoke with `--json`, check process exit `0`, parse stdout, read `batch_dir` →
hand to the grader (`scripts/lib/trace/index.ts <batch_dir>`).

## Output contract

Run dirs + sidecars are written under `<fixture>/runs/<batch-id>/` following
`schemas/observed-trace-batch.v1.md` (`run_dir` is batch-relative). `batch.json` stores the agent
command **template**, never the expanded environment. `runs/` is gitignored.

## Modules

- `rundir.ts` — `createRunDir` (no-clobber) + `assertInsideRunsRoot` (containment).
- `runner.ts` — `runAgent` (shell-free spawn, timeout→SIGKILL, never-throws-per-trial).
- `scorer.ts` — `scoreRun` (re-runs the reward command, diffs vs template) + `sidecarFromScore`.
  *This is the grader; it is the analyst's logic and is also called by `trace/grade.ts` for
  grade-on-ingest. If the runner ever emigrates to Arneson's repo, the scorer stays with Gygax.*
