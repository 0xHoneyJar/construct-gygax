# Reference: Intransitive & Matchup Balance — Payoff Matrices (Schreiber & Romero 2021)

Attributed synthesis for Gygax's **second kind of balance**: the matchup/strategy space the cost
curve *cannot* describe. Concepts paraphrased in our own words with citations to *Game Balance*
(CRC Press 2021), Ch.23 "Situational Balance", Ch.25 "Intransitive Mechanics and Payoff Matrices",
Ch.37 "Matrix Functions" (the computational appendix).

**Why it matters to Gygax:** `game-balance-cost-curves.md` + `knob-leverage-taxonomy.md` assume a
**total order** — better costs more, plottable on a curve. Intransitive sets break that: A>B>C>A is
a *cycle*, so "amount of better" has no axis to price against. The output of balancing them is not a
price but a **frequency** — how often each option should be played. This is a whole analytical
engine Gygax does not yet have. Feeds: `/augury` (a future intransitive mode), `/cabal` (the
Optimizer archetype reasons in payoff matrices), `/lore` (degenerate/dominant-strategy archetypes).

---

## Transitive vs intransitive — the dividing line

- **Transitive** (Ch.8): total order; balance = a cost curve. **Intransitive** (Ch.25): cyclic
  dominance; "no choice is strictly better or worse than the others," so **"it can't be a cost
  curve"** (Ch.25, "Solving Intransitive Mechanics"). RPS is canonical — the value of "Rock" is
  meaningless in isolation; it depends on what the opponent throws.
- **The solution is a frequency ratio, not a price.** Balancing an intransitive set yields a target
  usage mix ("30% archers, 50% infantry, 20% fliers"). Designers shift the mix by tuning relative
  cost/availability — you can make a unit *rare-but-spectacular* by costing it so its optimal play
  frequency is low (Ch.25).

## Payoff matrices — the tool

- **Structure** (Ch.25, "Solving Basic RPS"): a table from one player's view. Rows = your options,
  columns = opponent's; each cell = your net result (win +1 / loss −1 / draw 0; any scale works,
  and cells can carry asymmetric costs, e.g. Knight-vs-Archer = +65 gold after unit costs).
- **Expected value form** (Ch.25 + Ch.37): treat the opponent's column choices as a probability
  vector **c**; each row's payoff = Σ(cell × c). In matrix form **M·c = p**. Solve the equilibrium
  with **c = M⁻¹·p** (`MINVERSE`/`MMULT` in the Ch.37 appendix — the most directly implementable
  part).
- **Balanced-matrix test (Theorem 2):** *"Among the set of all strategies worth choosing at all,
  each strategy has the same payoff."* If one were higher, players pick only it; if lower, they
  abandon it. In a symmetric zero-sum game that common payoff is exactly **0** (Theorem 3).
