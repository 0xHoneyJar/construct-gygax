# Reference: Progression Curves & Feedback Loops (Schreiber & Romero 2021)

Attributed synthesis for Gygax's **fourth kind of balance**: how power and challenge track *over
time*, and the feedback loops that shape it. Paraphrased with citations to *Game Balance* (CRC Press
2021), Ch.10 "Combat" (light), Ch.11 "Progression in PvE", Ch.12 "Progression in PvP".

**Why it matters to Gygax:** this is **Hopson's progression-testing axis** made rigorous — the half
of balance the carmack analysis never ran (cycle-005 R1). It also gives the exact theory behind the
taxonomy's **L2 loop leverage**. Feeds: `/augury` (progression/`--curve` analysis, resource-economy
loops), the engine-tuning design (the relic/boost economy = a progression loop), `/delve` (attrition
curves), `/lore`.

---

## The perceived-challenge model (the core instrument)

- **Four levers of perceived difficulty** (Ch.11): **Player skill (Ps)**, **Virtual skill / player
  power (Pv)**, **Virtual challenge (Cv)** = raw enemy stats/count, **Skill challenge (Cs)** =
  demands of novel play (smarter AI, new puzzle types). The model:
  > **Perceived challenge = (Cv + Cs) − (Pv + Ps)**, tracked over the playthrough = the difficulty curve.
  The player feels one "am I challenged?" signal; **four** levers move it. This is the parametric
  target for a progression analyzer.
- **Grind ≠ difficulty:** "a tedious task is not difficult, merely time-consuming" — friction does
  not raise perceived challenge. Don't confuse time-cost knobs with difficulty knobs.
- **Three balance questions** (Ch.11): is the *difficulty curve* rising at a good rate; is the *power
  curve* growing at a good rate **relative to enemy power**; is overall difficulty right for the
  audience. "Balanced" is **not** a 50/50 win rate — masocore expects failure, co-op is often
  weighted *for* the player ("illusion of a strong fight, then losing").

## Curve shapes — velocity & acceleration

- A progression arc has **velocity** (rate of power change) and **acceleration** (rate of change of
  velocity). Five named shapes (Ch.11): **(a) linear**, **(b) exponential** (slow→fast, positive
  feedback — Catan), **(c) front-loaded decelerating** (fast early then slowing — classic RPG/idle:
  early power to hook, then "stretch out content"), **(d) tension-and-release** (oscillating), **(e)
  irregular** (intentional variety *or* accidental bad balance). "There is no single correct
  velocity." → an analyzer should *classify* the curve and flag unintended shape (e).
- **Micro-shape (the sawtooth):** entry difficulty spike → player power rises while area challenge
  stays flat → boss spike → power bump from boss loot/new area. Strung together = a stepped macro
  curve. Missing post-boss power bumps = stagnation risk.
- **Net RPG power gain is ~linear:** the win→level→win-more positive loop is offset by enemies
  scaling *and* rising victories-per-level — so "the actual rate of gain is closer to linear."

## Predicted vs actual — the intent-reality gap, over time

- **Players misjudge their own trajectory:** "players perceive difficulty relative to their current
  trajectory, assuming progress is linear even when it's a sharper downward curve" → they feel
  constant friction even when progressing fast. Mitigate by shifting challenge into mastery, shorter
  learning, and an honest **progress bar**.
- **Detecting fall-ahead / fall-behind:** player skill can't be read directly (performance fuses
  skill+power); the signals are death/setback frequency, *where* failures cluster, and first-time
  level duration — i.e. **analytics** (`metagame-analytics-and-beyond-balance.md`).

## The treadmill & false progression — "number go up" with no change

- **Absolute vs relative:** in idle/Cookie-Clicker, Pv and Cv both rise ~linearly together, so
  **perceived challenge stays flat** despite inflating numbers. Even holding both constant, perceived
  challenge *still* falls because the player improves (Ps rises) — which is the structural reason
  enemy numbers must inflate at all.
- **False Progression:** random systems simulate advance with **no real gain** — slot-machine near
  misses; *Destiny* launch loot that "did not give players anything better than what they already
  had… and yet gave a perception of progress." Needs *hope* to sustain; too-low perceived success
  flips to futility.
- **Elder game:** in endless PvE, progression eventually becomes meaningless (level cap / maxed) —
  often an abrupt, jarring transition; the objective must shift away from progression.
- **Artificial gating:** grind is acceptable *only* if the core loop is fun; using rewards/loss-threat
  to "fix broken gameplay" holds players hostage — they stay short-term, leave resentful.

