# cycle-012 — The Revealed-Strategy Lens (the Reality Plane for the strategy axis)

**Date:** 2026-06-18 · **Branch:** feat/cycle-012-revealed-strategy-lens · **Global sprints:** 35–37
**Builds on:** the observed-trace seam (cycle-007); Cabal Decision Point Map (cabal SKILL Step 2.7d).
**Design:** `grimoires/gygax/designs/revealed-strategy-lens.md` · **PRD/SDD:** `grimoires/loa/{prd,sdd}.md`

## What shipped

A new analysis path on the trace seam: a **decision-trace** corpus → **revealed preference** → reconcile
vs the forecast Decision Point Map and an optional candidate policy → claim-tagged **Revealed Strategy**
report, surfaced as `/cabal --observed --strategy`. It is the empirical complement to Cabal's
*forecast-only* dominant/false-choice calls — the **Reality Plane for the decision axis**
(evolution-roadmap §4), and the pick-frequency the intransitive engine (C-008) will want.

- **FR-1** — `decision-trace/v1` schema (`scripts/lib/trace/decision.ts`, `schemas/decision-trace.v1.schema.json`)
  reusing `sidecar.ts`'s epistemic primitives (claim-strength, the producer-bound rule) + `revealed.ts`
  extractor (conditional, segmented pick-frequencies; pairwise revealed ordering).
- **FR-2** — `reconcile.ts` (confirmed / missed-false-choice / over-called-dominant / policy-divergence /
  no-divergence) adopting `diff.ts`'s small-N discipline (`withinNoise`) + `strategy-report.ts`.
- **FR-3** — `strategy.ts` CLI + the `/cabal --observed --strategy` section in `skills/cabal/SKILL.md`.
- **FR-4** — the PTCG golden fixture (`scripts/lib/trace/__fixtures__/ptcg-revealed/`) — reproduces,
  byte-stable: **ATTACH revealed #1 (100%)** · **the turn is a false choice in practice the forecast
  missed** · **v1.1 mis-ranks ATTACH 6→1**. All findings claim-tagged `[observed]`.

## Grounding corrections (SDD §1.2)

- **C-1** — the decision-trace is a NEW `decision-trace/v1` *sibling* schema: the reward-hack
  `observed-trace/v1` (rungs, fixed/hacked/failed, file diffs) does not fit a `{offered, chosen}` record.
  It reuses the epistemic primitives, not the interface.
- **C-2** — the reconciler is new, *adopting* `diff.ts`'s small-N discipline (`withinNoise`,
  null-when-unobserved, forecast claim tag), not its rung/argmax code.

## Provenance

Back-formed from the **PTCG-ABC** competition run (`~/ptcg-agent`), where this lens — built by hand —
found the policy fix that two live submissions had failed to surface. That run is the acceptance fixture.

## Verification

Full `npm test` green (evals 781 passed, 0 failed); the 5 trace test files pass
(`decision`/`revealed`/`reconcile`/`strategy`/`trace`); zero new runtime deps; byte-deterministic
report + golden. **Branch only — no PR opened (awaiting operator go-ahead).**