- **Domination (Theorem-level):** row i dominates row j if M[i][k] ≥ M[j][k] for *every* column k
  (strict if also > somewhere). A dominated row should never be played ("Paper is dominated by
  Dynamite") and must be deleted, with its mirror column, before solving — otherwise the solve
  yields probabilities <0 or >1.

## Mixed strategy / optimal frequency / equilibrium

- The solution is a **mixed strategy** — a probability distribution over options (1:1:1 for plain
  RPS). It is *not* "play randomly"; it's the long-run ratio a skilled player approximates while
  exploiting opponent deviations. Any sustained deviation hands the opponent a winning counter
  (Ch.25, "Toward a Steady State"). The equal-payoff steady state **is** the mixed-strategy Nash
  equilibrium (the book names Nash once, in the Malkav footnote; it mostly says "steady state").
- **Imbalance magnitude X:** solving an asymmetric matrix yields X = the per-round expected
  advantage (the "Rock-On!" card: X = 1/12 → ~1 extra win per 12 games). Σ X over players tells
  whether the game is zero / positive / negative-sum. **X is a direct, quantified imbalance score.**
- **Non-local cost effects:** changing one option's cost shifts the *others'* frequencies, often
  counterintuitively (doubling Rock's win value gives optimal 1:2:1 favoring **Paper**). Local
  number changes propagate through the whole cycle — you cannot tune one matchup in isolation.
- **Fragility & the "emergency brake":** intransitive sets are fragile — a slightly suboptimal
  opponent enables a fully dominant pure counter. Conversely, intransitivity guarantees any single
  dominant option *has* a counter, letting the metagame self-correct — but the book calls relying on
  that alone "lazy design" (Ch.25).
- **Best-response loop reduction:** for large/asymmetric matrices, trace best responses until they
  settle into a cycle; options outside the loop are effectively dominated and prunable (Malkav
  reduced 6×5 → 3×3).

## Situational balance (Ch.23) — value that swings with state

- A thing must carry **one fixed cost** even though its benefit changes with context (AoE vs swarm;
  healing worthless at full HP, near-infinite when dying). Balance method = **expected value across
  situations**: Σ(P(situation) × value-in-situation). Drawbacks can be *negative* (a
  half-damage-vs-trolls sword: value −250 in 5% of fights). Bound by best/worst case too, not just
  the mean. *"How do we balance something that must have a fixed cost, even though its benefit
  changes?"* (Ch.23).
- **Versatility & switching cost:** *"the value of foreknowledge is inversely proportional to the
  cost of switching."* Free instant swapping makes a pile of specialists beat a generalist; high
  switch cost flips it. You can rebalance a whole loadout system by tuning **only the switch cost**.
- **Diminishing returns on coverage:** with free swapping, a new specialist is worth only what it
  *adds* beyond the existing collection (1.5×→2× ≪ 1×→2×). Late specialists should cost less.
- **Sideboard/deck asymmetry:** an option brought in *only when relevant* operates near 100%
  effectiveness, so naive "frequency × benefit" badly undercosts it. Effects keyed to *your own*
  deck-buildable conditions ("destroy all non-Mechs") are far stronger than mirror effects on the
  opponent's, even when 90% vs 10% look symmetric — because you control your deck, not theirs.
- **Shadow costs:** the costs that dominate situational balance — **sunk costs** (prerequisite
  tech/buildings, amortized over expected future uses) and **opportunity costs** (an action locks
  out others / reduces future versatility). Forget these and "costs feel wrong and you won't know
  why."

## Tool-computable detection signals

A Gygax intransitive engine, given a payoff matrix M (rows = options, cells = net outcome):
- **Dominated-strategy flag:** row i ≥ row j in all columns → j is a false choice ("never optimal").
- **Runaway-dominance flag:** a row dominating all others, or whose solved frequency → ~1.0 (forcing
  others to 0/negative) → degenerate metagame.
- **Equilibrium solve:** build M, set p per Theorem 2/3, compute **c = M⁻¹p**, normalize Σc = 1 →
  optimal play-frequency per option.
- **Intent-vs-equilibrium divergence:** compare solved frequency to the designer's intended mix;
  divergence direction/magnitude says *which* cost to raise or lower. (This is the intransitive
  analogue of "off-curve divergence" — the same intent-vs-reality spine.)
- **No-unique-solution / redundancy:** an all-zero row in elimination, two identical rows, or a
  non-invertible M ⇒ infinitely many optima ⇒ a redundant/ignorable option (the "Jackhammer" case).
- **Out-of-range probabilities (<0 or >1):** undetected domination present → run elimination, re-solve.
- **Imbalance magnitude:** solve for X; |X| quantifies how unfair the matchup is; Σ X classifies sum-type.
- **Situational EV checker (Ch.23):** Σ(P(situation)×value); alternatives are balanced iff EVs equal;
  flag strongly-negative worst case (liability) or sideboard/deck-controllable options (true
  frequency ≈ 100% → undercost risk).

> **The unifying read:** transitive balance asks *"is it priced right?"* (off-curve divergence);
> intransitive balance asks *"is it played at the right frequency?"* (off-equilibrium divergence).
> Both are the **same intent-vs-reality test** on different mathematics. A god/dump knob (taxonomy
> L7) and a dominated strategy are the same disease — a false choice — diagnosed by two engines.

## Where this feeds

- `knob-leverage-taxonomy.md` — adds **matchup leverage** (a knob that shifts equilibrium frequency,
  not curve position); L7 god/dump ≡ dominated strategy.
- `/augury` — a future **intransitive/`--matrix` mode** (solve M⁻¹p, flag domination/divergence).
- `/cabal` — the Optimizer archetype's native reasoning; payoff-matrix expectation per matchup.
- `/lore` — degenerate-strategy & dominant-strategy archetypes (`design-failure-postmortem.md`).
- `gygax-evolution-roadmap.md` — this is **Balance Type 2 of 4**.
