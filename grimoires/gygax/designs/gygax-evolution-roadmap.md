# Design: The Gygax Evolution — The Four Balances & the Intent–Reality Spine

**Status:** Vision / roadmap (beyond cycle-005) · **Date:** 2026-06-08
**Author's note:** written as a forward-looking synthesis after ingesting the full balance canon
(Church FADT, Hunicke/LeBlanc/Zubeck MDA, Hopson *Secret Science*, Schreiber & Romero *Game
Balance*, plus the failure-archetype postmortem). It is opinionated on purpose. The point is to give
cycle-005 (engine-tuning) a *destination* — to show this isn't a one-off feature but the first step
of Gygax growing into a complete analytical instrument.

---

## 1. The one thing Gygax actually does

Strip away the twenty traditions and the eight commands and Gygax does exactly one thing:

> **It measures the gap between the behavior a designer *intended* and the behavior a system will
> *actually* produce.**

This is Hopson's intent×reality matrix (`secret-science-of-games.md`), Church's "make *why* legible"
(`formal-design-language.md`), MDA's "design for the player, not the designer," and the analytics
chapter's correlation-≠-causation discipline (`metagame-analytics-and-beyond-balance.md`). Every
Gygax output — a `[INTENT-CONFLICT]` tag, a broken economy, a false choice — is one instance of that
single gap. **Intent–reality is the spine.** Everything below hangs off it.

What changes across problems is only the *mathematics* of "actually produce." And there, the canon
is unambiguous: there are **four kinds of balance**, each a different math, and Gygax today can
properly reason about **one**.

---

## 2. The Four Balances (the analytical map)

| # | Balance type | The question | The math | Gygax today |
|---|--------------|--------------|----------|-------------|
| **1. Transitive** | Is it **priced right**? | Cost/power curve; off-curve divergence | `/augury` partial; **cycle-005** extends to parametric (`model:` + sweep) | Partial → growing |
| **2. Intransitive** | Is it played at the **right frequency**? | Payoff matrix; mixed-strategy equilibrium `c = M⁻¹p` | **Absent** | Missing |
| **3. Stochastic** | Is the **luck/skill/variance** dialed — and *perceived* fair? | EV, variance, input/output & dependent randomness, perception | **Absent** (the v3 "probability scripts" goal) | Missing |
| **4. Progression** | Does the **curve track over time**? | (Cv+Cs)−(Pv+Ps); velocity/acceleration; feedback loops | Partial via resource-economy; **cycle-005 R1** | Partial |

Cutting **across** all four:
- **Structural leverage** (`knob-leverage-taxonomy.md`, L1–L7) — *which* knob in any of the four
  matters, beyond local sensitivity. This is the connective tissue.
- **The reality plane** (`metagame-analytics-and-beyond-balance.md`) — the empirical check (pick×win,
  toxicity, segmentation) and the epistemic discipline that keeps all four honest.

The unification is exact and worth stating plainly, because it's the whole thesis:

> Transitive asks "off the **curve**?" · Intransitive asks "off the **equilibrium**?" · Stochastic
> asks "off the intended **variance**, and off the player's **perception**?" · Progression asks "is
> the predicted-vs-actual **curve** diverging over time?" — **four divergences, one intent–reality
> test.** A dump stat (L7), a dominated strategy, a swingy coin-flip mechanic, and a runaway snowball
> loop are the *same disease* — intent betrayed by emergent reality — caught by four instruments.

---

## 3. Where cycle-005 actually sits (and why it's bigger than it looks)

Engine-tuning is framed as "Balance Type 1, parametric." True — but its core primitive is more
general than its framing. **FR-1's sweep + first-crossing + spike detector is not a transitive-only
tool.** Point it at:
- a **cost curve** → transitive crossover (the carmack TTK case);
- **(Cv+Cs)−(Pv+Ps)** → progression crossover (where challenge outpaces power — Hopson's other axis,
  R1) — *the same engine closes both Hopson axes*;
- a **variance series** → stochastic swing (where a mechanic's variance dominates its EV — the
  *Kill-the-Elf* diagnostic);
- a **payoff value X(parameter)** → intransitive crossover (where an asymmetry flips a matchup).

So cycle-005 quietly builds **the shared substrate for all four balances**: a safe formula
evaluator + a dense sweep + crossing/spike detection over *any* metric of a progression variable.
That is the real reason this cycle is the right first step — it's not a feature, it's the engine the
other three plug into.

---

## 4. The roadmap — concrete cycles beyond engine-tuning

