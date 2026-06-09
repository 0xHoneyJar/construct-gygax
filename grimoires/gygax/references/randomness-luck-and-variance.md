# Reference: Randomness, Luck & Variance (Schreiber & Romero 2021)

Attributed synthesis for Gygax's **third kind of balance**: the stochastic surface — luck, skill,
variance, and how players *misperceive* probability. Paraphrased with citations to *Game Balance*
(CRC Press 2021), Ch.17 "Independent Randomness", Ch.18 "Dependent Randomness", Ch.19 "Managing Luck
and Skill", Ch.20 "Probability and Human Intuition", Ch.22 "Infinite Probability".

**Why it matters to Gygax:** the cost curve and the payoff matrix both assume deterministic value.
Real mechanics roll dice, draw cards, crit. Two mechanics with **identical expected value** can have
opposite *feel* and opposite *who-wins* outcomes. This is the substrate behind the v3 "probability
scripts" direction. Feeds: `/augury` (a stochastic/`--variance` mode), `/cabal` (the Hopson
epistemics + human-intuition biases), `dice-mechanics-reference.md`.

---

## Independent vs dependent randomness

- **Independent** (Ch.17): "each die roll is independent… not influenced by past or future events";
  a die is "shorthand for a random number generator." Streaks/droughts are **unbounded** short-term
  ("dice have no memory") — only the Law of Large Numbers pulls aggregates toward EV.
- **Dependent** (Ch.18): "knowing the outcome of one event modifies the probabilities of future
  events" — drawing **without replacement** *and revealing*. Both conditions required: removing a
  card unseen changes nothing — *"it is the revealing of information, not the removal of cards, that
  changes the probabilities."* A deck reshuffled only when exhausted **bounds variance** (each
  outcome appears its fair share before repeating); dice do not.

## Output vs input randomness (the skill-preservation axis)

- **Input randomness** (Ch.19): randomizes the setup *before* the decision (map gen, Carcassonne
  draw-then-place, the Catan board). Preserves deep strategy — players plan around it; "without
  making the game feel too random." Risk: if it's the *only* randomness, optimal lines become evident
  → solvable / analysis-paralysis.
- **Output randomness** (Ch.19): resolves *after* the player's action (to-hit/damage rolls,
  gambling). Adds excitement and a *new* skill — the **risk/reward calculation** — but "luck
  dominates; unlucky outcomes lead to cheap losses." Adding output randomness to a point-blank shot
  "robs them of a skillful kill" → skill-based action games are "quite incompatible with randomness."
- **Implication:** input randomness preserves strategic skill; output randomness trades agency for
  excitement. *Where* the randomness sits relative to the decision is a structural property Gygax can
  classify.

## Luck vs skill — a double axis, not one slider

- **Two separate axes** (Ch.19): a game can be high-skill *and* high-luck (Poker), or low-low
  (Tic-Tac-Toe). "Often inversely correlated, but not always."
- **What decides dominance is not the amount of randomness** but *"whether a player is rewarded for
  predicting and responding to the randomness."* Poker (recompute odds, re-bet as cards reveal) is
  skill-dominant; Blackjack (bet locked first, choices reduce to a memorized chart) is "executing an
  algorithm, not making decisions."
- **Magnitude / swinginess governs who wins, via the Law of Large Numbers.** *Kill the Elf*: a flat
  1/turn warrior vs a d6-roll-of-6-for-6 wizard have **identical EV (1/turn)**, but in a race to 6
  the high-variance wizard wins ~60%. Raise the target (race to 10, to 1,000,000) and the wizard
  regresses to EV. **More repetitions ⇒ variance washes out ⇒ skill decides.** *"A single hand of
  Poker is more luck than skill; a series of a hundred hands is more skill than luck."*
- **Early luck dominates:** in a 50d6-vs-50d6 race a 5-point first-roll lead → ~75% to win — "a
  little luck at the beginning of a heavily luck-based game can dominate." Fix with negative feedback.
- **Dialing luck** (Ch.19): shrink the random possibility space (d10 not d20); use **many small
  dice** (5d2 is tighter than d6+4 for the same range); **increase the number of trials** (LLN);
  convert rolls into decisions (deal cards 1–6, play each once); reduce the random event's *impact*.
  Reverse to dial up.
- **Why some randomness helps:** replayability (input), excitement (output), **comebacks** (FPS
  head-shots / Wii hidden rubber-banding let weaker players occasionally win) — broadens the audience
  "to a point." **Why some hurts:** removes agency, cheap losses, runaway leaders.
- **The roguelike lesson:** a game saturated with rolls can still be *skill-based* because
  "probabilities of everything are exposed" and the player always has outs — death is "a mistake or
  an unnecessary risk, eyes wide open." **Skill = understanding and mitigating risk.**
