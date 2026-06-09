# Reference: Game Balance — Cost Curves & Transitive Math (Schreiber & Romero 2021)

Attributed summary for Gygax's numeric-balance substrate. Concepts paraphrased in our own words
with citations; no text reproduced. This is the **numeric half** of "which knobs matter" — the
complement to the structural masters in `knob-leverage-taxonomy.md`.

**Source:** Ian Schreiber & Brenda Romero, *Game Balance* (CRC Press, 2021). Schreiber's long-running
"Game Balance Concepts" course, with Romero. The canonical treatment of transitive balance math.

**Why it matters to Gygax:** the structural canon (Church/Hopson/MDA) tells you *which kinds* of
knobs amplify; Schreiber tells you *how much a knob should be worth* — the defined numeric
relationship between cost and benefit. Together they answer "which knobs matter": a knob matters
when it is **off its cost curve** (mis-valued) or **structurally amplified** (loop/gate/multiplier).
Feeds: `knob-leverage-taxonomy.md` (FR-2), `../designs/engine-tuning-support.md`, `/augury`
resource-economy, `/lore`.

---

## Transitivity — "you get what you pay for"

**Transitive** data is data where better costs more, along a smooth relation (RPG store prices,
weapon/armor tiers, XP-to-level, TCG card cost-vs-effect). Balancing transitive data = *figuring
out what each thing should cost so cost relates to benefit* (Ch.8, "Transitivity"). Contrast
**intransitive** mechanics (rock-paper-scissors): no "better," balanced by matchup, not by price —
a different problem (Ch.25). **Gygax read:** the `model:`/parametric surface is transitive data; the
cost curve is the right tool. Intransitive systems need the matchup lens, not a curve.

## The cost curve (cost/power curve)

Pick an **anchor** — a resource everything is priced in (gold, mana, XP, action-points) — and scale
all data against it to get a **defined numeric relationship between cost and benefit**. "If a lesser
sword costs $300, a sword doing double damage should cost ~$600, all else equal" (Ch.8, "Cost
Curves"). Every object = a bundle of **costs** (resource price + drawbacks/limits) and **benefits**;
what matters is only that the columns *sum to parity* with like objects — a limitation can live in
either column.

> **Gygax operationalization:** a knob's **correctness** = does its benefit/cost ratio sit on the
> curve? A mis-tuned knob is one whose marginal benefit per unit cost **diverges from the curve**.
> This is the numeric definition FR-2 ranks against; structural leverage (taxonomy L1–L6) says which
> off-curve knobs are *dangerous*, not just wrong.

## The above-curve asymmetry — *the leverage bomb*

> "A too-strong object destroys the balance of the entire game, not just the balance of itself."

A single object **above** the curve always gets used and suppresses everything else (dominant
strategy); an object **below** the curve is merely unused. So the systemic leverage of an off-curve
knob is **asymmetric**: above-curve = catastrophic, below-curve = wasteful. Guideline: **when
uncertain, err weak** (Ch.8, "Cost Curve Guidelines"). **Gygax read:** when surfacing knobs, an
above-curve knob is the highest-priority finding — it's a dominant-strategy/degenerate risk, not a
tuning nicety. Rank above-curve divergence above below-curve divergence.

## Control one variable at a time — *this IS FR-2's perturbation*

To find a knob's cost, **isolate it** — "like a scientist, control for one unknown variable at a
time." Don't co-vary two unknowns (Flying + First Strike): you can't separate their contributions,
*and you miss the interaction bonus/penalty between them* (Ch.8, "Cost Curve Guidelines").

> **Gygax read:** FR-2's local sensitivity (perturb one knob, re-sweep, measure Δ) is exactly
> Schreiber's control-one-variable, automated over a parametric model. The same caveat applies:
> one-at-a-time perturbation **misses interaction terms** — which is precisely why the structural
> detectors (taxonomy L2 loop, L5 coupling) exist. Mechanical sensitivity is correct *locally*;
> interactions and amplification are structural.

## God stats & dump stats — *the false-choice signature*

A **god stat** is overpowered / mandatory for an optimal build (everyone maxes it). A **dump stat**
is safely ignorable (everyone drops it). **Both signal a non-meaningful decision** — "if a
particular attribute/skill is one all playtesters take (or avoid), that suggests an imbalance"
(Ch.9, "God Stats, Dump Stats, and Meaningful Decisions"). A *meaningful* decision is one with
impact **and** ≥2 viable alternatives; a god/dump stat collapses it to a non-choice.

> **Gygax read — directly serves Gygax's "false choices" mandate.** The parametric signature of a
> god/dump stat: a knob whose **optimal value is invariant across the swept domain** — always
> pinned to a bound (max it / zero it) regardless of where you are on the curve. That's a detectable
> tell of a false choice. The fix Schreiber models is *good coupling*: give the would-be dump stat a
> second job (Strength → carry capacity + door-pushing, so even mages value it) — the inverse of the
> MAD/L5 failure. (New taxonomy detector: **L7 god/dump**.)

## Optionality & power creep (two smaller laws)

- **Optionality is non-negative.** A limited benefit is never < 0; a choice of two effects is worth
  ≥ the better one. An unused option never makes a thing worse (Ch.8 guidelines). *Gygax:* don't
  penalize a knob for adding an option; do penalize it if the option is a god/dump non-choice.
- **Power creep is structural in expanding games.** The cost curve **inflates over time** — new
  content must beat the best old content to be desirable, so the curve ratchets up indefinitely
  (Ch.8). *Gygax:* relevant to **engines** (content added on top) and live games — a knob tuned to
  today's curve drifts below tomorrow's. Flag curve-relative, not absolute.

---

## Where this feeds

- `knob-leverage-taxonomy.md` — supplies the **numeric backbone** (cost curve = the "correct value"
  a knob is measured against) + the above-curve asymmetry + L7 god/dump detector.
- `/augury` FR-2 — off-curve divergence as the base signal; control-one-variable = the perturbation
  method; above-curve = priority.
- `../designs/engine-tuning-support.md` — transitive cost-curve math is the rigor behind capability
  (2); power-creep is an engine-adoption consideration.
- `/lore` — god/dump → false-choice heuristic; dominant-strategy/degenerate archetypes
  (cf. `design-failure-postmortem.md`).
