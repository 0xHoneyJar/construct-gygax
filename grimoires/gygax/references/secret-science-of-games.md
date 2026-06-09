# Reference: The Secret Science of Games (John Hopson, 2023)

Attributed summary for gygax's heuristic library and epistemic framing. All concepts below
are paraphrased in our own words with citations; no text is reproduced from the source.

**Source:** John Hopson, *The Secret Science of Games* (self-published, 2023). Hopson is a
20-year games-user-research veteran (Halo, Destiny, World of Warcraft, Overwatch, Age of
Empires, Hearthstone) with a PhD in psychology; also author of the 2001 essay
*Behavioral Game Design*.

**Relevance to gygax:** the book is, in effect, a 175-page treatise on the gap between
**designer intent** and **player reality** — the same gap gygax automates via
`[INTENT-CONFLICT]` tagging. Most useful for: the engine-tuning design
(`../designs/engine-tuning-support.md`), `/cabal` epistemics, and `/lore` heuristics.
*Not* a source for balance math/cost-curves (see Schreiber, *Game Balance Concepts*, for that).

## Core framework — intent × reality (ch. 1)

Hopson defines fun functionally: *"fun is whatever the designer and player agree is fun."*
Every player experience falls into a 2×2 of **designer intended / didn't intend** ×
**player finds fun / not fun**:

| | Designer intended | Designer didn't intend |
|---|---|---|
| **Player finds fun** | Expected fun (ship it) | **Unexpected fun** (e.g. Civ's nuke-happy Gandhi — encourage it) |
| **Player finds not fun** | **Unexpected non-fun** (the bug to find) | Expected non-fun (working as intended) |

The substitution principle: replace "fun" with **any** design dimension — difficulty
(deaths-vs-predicted), weapon usage (actual-vs-assumed) — and the same matrix applies. This is
the general form of gygax's intent-vs-reality analysis. The designer "glides the optimal path";
that path is invisible to them, so flaws only surface when a typical player plays unaided.

## Balance methodology — two axes (ch. 23, "Balancing Destiny")

The most load-bearing chapter for the engine-tuning mission. All balance testing splits into:

- **Difficulty testing** (reductionist): start the player at a **fixed, known power/gear
  level**, benchmark each encounter *in isolation*, **look for spikes**. Ideal curve trends
  smoothly easy→hard; flag drastic jumps. → gygax's parametric crossover/spike detection.
- **Progression testing** (holistic): let the player advance **naturally**, then compare their
  *actual* power level at each point against the **designer-predicted** level. In Destiny,
  shooter-minded players rushed the story and fell behind the intended curve. → gygax's
  progression-curve / resource-income analysis.

**Key principle:** *"Had we only done one method, the game would have been broken."* Difficulty
and progression are two axes of one analysis, not separate tasks. (Directly explains why the
carmack balance report's findings are all conditional on un-modeled relic income.)

Supporting heuristics from the chapter:
- **Spike anti-pattern:** sudden unforgiving difficulty with no player control (the "Telthor"
  locked-room skill-check: door locks, multiple waves, no snipe/retreat/partial-clear option)
  causes quits. Same shape as the carmack depth-20 brute catastrophe.
- **Cross-genre mindset assumptions:** FPS players assume *every* enemy is meant to be killed;
  RPG players know to avoid over-level enemies and return later. Destiny's "bouncers" (strong
  gate-keeper enemies meant to turn players back) failed — players dug in and died repeatedly
  ("the enemy was there, so I must be supposed to fight it"). A false-affordance / communication
  failure, not a tuning failure. → `/lore` (onboarding, communication); `/cabal` (newcomer).

## Epistemic constraints (ch. 21 Halo 2 matchmaking; ch. 22 interviews)

Honesty boundaries for any analyst, including gygax's simulated `/cabal` panels:
- **Affective forecasting is unreliable.** Players' *predictions* of how they'll feel about a
  system are often wrong; never present forecast-opinions as facts. (Halo 2 matchmaking: players
  hated the described system in the lab, loved it in practice — researchers presented the
  forecast as truth and were wrong.) → `/cabal` archetype reactions are forecasts; flag
  confidence accordingly.
- **An analyst can only speak from what players actually react to.** Designers can invent novel
  mechanics with no prior; those are *much* harder to evaluate and conclusions must be tempered.
  → gygax analyzes the given system; it should not overclaim on the reception of genuinely
  novel mechanics.
- **Statistics vs anecdotes:** large-N smooths individual noise (a single tester is ~20% of a
  5-person study); qualitative interviews build empathy and surface *why*, but are not hard
  data. → grounds gygax's "ground claims in numbers, surface what you don't know" stance.

## Reward-cadence note (ch. 22, Overwatch endorsements; cf. Behavioral Game Design 2001)

Anti-toxicity endorsement rewards underperformed partly because they were **too stingy**
(a few lootboxes/month vs Arcade's 3 per 10 wins) — reward value must track the effort/cost
curve, or the incentive goes inert. Connects to the 2001 reward-schedule work (variable-ratio
schedules, extinction, behavioral contrast) and to the balance report's recommendation to scale
heal as a fraction of maxHP rather than a flat amount. → `/lore` (reward economy, pacing).

## Where this feeds

- `../designs/engine-tuning-support.md` — difficulty-vs-progression framing (ch. 23).
- `/cabal` — epistemic constraints on simulated player forecasts (ch. 21–22).
- `/lore` — spike anti-pattern, cross-genre mindset, reward cadence (ch. 22–23).
- Related: `design-failure-postmortem.md` (same intent-vs-reality principle, failure-archetype lens).
