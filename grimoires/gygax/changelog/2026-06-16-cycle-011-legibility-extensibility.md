# 2026-06-16 — cycle-011: Analyst Legibility + Extensibility

Three self-contained features, each extending a shipped baseline with **zero new runtime
dependencies** and **zero Arneson coupling** (consume/emit files only; no imports of Arneson
internals). Sequenced FR-2 → FR-1 → FR-3.

## What changed

- **FR-2 — Custom Cabal archetypes (sprint 32, global 32).** Designers can now extend the fixed
  9-archetype roster with their own player archetypes in `grimoires/gygax/archetypes/*.yaml`.
  - `scripts/lib/archetypes/schema.yaml` — an authored structural schema, derived *verbatim* from the
    built-ins (enum sets are the complete distinct values extracted across all 9; built-ins are
    ground truth — widen the schema, never edit a built-in).
  - `scripts/lib/archetypes/validate.ts` — a generic, data-driven validator (`validateArchetype`,
    `loadAndMerge`) + CLI. **Reject-loud on id collision**; invalid files are **excluded and
    reported**, never silently dropped. YAML via `yq` (the repo convention) — no in-process YAML dep.
  - Worked example `grimoires/gygax/archetypes/speedrunner.yaml` ("The Speedrunner"). `/cabal` merges
    valid user archetypes beside built-ins (`skills/cabal/SKILL.md` Step 1).
  - **Grounding correction:** the brief referenced an "existing archetype-schema.yaml" — none existed
    for the Cabal archetypes (the only such file is an unrelated Loa eval task). This cycle authored it.

- **FR-1 — Augury visualizations (sprint 33, global 33).** The parametric sweep report now reads at a
  glance.
  - `scripts/lib/parametric/svg.ts` — deterministic, hand-rolled inline-SVG sparklines (fixed
    viewBox/strokes/2-decimal precision; optional red dashed threshold-crossing markers).
  - `scripts/lib/parametric/mermaid.ts` — an always-emitted fenced Mermaid `graph LR` structure
    diagram (the renderer-independent fallback; HTML-escaped labels so `>`/`<` never break the fence).
  - Both wired **additively** into `report.ts` — the sweep math is untouched.
  - New byte-exact renderer golden `evals/fixtures/parametric-depth-scaling/expected/sweep-render.md`,
    distinct from (and leaving intact) the hand-derived `sweep-report.md` derivation proof.
  - `parametric.test.ts` gains SVG/Mermaid presence + **double-run byte-equality** + golden compare +
    degenerate-no-throw assertions.

- **FR-3 — `/gygax check` (sprint 34, global 34).** A fast, self-contained diagnostic that reports the
  analyst's own health — building designer trust in every other finding.
  - `scripts/lib/check/check.ts` — a pure orchestrator running 4 curated sub-checks in fixed order
    (`golden-integrity`, `expected-findings`, `archetype-schema`, `game-state-sanity`), each isolated
    so one failure never aborts the others; deterministic plain-text summary; exit 0=PASS / 1=FAIL.
    It **reuses** the FR-1 golden and the FR-2 validator as its backbone — not the full
    `evals/harness.sh`.
  - Wired as the optional `check` subcommand of `/gygax` (`commands/gygax.md` + `skills/gygax-status/`
    Step 0). Plain `/gygax` is unchanged. **`.claude/` never touched.**

## Why

Gygax is trusted in proportion to how legible and extensible its analysis is. The sweep math lived in
text-only tables; the archetype panel was closed; and the analyst's own health was opaque. These three
steps make the math *readable*, the panel *extensible*, and the analyst's health *verifiable* — without
taking on a single new runtime dependency or any Arneson code coupling (the rejected `@loa/math` /
shared-identity-base items would have violated standalone-plus-composable; the `/voice` Arneson loop
stays a loose artifact handoff, deferred).

## Settled with this cycle

- **Determinism is enforced, not hoped for:** the FR-1 visuals carry a double-run byte-equality
  assertion on top of the golden lock — catching float/order drift the golden alone would miss.
- **`/gygax check` is hard-bound to 4 curated sub-checks** (FR-3.1) — the full harness stays
  `evals/harness.sh`. The no-Arneson invariant is a test (`check.test.ts`), keeping check.ts at 4.
- Full `npm test` + `bash evals/harness.sh --structural`: **781 passed, 0 failed**. `package.json`
  `dependencies` unchanged.

## Process note

Built on a single cycle branch (`feat/cycle-011-legibility-extensibility`), one commit per sprint, for
**one end-of-cycle PR** — opened only on explicit operator go-ahead, never with auto-attached reviewers
or automation.
