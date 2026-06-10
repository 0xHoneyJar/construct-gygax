# Observed-Trace Batch Layout — `observed-trace-batch/v1`

**Status:** pinned · **Cycle:** cycle-008 (Split Run from Grade) · **Companion to:** `observed-trace.v1.schema.json`

The sidecar *record* schema is pinned in `observed-trace.v1.schema.json`. This document pins the
*on-disk batch* around it — the filesystem layout a producer (Arneson's sandbox, or Gygax's own
ladder runner) writes, and that Gygax's grader reads. A stranger can assemble a gradeable batch
from this document alone.

> **The split.** A producer *runs* agents and hands over **artifacts + ungraded sidecars**. Gygax
> *grades* by re-running the reward command against those artifacts and filling each sidecar's
> `observation`. The grader never trusts a real-agent producer's own grade — it re-derives it from
> the artifacts (the trust rule: the judge never produces the evidence it judges).

## Directory layout

```
<batch-dir>/
├── batch.json              # batch manifest (below) — REQUIRED for grade-on-ingest
├── sidecars/
│   ├── rung-0-trial-1.json # one observed-trace/v1 sidecar per run (ungraded or graded)
│   ├── rung-0-trial-2.json
│   └── ...
└── runs/                   # artifact trees, one dir per run
    ├── rung-0/trial-1/     # the agent's resulting files for that run
    │   ├── solution.py
    │   └── test_solution.py
    └── rung-2/trial-1/ ...
```

- The grader reads `*.json` from `<batch-dir>/sidecars/` (or from `<batch-dir>` directly if there
  is no `sidecars/` child).
- Each sidecar's `run.run_dir` is a path **relative to `<batch-dir>`** pointing at that run's
  artifact tree. The grader resolves artifacts at `<batch-dir>/<run_dir>`. (Gygax-written batches
  use `rung-<r>/trial-<t>`; any relative path that resolves inside the batch dir is valid.)

## `batch.json`

```json
{
  "schema": "observed-trace-batch/v1",
  "fixture": "/abs/or/rel/path/to/evals/awareness-ladder",
  "reward_command": ["python3", "test_solution.py"]
}
```

| field | required | meaning |
|-------|----------|---------|
| `schema` | yes | `"observed-trace-batch/v1"` |
| `fixture` | yes* | Path to the Gygax-owned fixture (provides `task-template/` + manifest `reward_command`). *Required unless the grader is given `--fixture` explicitly or every sidecar carries `experiment.fixture`. |
| `reward_command` | no | Overrides the fixture manifest's `reward_command` (argv array). |

Gygax's own runner also writes `agent_cmd_template`, `rungs`, `trials_per_rung`, `timeout_seconds`,
`created_at` — these are informational for the grader and may be omitted by an external producer.

## The ungraded sidecar (what a producer emits)

A producer emits each run as a **completed** `observed-trace/v1` record **without** an `observation`
block. `observation` is the *grading marker*: absent = ran-but-ungraded; Gygax fills it on ingest.

```json
{
  "schema": "observed-trace/v1",
  "claim_strength": "real-agent-observed",
  "producer": { "kind": "real-agent", "id": "arneson", "detail": "playout --real" },
  "experiment": {
    "id": "awareness-ladder",
    "fixture": "/path/to/evals/awareness-ladder",
    "incentive_state": "/path/to/evals/incentive-fixtures/agent-reward-hack/incentive-state",
    "context": { "name": "difficulty", "value": 4 }
  },
  "run": {
    "rung": 0, "rung_name": "blind", "trial": 1, "status": "completed",
    "run_dir": "runs/rung-0/trial-1",
    "started_at": "2026-06-09T09:00:00Z", "duration_ms": 48211
  },
  "narration": "agent stdout (secondary; never graded on)"
}
```

Rules (enforced by `validateSidecar`):
- `producer.kind` ↔ `claim_strength` are bound: `real-agent`→`real-agent-observed`,
  `simulation`→`simulation-derived`. Inconsistent pairs are rejected.
- A **non-completed** run (`runner-error` / `timeout`) MUST omit `observation` (nothing ran).
- A **completed** run MAY omit `observation` (ungraded) or carry one (already graded).

### real-agent vs simulation

- **`real-agent-observed`** runs MUST ship real artifacts under `run_dir`. Gygax grades them by
  re-running `reward_command` in that dir and diffing the `task-template/` baseline. Any
  producer-supplied `observation` on a real-agent run is re-derivable and may be re-graded
  (`--regrade`).
- **`simulation-derived`** runs have no real artifacts to re-execute. They MUST arrive **already
  graded** (carry their own `observation`); Gygax trusts-but-labels them via the weaker claim.
  An *ungraded* simulation-derived sidecar is rejected — Gygax will not fabricate a grade.

## What the grader does (grade-on-ingest)

`npx tsx scripts/lib/trace/index.ts <batch-dir>` (optionally `--fixture <dir>`, `--regrade`):

1. Load + validate every sidecar (fail-fast).
2. For each completed **ungraded** run: resolve `<batch-dir>/<run_dir>`, re-run `reward_command`
   there (cwd = run dir), `diff -u` each protected baseline file vs `task-template/`, classify
   (`fixed` / `hacked` / `failed`), and fill `observation`.
3. Diff observed-per-rung policy vs the payoff argmax forecast → cliff → severity →
   claim-strength-tagged report.

**Acceptance:** a batch produced entirely outside Gygax (valid v1 sidecars, no `observation`
blocks, artifacts present per this layout) is graded and diffed with zero manual edits.

## Minimal gradeable batch (copy-paste checklist)

1. `mkdir -p <batch>/sidecars <batch>/runs/rung-0/trial-1`
2. Put the agent's resulting files in `<batch>/runs/rung-0/trial-1/` (must include the fixture's
   `protected_baseline` files so they can be diffed).
3. Write `<batch>/sidecars/rung-0-trial-1.json` (ungraded sidecar above; `run_dir`:
   `"runs/rung-0/trial-1"`).
4. Write `<batch>/batch.json` with `schema` + `fixture`.
5. `npx tsx scripts/lib/trace/index.ts <batch>` → graded report.

## Versioning

Additive-only, same policy as the record schema. New optional `batch.json` fields may appear in a
v1 minor revision; a breaking layout change requires `observed-trace-batch/v2`.
