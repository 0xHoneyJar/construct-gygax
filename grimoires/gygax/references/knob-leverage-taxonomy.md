# Reference: Knob-Leverage Taxonomy — Which Knobs Actually Matter

Attributed synthesis for `/augury` tuning-knob surfacing (FR-2). Concepts paraphrased in our own
words with citations to the design canon already in this grimoire. The question this answers:
**when tuning a parametric surface, which knobs are load-bearing — and which only look like they are?**

**Grounding sources (in this grimoire):**
- `secret-science-of-games.md` — Hopson 2023 (difficulty-vs-progression, spikes, epistemics).
- `formal-design-language.md` — Church FADT (fixed-vs-abstract, telegraphing) + MDA (second-order,
  reverse-arrow onboarding).
- `design-failure-postmortem.md` — failure archetypes (scaling, MAD, economic, degenerate).
- `../designs/engine-tuning-support.md` — the parametric `model:` surface this taxonomy ranks over.
- `game-balance-cost-curves.md` — Schreiber & Romero 2021 (the **numeric half**: cost curves,
  above-curve asymmetry, control-one-variable, god/dump stats). The detectors below are the
  *structural* half; the cost curve is what they measure divergence *against*.

---

## The core distinction

> **Mechanical leverage** = how hard a knob pushes the metric (local Δ per unit change).
> **Structural leverage** = whether the *system* amplifies, dampens, or gates that push.

FR-2's MVP computes mechanical leverage directly: perturb each tunable param, re-sweep, rank by
Δmetric. That is necessary and **insufficient**. The old masters are, almost entirely, a manual for
spotting *structural* leverage — the amplifiers a one-step perturbation can't see. A knob with small
local Δ that sits on a positive feedback loop, or gates onboarding, or is the lone multiplier in an
additive field, **outranks** a knob with large local Δ that the system flattens.

> **The measuring stick is the cost curve (Schreiber).** Mechanical leverage isn't measured in a
> vacuum — it's measured as **divergence from the cost/power curve**: a knob's benefit per unit
> cost relative to where the curve says it should sit (`game-balance-cost-curves.md`). Two
> consequences carry through every detector below: (1) **above-curve beats below-curve** — a
> too-strong knob "destroys the balance of the entire game, not just itself," so above-curve
> divergence is always higher-priority than below-curve; (2) FR-2's one-knob perturbation *is*
> Schreiber's "control one variable at a time" — exact locally, **blind to interactions**, which is
> the whole reason the structural detectors (L2, L5, L7) exist.

The taxonomy below is the set of structural-leverage detectors. Each is computable (or
heuristically flaggable) from game-state + the FR-1 sweep, cites a master, and says whether it
marks a knob as **tunable** (surface it) or **structural** (never propose changing it — FR-3).

---

## The leverage kinds

### L1 — Form leverage: multiplicative/compounding beats additive/flat
- **What:** how the knob *enters* the metric. A multiplier, exponent, or term that grows with the
  progression variable compounds; a flat addend decays in relative terms as the curve scales.
- **Why it matters:** a static bonus in a multiplicative system is the canonical trap — negligible
  past the opening (the Toughness Feat: "+3 HP, irrelevant after level 1"). The carmack lesson is
  pure L1: player ATK is a flat additive knob; `enemyDEF = floor((depth-9)/4)` feeds a
  *multiplicative* TTK, so DEF is the dominant lever even though both are single integers.
- **Detection signal:** parse the `model:` formula — classify each knob's position as
  `multiplicative | exponential | progression-coupled | additive-flat`. Flag flat knobs whose
  relative contribution falls below a threshold across the swept domain.
- **Catch-it-early:** this is readable from the *formula shape alone*, before any playtest.
- **Source:** Church fixed-vs-abstract (`formal-design-language.md:42-47`);
  `design-failure-postmortem.md:7-13` (Scaling Failure / Toughness); Schreiber (cost curves).
- **Marks:** usually **tunable** — but a flat knob in a multiplicative field is often the thing the
  adopter *must scale* ("player ATK is a flat knob you must scale").

### L2 — Loop leverage: position in a feedback loop
- **What:** is the knob a source / drain / converter / gate inside a cycle? A **positive** loop
  (output feeds its own input) compounds any perturbation; a **negative** loop dampens it.
- **Why it matters:** local sensitivity sees one step; a positive loop multiplies that step over
  many. The knob *is* the loop. This is why the carmack curve is tagged "conditional on relic
  income" — the unmodeled relic/boost economy is a progression loop that dominates the whole
  analysis (R1). MDA's second-order design: dynamics emerge from loop structure, not from any
  single rule (the "camping from fixed respawns" example).