Ordered by leverage × readiness. Each is grounded in a reference now in the grimoire.

### Near (the substrate pays off)
- **C-006 · Progression / second-Hopson-axis.** Make the FR-1 sweep consume (Cv+Cs)−(Pv+Ps) and the
  relic/boost economy. **Permanently closes R1** — Gygax stops being a difficulty-only analyst and
  runs *both* mandatory Hopson axes. Adds the treadmill/false-progression detector (real vs cosmetic
  scaling). Ground: `progression-and-feedback-loops.md`.
- **C-007 · Stochastic engine (`--variance`).** The v3 "probability scripts" goal, realized: EV +
  variance + swing-relative-to-decision; tag every random element input/output and
  independent/dependent; streak/perception math. Crucially includes the **perception** layer
  (display-odds vs felt-odds) — the one balance axis where reality includes the *player's mind*.
  Ground: `randomness-luck-and-variance.md`.

### Mid (new mathematics)
- **C-008 · Intransitive engine (`--matrix`).** Payoff-matrix solver: dominated-strategy elimination,
  `c = M⁻¹p` equilibrium, optimal-frequency vs intended-frequency divergence, best-response loop
  reduction. Gives Gygax matchup/roster/strategy balance it categorically cannot do today — and makes
  the Optimizer `/cabal` archetype rigorous. Ground: `intransitive-and-matchup-balance.md`.
- **C-009 · Feedback-loop topology (the deferred FR-4).** First-class sources/drains/converters/gates
  + positive/negative loops + visualization. This is the structural backbone that makes taxonomy **L2
  exact** (not heuristic) and unifies progression + economy. The single highest-leverage structural
  capability. Ground: MDA second-order + `progression-and-feedback-loops.md`.

### Foundational (cross-cutting, can start anytime)
- **The Balance-Type Router.** The meta-capability: given a mechanic, Gygax decides *which* of the
  four engines applies (a stat → cost curve; a unit roster → payoff matrix; a damage die → variance;
  a progression table → curve). Today a human picks the lens; Gygax should. This is what turns four
  engines into one analyst.
- **The Reality Plane.** Ingest real telemetry (pick×win, toxicity = pick×max(0,win−0.5),
  segment-by-skill) to *check models against reality* — and, reflexively, make Gygax **tag its own
  claim strength** (observation / correlation / causal / verified) and **segment rather than average**
  on every output. Ground: `metagame-analytics-and-beyond-balance.md`.

---

## 5. Beyond balance — what would make Gygax genuinely great

Three convictions, beyond any single cycle:

**(a) Epistemic honesty as identity, not garnish.** The deepest lesson in the entire canon is
reflexive: *Gygax is itself an analytics instrument and must obey analytics' limits.* Schreiber's
Goodhart trap, "no typical player," "correlation ≠ causation," and Hopson's affective-forecasting
caveat all say the same thing — **a confident wrong answer is worse than a hedged right one.** Gygax
already refuses ungrounded analysis. The evolution is to make every output carry a *claim-strength
tag* and a *segment* rather than an average, and to be willing to say "this is a perception problem,
not a math problem" or "this imbalance is correct for your audience." An analyst that knows its own
limits is rarer and more valuable than one that always has a number. **This is the differentiator.**

**(b) Intent must become first-class.** Every one of the four divergences is measured *against
intent*. Yet intent is the least-captured input today. The v3 "designer intent tracking" direction is
not a side feature — it is the other terminal of the spine. Off-curve, off-equilibrium, off-variance,
off-trajectory are all meaningless without a crisp statement of what was *intended*. Strengthening
intent capture (intended frequency, intended curve, intended luck/skill ratio, intended audience win
rate) raises the ceiling on *everything else*. If I could change one thing about Gygax's data model,
it would be to make intent a declared, typed, first-class citizen alongside the mechanics.

**(c) "Perfect balance is often the wrong goal."** Schreiber's Beyond-Balance chapter is a warning
Gygax must internalize: deliberate imbalance (perfect imbalance, declared asymmetry, narrative
weighting, co-op weighted for the player) is frequently *correct*. A Gygax that flattens everything
to parity would be a bad analyst. The mature instrument distinguishes a *bug* (unintended divergence)
from a *choice* (intended divergence) — which loops back to (a) and (b): you can only tell them apart
if intent is declared and claims are honest.

---

## 6. Honest risks (questioning my own vision)

- **Calculator vs analyst.** The four engines risk turning Gygax into a spreadsheet. The antidote is
  §5 — the router, the epistemics, the intent layer are what keep it an *analyst*. Build those in
  parallel, not after.
