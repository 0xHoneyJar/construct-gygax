# Design: Engine-Tuning Support — Parametric Balance & Tuning-Knob Surfacing

**Status:** Proposed (next cycle) · **Date:** 2026-06-08 · **Tracks:** [construct-gygax#14](https://github.com/0xHoneyJar/construct-gygax/issues/14)
**Origin:** dogfooding gygax on `project-purupuru/carmack-engine` (a content-agnostic grid raycaster *engine*)

## Mission

Make gygax able to balance **engines**, not just **games**. A game's balance lives in
fixed stat blocks and progression tables; an engine's balance lives in **replaceable
example content** plus **parameters/formulas a developer tunes for their game**. The
analysis surface for an engine is the *tuning knobs*, not a stat block. This is the same
core skill — "find where the curves break" — applied to a tuning surface instead of fixed
content. The leverage: one good tuning pass on an engine helps *every* game built on it.

This stays in lane with the [v4 direction](../../../memory): gygax remains a **game-systems
analyst**. Out of scope (engine *implementation*): DOD/cache-locality, ECS internals,
graphics-pipeline/PSO abstraction, profiling, data-type sizing. Those are an engine
architect's and a profiler's job, not a design analyst's.

## The worked example that motivates this

From the carmack-engine `/augury` pass (`balance-reports/2026-06-07-combat-depth-scaling.md`):

- Static player ATK (`5`) vs `enemyDEF = floor((depth-9)/4)` + brute `HP×1.5`.
- At depth 20 a single brute costs **~114 HP** to melee — more than the player's 100 max.
- Moderate-lethality intent breaks past ~depth 12.

To produce that, the analyst had to **manually attune fixed sample values per depth** and
reason across them by hand. gygax could not:
1. take the **scaling formula** and solve for the crossover depth (TTK > 8, incoming > heal);
2. tell the dev **which knob is the lever** ("player ATK is a flat knob you must scale;
   enemy DEF is the dominant TTK multiplier");
3. distinguish **"this is an engine default you'll replace"** from **"this is a structural
   property of the engine."**

Those three gaps are capabilities (1)–(3) below.

## Conceptual frame: difficulty testing vs progression testing

John Hopson (*The Secret Science of Games*, 2023, ch. 23 "Balancing Destiny") splits all
balance work into two complementary methods, and they map exactly onto this mission:

| Hopson's method | What it measures | gygax equivalent |
|-----------------|------------------|------------------|
| **Difficulty testing** (reductionist) | hold the player at a **fixed, known power level**, sweep the content, benchmark each encounter in isolation, **look for spikes** | the carmack `/augury` pass + capability (1): hold player power fixed, sweep depth, find the crossover/catastrophe |
| **Progression testing** (holistic) | let the player advance **naturally**, then compare their *actual* power curve against the **designer-predicted** curve | the relic/boost economy attune — the balance report's "load-bearing unknown" |

His conclusion: *"Had we only done one method, the game would have been broken."* That is
precisely why every INTENT-CONFLICT in the carmack balance report is tagged **conditional on
relic income** — we ran difficulty testing but never ran progression testing. The two are not
separate tasks; they are the two axes of one analysis. This frame justifies sequencing the
parametric sweep (1)/(2) *and* the relic-economy attune together, and it generalizes:
gygax's `[INTENT-CONFLICT]` tagging is an automation of Hopson's designer-predicted-vs-actual
gap (his ch. 1 intent×reality matrix). His "looking for spikes" — ideal curves trend smoothly,
flag drastic jumps — is exactly the crossover/spike primitive in capability (1); his Telthor
locked-room skill-check spike is the same failure shape as the depth-20 brute catastrophe.

See `../references/secret-science-of-games.md` for the full reference note.

## The missing primitive

The whole data model assumes *tuned content*: `stats` carry a fixed `range`,
`progression_table` is discrete `level → value` rows, and augury computes metrics **at
breakpoints**. Three of the five capabilities below fall out of adding one primitive:

> **A stat or curve expressed as a function of a progression variable** (depth / level /
> wave), rather than a fixed value or a discrete table.

Add that, and parametric crossover (1) and tuning-knob surfacing (2) follow directly.

This distinction is not new — it sits in the design-language canon. Doug Church's *Formal
Abstract Design Tools* (1999) draws exactly this line: a *"+2 Damage Attack Sword"* is a
**fixed** formal element, whereas *"an incremental system that makes the player more powerful
based on their combat style"* is an **abstract** one, *"because it is not fixed."* The `+2
sword` is `engine-default` concrete content; the scaling *system* is the parametric tuning
surface this design targets. We are giving gygax a way to analyze the abstract/systemic side,
not just the fixed side. (See `../references/formal-design-language.md`.)

## Capabilities

| # | Capability | Lands in | Cost | Leverage |
|---|-----------|----------|------|----------|
| 3 | `engine-default` vs `structural` tagging | schema field + `attune` (esp. F1 `attune-codelevel.ts`) + augury *framing* | Low | High — reframes findings "broken" → "yours to tune" |
| 1 | Parametric crossover analysis | new `scripts/lib/parametric/` evaluator; schema `model:` block; augury `--sweep` mode | Med | High — the core ask |
| 2 | Tuning-knob surfacing | builds on (1): perturb each param, rank by Δmetric | Low (given 1) | High |
| 5 | Onboarding / initial-choices analysis | extends `cognitive-load` + `action-economy` layers | Med | Med |
| 4 | Feedback-loop topology (Machinations-style) | extends `resource-economy` layer; new graph representation | High | High but heaviest |

### (3) `engine-default` vs `structural` tagging — *do first, cheap*

Add a `tunability` field to entities (and optionally to individual stat fields):

- `engine-default` — sample/example content an adopter is expected to replace
  (e.g. `DEFAULT_STATS`, the demo level generator's stat curves).
- `structural` — an invariant property of the engine itself (e.g. `dmg = max(1, atk - def)`,
  the min-1 damage floor, grid-locked movement).

Effects:
- **`attune`** sets it — and the code-grounded F1 path (`attune-codelevel.ts`) can *infer*
  it: a value read from a `DEFAULT_*`/config const → `engine-default`; a formula hardcoded in
  the core sim loop → `structural`.
- **augury** *frames findings by it*: a problem in `engine-default` content reads
  "this is yours to tune — here's the lever," not "this is broken." A problem in
  `structural` math reads as a genuine engine constraint.

This is the highest framing-leverage item for the smallest code. It also makes every other
capability's output honest about what the developer can actually change.

### (1) Parametric crossover analysis — *the core ask*

Add an optional `model:` block to `stats`/`progression` entities expressing a value as a
function of a declared progression variable, **alongside** the existing discrete
`progression_table` (no migration; discrete tables keep working untouched). Sketch:

```yaml
# stats/enemy-defense.yaml
id: enemy-defense
type: stats
tunability: engine-default        # capability (3)
model:
  variable: depth                 # the progression axis
  domain: { min: 1, max: 20 }     # sweep range
  formula: "floor((depth - 9) / 4)"
  notes: "Dominant TTK multiplier; flat below depth 9."
```

A new evaluator (`scripts/lib/parametric/`) then:
- **sweeps** every `model:` formula densely across its declared `domain`;
- composes derived metrics (TTK = `ceil(hp / max(1, atk - def))`, incoming-per-kill,
  heal-value ratio) at each step;
- detects **first-crossing** of declared thresholds (`TTK > 8`, `incoming-per-kill > maxHP`,
  `heal < 3 kills`) and reports the crossover point on the axis.

augury gains a `--sweep` / parametric mode that consumes `model:` entities and emits a
crossover table instead of breakpoint values.

**Design fork — resolved: sweep, not CAS.** True symbolic solving over `floor` / `min` /
clamp is brittle (these break clean algebra). A dense numeric sweep + first-crossing
detection handles `floor`/`min`/clamp natively and gets ~all the value. We build
sweep-based and *call* it crossover analysis. (Revisit only if a real need for closed-form
solutions appears.)

**Formula safety:** `formula` strings are evaluated in a restricted arithmetic context
(whitelisted ops + `floor`/`ceil`/`min`/`max`/`abs`, the declared variable only) — never
`eval`. Reuse the sandbox posture from `scripts/lib/codegrounding/`.

### (2) Tuning-knob surfacing — *almost free given (1)*

Once a parametric model exists, perform **local sensitivity analysis**: perturb each tunable
parameter, re-sweep, measure the change in the key metrics, and rank by leverage. Output the
dev-facing knob report:

> *"Player ATK is the dominant lever: +1 ATK / 5 floors moves the d20 brute TTK from 20 → 8.
> Enemy DEF is the secondary lever (cap at 1 → TTK 13). Heal is a weak lever above d15."*

This is exactly what an engine adopter needs: which parameters matter, in what order, and
what each trades off. Restrict perturbation to `engine-default`/tunable params (capability 3)
so the report never suggests changing `structural` invariants.

### (5) Onboarding / initial-choices analysis — *self-contained follow-up*

Extend `cognitive-load` + `action-economy` to evaluate the **opening decision space**: is it
calibrated for *agency without paralysis*? Encode the "Wingspan" heuristic (deal 10, keep 5 —
meaningful agency without full-draft overload) as a tunable threshold. Useful for both games
and the DX of an engine's starter template.

### (4) Feedback-loop topology (Machinations-style) — *its own cycle*

Extend the `resource-economy` layer with first-class **loop topology**: sources, drains,
converters, gates, and the positive/negative loops between them, plus a visualization. F2
(`--simulate`) can already generate quantitative data; the *loop structure itself* isn't
modeled or surfaced. This is the structure that drives emergent dynamics, and an engine
should make these invisible structures tangible for the designers building on it. Genuine
modeling effort — sequence it as a standalone cycle, not part of the MVP.

## Relationship to existing features

- (1)–(3) **extend** the code-grounded paths F1 (`attune-codelevel.ts`) and F2
  (`augury-simulate.ts`) from *concrete-value* analysis toward *tuning-surface* analysis.
  They do not replace them.
- (4)–(5) **deepen** existing layers (`resource-economy`, `action-economy`, `cognitive-load`)
  rather than adding new domains.

## Phasing for the cycle

**MVP (Phase 1): 3 → 1 → 2.** This trio *is* the carmack worked example end-to-end and is
the smallest thing that closes the dogfooding gap.
1. (3) `tunability` schema field + attune wiring + augury framing.
2. (1) `model:` block + `scripts/lib/parametric/` sweep+crossover evaluator + augury `--sweep`.
3. (2) sensitivity sweep + knob report (rides on 1).

**Phase 2:** (5) onboarding/initial-choices analysis.

**Phase 3:** (4) Machinations feedback-loop topology.

## Grounding: the eval fixture

Accept the offered carmack-engine artifacts as a regression fixture under
`evals/fixtures/` (e.g. `carmack-engine-depth-scaling/`):
- the game-state YAML (with `model:` blocks + `tunability` tags), and
- the `/augury` balance report as expected output.

The parametric capability must reproduce the real findings from the formulas alone:
- brute TTK crosses 8 at **~depth 14**;
- incoming-per-brute-kill exceeds player maxHP at **depth 20** (the 114 > 100 catastrophe);
- heal value drops below 3 grunt-kills at **~depth 15**.

This keeps the whole feature grounded in a real engine instead of synthetic numbers, and
turns the dogfooding finding into a permanent test.

## Open questions

1. **Schema scope of `tunability`** — entity-level only, or also per-field (a single entity
   mixing structural + default values)? Lean entity-level for the MVP; add field-level only if
   a real case needs it.
2. **Multi-variable models** — carmack is single-axis (depth). Do we need 2-D sweeps
   (depth × party-size) in the MVP? Lean **no** — single progression variable first.
3. **Where does the knob report live** — inline in the augury balance report, or a dedicated
   `tuning-report` artifact? Lean inline for the MVP, promote to its own artifact if it grows.

## Pointers

- Issue: `github.com/0xHoneyJar/construct-gygax/issues/14`
- Downstream provenance: `project-purupuru/carmack-engine` →
  `grimoires/loa/proposals/gygax-for-engine-tuning.md`,
  `grimoires/gygax/balance-reports/2026-06-07-combat-depth-scaling.md`
- Augury layers: `skills/augury/SKILL.md` (resource-economy, action-economy, cognitive-load)
- Code-grounded paths: `scripts/lib/codegrounding/attune-codelevel.ts` (F1),
  `scripts/lib/codegrounding/augury-simulate.ts` (F2)
- Schema: `skills/attune/resources/game-state-schema.md` (stats, progression)