- **Why it matters (sharpened):** the sign and *timing* of the loop decide everything —
  **positive** feedback amplifies (snowball) and **early positive feedback is far more dangerous than
  late** (it compounds over more steps); **negative** feedback dampens (catch-up) and bites
  **late**. Positive loops usually key off **absolute** power; negative off **relative** power. A
  knob on an early positive loop is a runaway-leader bomb even at tiny local Δ.
- **Detection signal:** requires loop topology (FR-4 / proposed C-009). **Until then:** heuristic
  flag — knobs touching `resource-economy` sources/drains, or any param whose metric appears in its
  own update, get a `loop-suspected` tag + confidence caveat; classify sign (does perturbing it
  widen or narrow a leader's gap?) and timing (early vs late).
- **Source:** Machinations / MDA second-order (`formal-design-language.md:68-75`); the rigorous loop
  theory in `progression-and-feedback-loops.md` (positive/negative, early/late, absolute/relative);
  Hopson progression testing (`secret-science-of-games.md:40-47`).
- **Marks:** **tunable**, high-priority; loop knobs are systematically under-ranked by pure sensitivity.

### L3 — Gate leverage: controls access, onboarding, or progression
- **What:** the knob sits on a precondition that unlocks downstream content, or shapes the opening
  decision space.
- **Why it matters:** low *local* Δ, enormous *downstream* reach — it decides whether the player
  reaches the rest of the system at all. MDA's reverse-arrow: the player meets Aesthetics first;
  the opening must land before they understand the mechanics. The Wingspan valve (deal 10, keep 5)
  is a gate knob — agency without paralysis. Degenerate metagames are the failure: a knob that lets
  a strategy resolve "before the opponent can respond."
- **Detection signal:** knob on an unlock threshold, a starting-choice count/breadth, or a
  precondition in `mechanics`. Cross-reference `cognitive-load` for the opening decision space.
- **Source:** MDA reverse-arrow (`formal-design-language.md:61-66`); Wingspan/onboarding
  (`../designs/engine-tuning-support.md:160-165`); degenerate archetype
  (`design-failure-postmortem.md:24-29`).
- **Marks:** **tunable**, high-priority; FR-5 territory but flag it now.

### L4 — Crossover-mover vs curve-shifter *(the most FR-1-native, most computable)*
- **What:** when you perturb the knob, does the **crossover point move along the axis** (the depth
  where TTK>8 lands), or does the whole curve just **translate uniformly**?
- **Why it matters:** Hopson's difficulty testing is about *where it breaks*, not the average. A
  knob that moves the break-point is the real lever; a knob that shifts the curve uniformly may
  only rescale difficulty without fixing the spike. This separates "fixes the problem" from "moves
  the problem."
- **Detection signal:** **directly computable from the FR-1 sweep** — perturb the knob, recompute
  the crossing/spike location, and report Δ(crossover-axis) alongside Δ(metric-mean). Rank
  crossover-movers above uniform-shifters.
- **Source:** Hopson "look for spikes" (`secret-science-of-games.md:37-39`); FR-1 sweep
  (`../designs/engine-tuning-support.md:109-135`).
- **Marks:** **tunable.** This is the single best mechanical-plus-structural signal and should be a
  first-class column in the knob report.

### L5 — Coupling / MAD leverage: shared-budget knobs
- **What:** the knob draws from a budget shared across several needs, so raising it costs elsewhere.
- **Why it matters:** stat-budget insufficiency makes core function unreachable — the Monk problem
  (needs STR+DEX+CON+WIS at once → mediocre at all). A knob that looks free in isolation is
  expensive in the budget it shares.
- **Detection signal:** knob is one allocation of a declared shared pool (point-buy, stat budget,
  a `resources` cap feeding multiple `stats`). Flag when the budget can't satisfy all dependents at
  the tuned value.
- **Source:** `design-failure-postmortem.md:9, 44` (MAD Dependency).
- **Marks:** **tunable**, but report the tradeoff, never the knob in isolation.

### L6 — Saturation / clamp leverage: floors, caps, and where leverage dies
- **What:** the knob interacts with a `max(1, …)` floor, a `min`/cap, or a clamp — its marginal
  leverage is nonlinear and **vanishes past the clamp**.
- **Why it matters:** sensitivity must be measured *in range*, not globally — a knob already below a
  floor or above a cap has zero marginal effect. Clamps are also where **structural invariants**
  live: the carmack min-1 damage floor (`dmg = max(1, atk - def)`) is `structural`, not a knob.
- **Detection signal:** knob appears inside `min`/`max`/clamp in the formula; evaluate Δ only over
  the sub-domain where it's unclamped; if it's the clamp itself, tag `structural`.
- **Source:** carmack min-1 floor + structural example (`../designs/engine-tuning-support.md:95-96,
  143-145`).
- **Marks:** the clamp itself → **structural** (never propose); knobs near it → tunable but report
  the saturation boundary.

### L7 — God/dump leverage: the false-choice signature *(Gygax-core)*
- **What:** a knob whose **optimal value is invariant across the domain** — always pinned to a
  bound (max it / zero it) no matter where you are on the curve. A **god** knob (always maxed,
  mandatory) or a **dump** knob (always ignored, useless).
- **Why it matters:** both signal a **non-meaningful decision** — the parametric signature of a
  *false choice*, which is one of Gygax's named targets ("options that look different but resolve
  identically"). A god/dump knob isn't a tuning lever; it's a **balance bug**: the design presents a
  choice that has a single correct answer. The fix is rarely "retune the number" — it's **good
  coupling** (give a dump knob a second job, à la Strength → carry-capacity + door-pushing), the
  inverse of L5's failure.
- **Detection signal:** sweep the knob's *optimal setting* across the domain (or check sensitivity
  sign/magnitude); if the best value never moves off a bound, flag god (upper) or dump (lower).
  Cross-check: if mechanical Δ ≈ 0 everywhere → dump; if Δ dominates everywhere → god.
