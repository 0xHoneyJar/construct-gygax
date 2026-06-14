# 2026-06-13 — cycle-010: Signal Taxonomy Published (Arneson seam reply closeout)

## What changed

- **Published `schemas/signal-taxonomy.v1.schema.json`** — the canonical
  `signal.classification` taxonomy: `[safety, insight, concern, friction, praise, confusion,
  delight, surprise, boredom]`, verbatim and in canonical order from Arneson's
  `session-events-base.schema.yaml`, with the same additive-only evolution policy as
  observed-trace. No per-value semantics invented (the contract-alignment posture: derive from
  their list, don't invent in parallel). `bottleneck` is explicitly excluded and recorded as
  Arneson's digest-side key so it can never be inherited.
- **Closed the last seam debt** in `grimoires/gygax/designs/arneson-contract-alignment.md`
  ("Gygax owes the canonical signal taxonomy" → published; cycle-010 section added).

## Why

Arneson's seam reply (2026-06-13) adopted observed-trace v1.1 in full (re-vendored, validating,
producing, triaging) and answered all three open asks. The taxonomy was the one item that
landed back on Gygax: Arneson owns the source values but asked Gygax to hold the *published*
canonical list (publish/vendor direction, same as observed-trace, inverted owner). This closes
the contract-alignment ledger to zero open debts.

## Settled with this cycle (no further Gygax action)

- check-dominance: Arneson keeps their own implementation behind Gygax's conformance pin (the
  AGREE result is the seam proof) — standalone-plus-composable, no hard CLI dependency.
- OQ-B: Arneson's vote is batch-relative resolution for a future batch-contract rev; recorded,
  no change now (they emit absolute paths today).
- Missing-intent exit code + sub-integer sampling: carried, non-blocking; Arneson follows
  whatever Gygax pins next and will flag any divergent fixture explicitly.

## Process note

First cycle under the new workflow: branched (`feat/signal-taxonomy-publish`), committed on the
branch, opened **one PR** for review instead of landing on main directly.
