# Reference: Metagame, Analytics & Beyond Balance (Schreiber & Romero 2021)

Attributed synthesis for Gygax's **empirical & epistemic layer**: how to *measure* the intent-reality
gap, how the metagame self-corrects, and — critically — **when not to balance at all**. Paraphrased
with citations to *Game Balance* (CRC Press 2021), Ch.13 "Analytics", Ch.14 "Metagame Systems"
(ranking/rating, mostly out of scope here), Ch.16 "Beyond Balance".

> **Locating note (honest):** Ch.14 "Metagame Systems" is about *rating/matchmaking* (Elo/Glicko,
> tournament formats), **not** the dominant-strategy feedback loop. That material lives in **Ch.16**
> ("Perfect Imbalance" / "Counters All the Way Down"). A formal "metagame health index" and a
> standalone "solved games" treatment are **not** in the book; the equilibrium math is deferred to
> Ch.25 (intransitive) and significance machinery to Ch.24 (statistics).

**Why it matters to Gygax:** the other three balance references describe *models*; this one is about
**reality** — telemetry, win rates, and the epistemic discipline to not fool yourself. It directly
extends Gygax's existing Hopson-grounded honesty stance (`secret-science-of-games.md`). Feeds:
`/augury` (the empirical check on a model), `/cabal` (epistemics of simulated players), `/lore`.

---

## Metagame as a feedback loop (Ch.16)