## Feedback loops — the engine of progression dynamics (the L2 theory)

- **Positive feedback (snowball):** rewards the leader; good for *ending* a game, but **early
  positive feedback is far more dangerous than late** because it "amplifies over time" → runaway
  leader, futility. Usually keys off a player's **absolute** power (opponent-independent).
- **Negative feedback (catch-up / rubber-banding):** keeps outcomes uncertain; can feel like
  "rewarded for playing poorly"; has **larger effect late-game** once gaps exist. Usually keys off
  **relative** power (opponent-dependent). Examples: Mario Kart item weighting (weak items for 1st,
  strong for last), racing AI speed adjustment, Catan players refusing to trade with the leader.
- **The design recipe:** negative feedback dominates early (prevent runaway), positive feedback
  dominates late (force a clean finish) — "back-and-forth reversals… one final irreversible triumph."
  Tune loops so "already-won" coincides with the actual ending.
- **Sum-type taxonomy (PvP):** positive-sum (Catan — created from bank), zero-sum (Poker —
  redistributed), negative-sum (Chess — only lost). Determines the family of valid curve shapes.
- **PvP pathologies:** turtling (non-interaction optimal → reward aggression), killing-the-leader &
  sandbagging (gang-up = built-in negative feedback, but over-punishes), kingmaking (a loser decides
  the winner), player elimination (idle eliminated players). *(Book does NOT use "smurfing",
  "pay-to-win", or "veteran advantage" — flagged; it frames PvP fairness via matchmaking + the
  **fair game** "best play wins" vs **even match** "equal chance" distinction.)*

## Combat levers (Ch.10, light) — the knobs that define combat's shape

- **7 Pillars** (qualitative shape): Genre, Time (RT/turn), Pacing, Feel, Participants, Progression
  type, Volume. **3 Constraints** (quantitative knobs): length of game; length of combat × number of
  combatants (= encounter length) + frequency; **number of hits**. Crucial inversion: design the
  *felt* hit-count first — "the Cyberdemon could have 3 HP or 30 or 300; what mattered is two or
  three hits." **HP is derived from the desired hit-count, not the reverse.**

## Tool-computable signals (a progression-curve analyzer)

- **Perceived-challenge series:** if Cv, Cs, Pv, Ps are quantified per level/turn, compute
  (Cv+Cs)−(Pv+Ps) and report slope vs the intended difficulty curve.
- **Actual-vs-predicted gap:** model intended power-at-level; compare to observed; flag where players
  run **ahead** (content trivialized) or **behind** (grind wall).
- **Treadmill detector:** regress Cv against Pv; near-1:1 with flat net challenge = cosmetic
  "number-go-up." Distinguish real progression (Cs/Ps changing, new options) from inflation; detect
  False Progression (reward streams where new items aren't strictly better).
- **Curve-shape classifier:** fit to shapes (a)–(e); flag unintended (e).
- **Crossover detection:** where opposition outpaces power (frustration wall) or power runs away
  (trivial endgame) — *the same first-crossing primitive as cycle-005 FR-1, on the progression axis.*
- **Feedback-sign & timing:** classify dominant loop sign; flag **early positive feedback**
  (runaway risk); measure time-to-"already-won" vs actual end (anticlimax gap).
- **Sawtooth verification:** confirm entry-spike → flat → boss-spike → power-bump per area.

> **The unifying read & the cycle-005 hook:** progression balance asks **"does the curve track over
> time — and is the gap between predicted and actual power closing or diverging?"** This is exactly
> Hopson's progression-testing axis and exactly cycle-005's R1: the carmack difficulty sweep is
> incomplete until the relic/boost economy (a **positive feedback loop**, L2) is modeled and the
> *actual* power curve compared to the predicted one. FR-1's first-crossing primitive already
> applies here — point it at (Cv+Cs)−(Pv+Ps), not just TTK. **The same sweep engine serves both
> Hopson axes.**

## Where this feeds

- `knob-leverage-taxonomy.md` L2 — this *is* the loop theory (positive=amplify, early-dangerous;
  negative=dampen, late-effective; absolute vs relative keying).
- `/augury` resource-economy + a progression/`--curve` mode; cycle-005 FR-1 (shared crossing engine)
  and the R1 relic-economy attune.
- `/delve` — attrition curves are progression curves over a dungeon.
- `gygax-evolution-roadmap.md` — this is **Balance Type 4 of 4**, and the bridge to FR-4 loops.