- **The perception axis resists math.** Stochastic balance (and much of fairness) lives partly in the
  player's flawed intuition. Gygax can model the math exactly and still be wrong about the *felt*
  experience. `/cabal` (simulated players) is the only lever here, and it's a forecast, not a fact —
  tag it as such.
- **Scope.** This is 4+ cycles. The discipline is that each cycle ships a *complete* balance type with
  its own acceptance fixture (the cycle-005 lesson: prove the capability, don't boil the ocean).
- **Intransitive cost-propagation is non-local.** Tuning one matchup shifts all frequencies; a naive
  knob report could mislead. The intransitive engine must solve the whole matrix, never one cell.

---

## 7. The one-paragraph version

Gygax measures one gap — intended vs emergent behavior — and that gap takes four mathematical forms:
priced-right (cost curves), played-at-the-right-frequency (payoff matrices), dialed-right-and-felt-fair
(variance & perception), and tracking-over-time (progression curves & feedback loops). Cycle-005
builds the shared sweep/crossing engine under all four while delivering the first (parametric
transitive). The evolution is to grow the other three engines, add the loop topology that makes
structural leverage exact, and — most importantly — to make intent first-class and epistemic honesty
the identity, so Gygax becomes not a calculator that always has a number, but an analyst that knows
which of the four questions to ask, answers it grounded in reality, and is honest about how sure it is.

---

## 8. A third domain — agent systems & incentive design (forward pillar)

> Added 2026-06-08 after a teammate observed deep parallels between Gygax and agent infrastructure
> ("setting incentives and game theory"). Carry this lens forward; it is not a cycle-005 task.

Gygax's domains have widened tabletop → engines. The next widening is to **agent systems**. The
reason is not analogy — it is *identity of problem*: Gygax measures the gap between **intended** and
**emergent** behavior in a system of interacting agents with incentives. That is precisely the
**specification-gaming / alignment** problem of agent infrastructure. The same four balances apply,
one-to-one:

| Balance | In an agent system |
|---|---|
| **Transitive** (cost curve) | Are the incentives priced right? An over-rewarded tool is *above the curve* → it dominates and suppresses all other behavior (an agent that always does the one thing). **Reward hacking = a dominant strategy; a god/dump tool (L7) = always/never used.** |
| **Intransitive** (payoff matrix) | Literal multi-agent game theory — Nash equilibria, dominant strategies, cooperation vs defection, coordination. |
| **Stochastic** (variance) | Exploration vs exploitation, temperature, behavioral variance, luck vs skill in outcomes. |
| **Progression** (feedback) | Reward shaping, runaway/snowball loops, capability curves over training/time. |
| **Reality plane** (analytics) | **Goodhart is named outright in Schreiber's analytics chapter**; "no typical user," correlation≠causation — these *are* the agent-eval pitfalls. |
| **Metagame** | Agent *populations* evolving strategies; degenerate metagame = mode collapse / one exploit dominating; perfect-imbalance = you don't want homogeneous agents. |

**The bridge already exists: `/cabal`.** Gygax's simulated player archetypes are already a
**multi-agent simulation harness**. The natural evolution is to point `/cabal` at an *incentive
structure* (an agent system's rewards/tools) and surface the degenerate strategies before they ship —
agent red-teaming via game-theoretic simulation. The knob-leverage taxonomy becomes **incentive-design
guidance**: which reward/tool knobs actually move behavior, and which silently dominate.

Sequencing: this rides naturally on C-007 (stochastic) and especially **C-008 (intransitive/payoff
matrices = the game theory)**, plus dedicated `/cabal` work. Treat it as a standing lens on every
future cycle: *whatever we build for games and engines, ask what it means for agents.*

## References (all now in `grimoires/gygax/references/`)
- `game-balance-cost-curves.md` — Balance 1 (transitive).
- `intransitive-and-matchup-balance.md` — Balance 2 (intransitive).
- `randomness-luck-and-variance.md` — Balance 3 (stochastic).
- `progression-and-feedback-loops.md` — Balance 4 (progression) + loop theory.
- `metagame-analytics-and-beyond-balance.md` — the reality plane + when-not-to-balance.
- `knob-leverage-taxonomy.md` — structural leverage across all four (L1–L7).
- `secret-science-of-games.md`, `formal-design-language.md`, `design-failure-postmortem.md` — the
  intent–reality spine.
- `engine-tuning-support.md` — cycle-005, the shared substrate.