- **Source:** Schreiber & Romero god/dump stats (`game-balance-cost-curves.md`, Ch.9); Gygax
  "false choices" mandate (CLAUDE.md); degenerate archetype (`design-failure-postmortem.md:24-29`).
- **Marks:** **report as a balance finding, not a knob.** A god/dump knob should be surfaced as
  "this isn't a meaningful choice — fix the design (couple it), don't tune it."

---

## Cross-cutting: legibility and epistemics

**Telegraph check (Church perceivable consequences).** A knob can be mechanically fine and still
produce an *untelegraphed* spike — a sudden lethal jump the player can't form an intention model
for (the un-telegraphed sudden-death anti-pattern; same shape as the carmack depth-20 catastrophe).
When K3 spike-detection fires, frame it as a **legibility** finding ("is this jump telegraphed?"),
not only a number. (`formal-design-language.md:33-52`; `secret-science-of-games.md:50-52`.)

**Epistemic discipline (Hopson ch.21-22).** Leverage rankings are **model-derived**, not playtested
truth. Attach confidence; never present a forecast as a fact; temper conclusions hard for genuinely
novel mechanics (no prior behavior to reason from). Mechanical Δ is exact for the model; structural
tags (especially L2 loop-suspected pre-FR-4) are heuristic — say so. (`secret-science-of-games.md:59-73`.)

---

## How FR-2 consumes this

1. Compute **mechanical leverage** as **divergence from the cost curve** (Δmetric per perturbation,
   in-range per L6) — the base rank; above-curve divergence outranks below-curve (Schreiber).
2. Run **L1–L7 detectors** over each tunable knob; attach structural-leverage tags + confidence.
3. **Promote** any low-sensitivity knob carrying high structural leverage, with an explicit reason
   line — *"low local Δ, but it's the only multiplier (L1) and sits on a suspected positive loop
   (L2): scale this first."* Never silently bury it under raw sensitivity.
4. **Never** propose a `structural`/clamp invariant as a knob (FR-3 + L6).
5. **Escalate L7 god/dump hits to balance findings, not knobs** — "this isn't a meaningful choice;
   fix the design (couple it), don't tune it."
6. Report each surfaced knob as: **off-curve divergence (sign) · structural tags · crossover-shift
   (L4) · one-line "why it matters."**

This is the bridge from "compute Δmetric" to "understand leverage" — and the explicit hand-off to
FR-4 (loop topology makes L2 exact) and FR-5 (onboarding makes L3 exact).

---

## Where this feeds

- `/augury` FR-2 knob surfacing — primary consumer (mechanical + structural ranking).
- `game-balance-cost-curves.md` — the numeric backbone (cost curve, above-curve asymmetry,
  control-one-variable, god/dump → L7).
- `../designs/engine-tuning-support.md` — capability (2); the L4 crossover-mover signal is
  sweep-native and should be built with FR-1.
- FR-4 (feedback-loop topology) — turns L2 from heuristic into exact.
- FR-5 (onboarding) — turns L3 from heuristic into exact.
- `/lore` — L1/L5/L7/telegraph map onto existing failure-archetype + false-choice heuristics.
- `../designs/gygax-evolution-roadmap.md` — this taxonomy is the **structural-leverage layer cutting
  across all four balance types**; intransitive adds *matchup leverage* (frequency-shifting),
  stochastic adds *variance leverage* (swing-relative-to-decision). See the roadmap for the full map.