- The metagame is the evolving population of committed strategies (the decks brought to a tournament).
  Core loop: players "identify overpowered strategies, then counter them, then counter the counters"
  — **strategy-level Rock-Paper-Scissors** ("you may recognize this as the same core mechanic from
  RPS"). Connects directly to `intransitive-and-matchup-balance.md`.
- **Yomi layers (Sirlin):** a dominant strategy needs **exactly three** counter-layers at the
  metagame level (one fewer than in-match, since metagame strategies are pre-committed and can't
  adapt). Past counter-counter-counter you revert to the original — no fourth layer is needed.
- **Degenerate metagame:** "if no counters exist, the dominant strategy ends up completely dominating
  the metagame and ruining the game's balance." One uncountered above-curve element collapses
  diversity. (The intransitive "emergency brake" is exactly this loop working.)

## Metagame health = strategy diversity

- **Portnow's conditions for safe deliberate imbalance:** (a) nothing can "do everything well"; (b)
  the balance curve is understood so deviations are deliberate; (c) the option pool is wide enough
  that "a counter to just about anything can be found" without single-target hard counters. (c) both
  prevents domination and keeps the metagame dynamic.
- **Perfect balance is its own failure:** "if the game were perfectly balanced, any strategy would be
  as good as any other, so there'd be no point in searching" — optimal play becomes rote/solved/bland.
- **Tiers are healthy, not failure:** expect top/mid/low tiers "so long as each tier has plenty of
  options, and no single character is either entirely useless or so powerful it unbalances the rest."
- **Diversity index** = distribution of pick-share across viable options; concentration = degenerate,
  spread = healthy. *(A Gini/entropy formalization is the natural computable form but is NOT in the
  text — flagged as extrapolation; the book frames it qualitatively as "any strategy dominating?" /
  "never used, always used, or used but suboptimally.")*

## Analytics — which metrics flag over/underpowered (Ch.13)

- **Win rate** = strength; in 1v1, >50% above average, <50% below; in FFA normalize so the roster
  mean ≈ 50% (top-N = "win"). **Pick rate** = popularity (mirror picks count twice).
- **The diagnostic 2×2 (the key signal):**
  | | High win rate | Low win rate |
  |---|---|---|
  | **High pick** | **Overpowered → nerf** (most toxic cell) | Popular but weak → usually a *feel* problem, not power |
  | **Low pick** | Strong but inaccessible/hard → hidden outlier | **Underpowered / dump → buff** |
- **Weight toward harm:** "the real psychological cost… isn't just playing a character a lot, but
  **losing to** that character a lot." High-pick × high-win is the worst; never-picked-but-wins barely
  generates complaints. → a **toxicity score ≈ pick_rate × max(0, win_rate − 0.5)**.
- **Localize the cause:** win rate is coarse; drill to damage / K-D / per-move (frequency × hit-rate ×
  effect = "contribution to winning") to find *which* element is responsible.
- **Build/strategy variety within winners:** a fixed optimal build is "boring even if win-rate is
  fine." Pairwise co-occurrence win rates surface synergy/counter structure.

## Epistemic limits — how analysis lies (Ch.13)

This is the most important section for an honest analyst:
- **Metrics are second-order & correlational:** a change alters behavior which alters metrics; "the
  question of *why* cannot be answered" by metrics alone. **Correlation ≠ causation** is "one of the
  most important things an analytics designer does."
- **Goodhart trap (named):** blind metric-chasing "does nothing to help the designer understand their
  game… each change a stab in the dark," finding only *local* maxima — never the "giant leap" a
  different design would reach.
- **Claim-strength ladder:** Observation → Correlation → Plausible causality → Verified causality
  (A/B or natural experiment) → Statistical model. "Statistical analysis is never 100% reliable."
- **Noise & significance:** tiny samples and tiny effects lie ("a 0.002% win-rate change is probably
  noise"; two players in millions = outlier). Use SE bars, Z-test, chi-squared, ANOVA; clean outliers
  first.
- **Metrics can mislead even when correct:** a "100% hit rate" can be a coding artifact; high damage on
  a move can be downstream of a *different* move. Always verify the implicit assumption.
- **No "typical" player (the strongest point):** "large player bases don't have a single typical
  player, but many player types." A character can be top-tier for novices and mid for experts — or the
  reverse. **Balancing to the aggregate misbalances both ends; subdivide every metric by skill/rating.**
- **Observer effect & ethics:** surveying friendliness changes behavior; metrics can optimize toward
  "strip-mining" players (whales). Accurate metrics can steer toward harm.

## When NOT to balance (Ch.16)

- **Balance is instrumental:** "the purpose of game balance is to make the game feel fair." It serves
  the experience and the audience's expectation — never an end in itself.
- **Perfect imbalance:** deliberate ~10–15% off-curve deviations create "the game-within-a-game of
  figuring out the exploits" — the hunt is the fun.
- **Declared imbalance is fine:** *The Great Dalmuti* / *We Didn't Playtest This At All* succeed
  *because* the unfairness is announced and expectation-managed; "games run into trouble if players
  expect a fair fight and find out only during play that it's not."
- **Imbalance can be the point:** Dalmuti's rich-get-richer loop drives the social/underdog dynamic.
- **Context decides:** an overpowered card that ruins a head-to-head CCG can be "a lot of fun" vs AI
  in single-player — because the core there is power-progression, matching expectations.
- **Numbers aren't always balance:** changing a number can shift *emphasis/feel* without touching
  balance — not every numeric knob is a balance knob (Bejeweled scoring).
- **Caveat the book itself flags:** some games (*Betrayal at House on the Hill*) succeed *despite*
  poorly-managed imbalance — don't over-generalize "imbalance is fine."

## Tool-computable signals

- Per-option **pick rate** and **win rate** (FFA-normalized); the **2×2 quadrant** classification.
- **Toxicity score** = pick × max(0, win − 0.5); rank balance findings by it, not raw win rate.
- **Diversity index** (entropy/Gini of pick-share) for metagame health *(extrapolated form)*.
- **Contribution decomposition** (freq × accuracy × effect) to localize the responsible element.
- **Segment-split by rating** everywhere; flag options whose win-rate slope vs skill is steep
  (skill-gated) or inverted (novice-stomp).
- **Significance gating:** attach SE/Z-test; suppress sub-noise effects and sub-threshold samples.
- **Claim-strength tag** on every finding (observation / correlation / causal / verified) — *Gygax
  should emit this on its own outputs.*

> **The unifying read & a principle for Gygax itself:** this layer is the **reality** half of every
> intent-vs-reality check — the empirical counterpart to the three *model* engines (transitive,
> intransitive, stochastic). Its deepest lesson is reflexive: **Gygax is itself an analytics
> instrument and must obey these limits** — never present a model result as verified truth, tag claim
> strength, segment rather than average, and remember that a *perfectly* balanced design is often the
> wrong goal. This is the formal extension of Hopson's affective-forecasting caveat already in
> `secret-science-of-games.md`.

## Where this feeds

- `/augury` — the empirical check on a model (pick×win, toxicity ranking, diversity); claim-strength
  tagging on outputs.
- `/cabal` — simulated-player epistemics; "no typical player" → segmented archetype panels.
- `/lore` — perfect-imbalance, declared-imbalance, when-not-to-balance heuristics.
- `gygax-evolution-roadmap.md` — the **reality plane** beneath all four balance types.
