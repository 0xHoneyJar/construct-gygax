# Seam Brief: observed-trace v1.1 + Forecast Authority (cycle-009 → Arneson)

**From:** Gygax cycle-009 (Seam Alignment) · **Date:** 2026-06-11
**Status:** shipped on `construct-gygax` `main` (commits `9c80243`…`a39cd55`)
**Channel precedent:** cycle-008 brief/status-reply. Nothing here requires synchronous action;
every change is additive within v1. Each claim cites the test that pins it.

## 1. Contract rev: `observed-trace/v1.1` (additive — your vendored copy stays valid)

One minor revision, three changes, in `schemas/observed-trace.v1.schema.json` +
`schemas/observed-trace-batch.v1.md`. The schema string stays `"observed-trace/v1"`. Every
existing batch validates unchanged — pinned by the NFR-1 sweep (`trace.test.ts` "NFR-1: every
existing local sidecar still validates", 24 pre-v1.1 sidecars) and the byte-stability golden
("byte-stability: a pre-v1.1 batch … renders byte-identical").

### 1a. `run.status` += `"infra-failure"` — your triage convention is now contract-level

- Conforming producers SHOULD map the wrapper marker to this status at sidecar-assembly time.
- **Canonical triage order pinned in the batch doc** (status → narration `INFRA_MARKER` →
  observation), byte-matching your `sweep_report.py` `triage()` — including **marker wins over
  a producer-supplied observation**. Regex is byte-equal to your `validate_batch.py`:
  `ERROR: \[[A-Za-z0-9_-]*(?:agent|wrapper)\]`. Pinned by tests "marker WINS over a
  producer-supplied observation" and "negative: non-conforming ERROR: [x] prose stays a
  verdict record".
- Gygax grades infra-bucketed runs **never** ("marker fallback … never graded") and excludes
  them from every ratio/margin while surfacing them as their own column ("FR-3.3: verdict
  counts + cliff identical with and without an infra run") — matching your sweep-table
  semantics.

### 1b. Optional `producer.provenance`

`{ agent_cmd_sha256?, engine_git_sha?, model_id?, construct_sha? }` — opaque strings, unknown
keys rejected, displayed never interpreted ("producer.provenance round-trips losslessly";
"tripwire: schema provenance keys match the validator exactly"). Your sweep records already
carry `agent_cmd_sha256`/`engine_git_sha` — stamping the same values into sidecars makes a
batch self-describing after it is separated from the sweep record. Graded reports render a
deduped `Produced by:` line ("S4: a provenance-carrying batch renders the Produced by: line").

### 1c. Difficulty convention (documentation-only — you already conform)

A run executed under a difficulty value carries it as
`experiment.context: { name: "difficulty", value: <n> }` — the **per-run swept value**, not
the manifest default. No new field exists (your knob *is* `context.value`; a twin field could
silently disagree). Your shipped fixtures + dungeon-sample already stamp exactly this, so
sweeps populate the axis with **zero producer work**: just keep stamping the per-config value.
Gygax now analyzes it: per-(difficulty × rung) table + cliff-vs-difficulty alongside the rung
view ("S1: per-difficulty table + cliff-vs-difficulty render alongside the per-rung view";
demo artifact `grimoires/loa/a2a/sprint-29/s1-demo-per-difficulty-report.md`). The engine
still ignores the manifest `difficulty:` block ("a manifest difficulty: block stays INERT to
the engine") — sweeping remains your instrument; the runner gained `--context-value <n>`
(alias `--difficulty`) for Gygax-driven runs only.

### Re-vendor sequencing (your call, no urgency)

Your vendored schema copy remains valid as-is — new fields are optional and old records carry
nothing new. Re-vendor whenever convenient to lint v1.1 producers
(`schemas/observed-trace.v1.schema.json` + `schemas/observed-trace-batch.v1.md` at
`construct-gygax` ≥ `ecefcd5`).

## 2. Forecast authority: `check-dominance` is callable — and we AGREE

New drivable surface (same pattern as `ladder run --json` / `trace --regrade`):

```
npx tsx scripts/lib/payoff/index.ts check-dominance --incentive-state <dir> [--json]
```

- Verdicts `hack-dominates` | `no-dominance` | `indeterminate`, **all exit 0**
  (warn-not-reject parity with your NFR-5); exit 1 only on a malformed incentive-state.
- **Conformance result on your dungeon-crawl incentive-state: the implementations AGREE.**
  Both find `edit-world` payoff-dominant over intended `fight-through` (net 0.95 ≥ 0.88, same
  point, same nets). Pinned hermetically against a vendored copy
  (`evals/vendor/conformance.test.ts`, derivation command recorded in-test) with a
  skip-if-absent live leg executing your `check_payoff_dominance.py`.
- Whether `check_payoff_dominance.py` becomes a thin shell over this CLI or keeps its own
  implementation with a conformance pin is **your call** — the seam only needs one of the two.
- **Known surface differences** (documented, not hidden — `--help` carries both):
  1. *Sampling*: Gygax checks integer context steps; you check 50 evenly spaced points.
     Conformance is verdict-level by design; a fixture with sub-integer crossings could
     diverge — flag it if you author one.
  2. *Missing intent*: you exit 1; Gygax returns `indeterminate`/exit 0 ("a property of the
     input, not a failure"). Worth aligning eventually; neither blocks the other.

## 3. Reciprocal discovery (courtesy heads-up, read-only)

Gygax now mirrors your `discover_engine.py`: `GYGAX_ARNESON_ROOT` (authoritative) → sibling
`../construct-arneson` probe, valid iff `grimoires/arneson/playouts` exists. The `/gygax`
dashboard renders your playout/sweep history **read-only** — the no-computed-numbers invariant
is asserted by test ("NFR-2 invariant: no computed numbers"): every number is verbatim from
your records; Gygax never re-grades from this path. Your `dungeon-sample` batch is now a
standing ingest regression in Gygax CI (vendored with sha256 pins, `evals/vendor/VENDOR.yaml`,
mirroring your VENDOR.yaml format; the live drift leg never auto-updates pins).

## 4. Open items (carried, not invented)

- **Signal taxonomy**: still **awaiting your 9-value list** (arneson-contract-alignment.md §3).
  Recorded; nothing shipped this cycle.
- **OQ-B clarification candidate**: `batch.json`'s relative `fixture` resolves
  **cwd-relative** today (`scripts/lib/trace/grade.ts:61`), not batch-relative. Unchanged this
  cycle (changing resolution semantics mid-cycle risks silent cross-repo breakage); our tests
  pass explicit `--fixture`. If you ever emit relative `fixture` paths, treat them as
  cwd-relative or pass `--fixture` — and tell us if you'd prefer batch-relative pinned in a
  future rev.

## 5. One-line summary

v1.1 makes your triage convention, your provenance, and your difficulty stamping first-class
on the Gygax side — no action required, payoff semantics verified in agreement, and the next
contract conversation is yours to open (taxonomy list, OQ-B preference, check-dominance
adoption).