- **Adjacent axes:** *time* (grinding ≈ "virtual skill") and *money* (F2P pay-to-skip) substitute
  for luck/skill. Information sub-types: complete / hidden / measured; incomplete (you know what you
  don't know) vs imperfect (your info may be wrong).

## Probability & human intuition — fairness is *perceived* (Ch.20)

Core thesis: "most people are terrible at intuiting true probabilities," and *"game balance is all
about players perceiving the game as fair."* Even perfect RNG reads as cheating.
- **EV ≠ utility:** people decline +EV bets when win-frequency is too low or stakes wrong; "it's also
  about the frequency of winning." Math "breaks down at the extremes."
- **Self-serving bias (Sid Meier):** shown 75% odds, players *expect* ~95%; the "fair" 25% loss
  "feels intuitively wrong." One-directional — they're fine winning a 25%-chance fight.
- **Selection/recall, Dunning–Kruger, attribution:** players over-remember wins → overrate skill →
  pick too-hard difficulty → quit; weak players blame "poor game balance"; random rewards
  internalized, random setbacks externalized ("the dice cheated").
- **Anchoring:** 2:1 feels fair, identical 20:10 feels like it *should* be a blowout → the fair loss
  enrages. Multi-bonus RPG damage gets underestimated.
- **Gambler's fallacy** (streaks self-correct — false) and **hot-hand** (streaks continue — also
  false): both real and exploitable; tracking/rewarding win-streaks backfires via regression to the
  mean. 1/32 of players see 6 identical results as their *first* experience.
- **Design solutions:** (1) *conform to the bias* — display 75%, roll 95% (flagged as an ethics
  question); (2) "small gains a little, big gains a lot; tolerate small losses, hate big losses" —
  avoid big random setbacks; (3) the **honest** solution — *expose realized outcomes, not just stated
  odds* (running win%, Tetris piece-frequency tally, Catan pip dots, Risk roll histograms); (4) make
  randomness **visceral** (animated dice/shuffle) to earn trust digital RNG lacks.

## Variance-control tools

- **Draw without replacement** (deck not dice) to bound variance (each outcome appears its share).
- **Pity timer / cumulative-chance** ("bad-luck protection": chance rises each miss, resets on hit) —
  dependent randomness capping dry streaks. *(Posed as a Ch.18 discussion question, not worked
  numerically — flagged.)*
- **Mulligan / redraw** to trim bad-setup variance.
- **More-dice / fewer-faces / smaller-impact** (Ch.19 dials) + **the LLN itself** (more trials).

## Tool-computable signals

- **Expected value:** Σ(outcome × probability) for any roll/draw (Ch.17).
- **Variance / swinginess:** SD of the outcome distribution; compare equal-EV mechanics (d6+4 vs
  5d2). *(A formal "how random" metric is deferred to Ch.24 — flagged; SD is the natural stand-in.)*
- **Swing relative to decision value:** sweep race-length / trial-count and report P(high-variance
  side wins) vs its EV share, and the convergence rate to EV (the *Kill-the-Elf* diagnostic).
- **Pre- vs post-decision tag** (input/output) — structural, from mechanic ordering; predicts skill
  preservation.
- **Independent vs dependent tag** (with/without replacement + reveal) — determines streak bounding.
- **Streak probabilities:** P(k in a row) = pᵏ; expected count in a population N (predicts the
  *perception* fallout, not just the math).
- **Open-ended EV (Ch.22):** geometric/Markov-chain methods for exploding mechanics (the
  "Mordenkainen's Rubber Band" exploding-die: P(k) = 0.8^(k−1)·0.2; geometric-stop EV = 1/stop-prob).
  Compute mean/median/mode **duration** of a stochastic process and the full end-on-turn-N curve;
  truncate the infinite tail when P(not ended) is negligible.
- **Monte Carlo** as the universal cross-check.

> **The unifying read:** transitive asks "priced right?", intransitive asks "right frequency?",
> stochastic asks **"is the luck/skill/variance dialed for the intended experience — and does the
> player *perceive* it as fair?"** Note the twist unique to this axis: the intent-vs-reality gap here
> is partly a gap between true probability and *perceived* probability (Ch.20) — Gygax must reason
> about both the math and the human reading of it. This is where `/cabal`'s simulated players and
> Hopson's affective-forecasting caveat (`secret-science-of-games.md`) become load-bearing.

## Where this feeds

- `/augury` — a future **stochastic/`--variance` mode** (EV, variance, swing, input/output &
  independent/dependent tags, streak/perception math). Realizes the v3 "probability scripts" goal.
- `/cabal` — human-intuition biases + Hopson epistemics; simulated-player *perceived* fairness.
- `dice-mechanics-reference.md` — the mechanical catalog this analyzes.
- `gygax-evolution-roadmap.md` — this is **Balance Type 3 of 4**.
