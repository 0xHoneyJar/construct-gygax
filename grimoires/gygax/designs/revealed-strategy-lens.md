# Design: The Revealed-Strategy Lens — the Reality Plane for the strategy axis

**Status:** Built (cycle-012, sprints 35–37; branch `feat/cycle-012-revealed-strategy-lens`) · **Date:** 2026-06-18
**Sits under:** `gygax-evolution-roadmap.md` §4 (The Reality Plane), §2 Balance-2 (intransitive), §5a (epistemic honesty)
**Sibling of:** `awareness-ladder-experiment.md` — shares the observed-trace spine; asks a different question
**Origin / proof:** the Pokémon TCG AI Battle Challenge run (artifacts in `~/ptcg-agent`). This design is
back-formed from a real, multi-day iteration where every decisive move came from this exact lens — built
there as bespoke tooling. This is the generalization, with that run as the acceptance fixture.

---

## 1. The gap this closes

Cabal already forecasts the decision space. The structural pre-pass (`skills/cabal/SKILL.md` Step 2.7d,
the **Decision Point Map**) flags **dominant options** and **false choices**. But it does so by *reasoning
about the design* — a model inspecting an abstraction. Two models agreeing about an abstraction is the
**hall of mirrors** the awareness-ladder names (`awareness-ladder-experiment.md` §1): a forecast, not a
measurement. To know whether a choice the design *offers* is a real choice *in play*, you have to look at
choices made by deciders you didn't author — and **observe** them, not narrate them.

The roadmap already names the capability: **the Reality Plane** (§4 Foundational, §5a) — "ingest real
telemetry … to check models against reality." Today that's scoped to *outcome* telemetry (pick×win). The
revealed-strategy lens is the Reality Plane for the **decision itself**: not just *what won*, but *what was
chosen, when, given what was on offer* — the empirical pick-frequency that **Balance-2 (intransitive)**
needs and that Cabal currently only forecasts.

> Intent–reality is the spine. On the strategy axis the test is: **the design intends a set of live
> choices; does observed play reveal them as live — or as a single dominant line wearing a costume?**

## 2. The core principle

> Ingest a corpus of **real decisions** (option-set offered → option chosen, in context), extract the
> **revealed preference** (conditional pick-frequency), and **reconcile** it against (a) the forecast
> decision-space and (b) any candidate policy — tagging every finding *observed > forecast*.

A strong decider's actual choices are behavior we didn't author: that is the escape from the mirror. The
forecast (Cabal's Decision Point Map) is the prediction this measures against.

## 3. Worked example — the proof (PTCG-ABC, 2026-06-18)

We entered a Kaggle TCG competition. The iteration that actually moved us was this lens, built by hand:

- **Corpus.** Public replays of the top-ranked players — every decision is `{board-state, options
  offered, option chosen}`. Found telemetry; nothing we authored. (`tools/mine_top_decks.py`.)
- **Revealed preference.** Across 8–12 games of the #1 / #3 players on one deck, the pick-frequency over
  the turn's actions was **ATTACH 87% > EVOLVE 78% > PLAY 76% > ABILITY 44% > ATTACK 24%** — when several
  were legal, they attached energy **97–100%** of the time over everything else. (`tools/mine_pilot_policy.py`.)
- **Reconcile vs the forecast.** The design nominally offers a rich turn (play / evolve / attach / ability
  / attack). The revealed preference is a near-pure ordering — a **false choice in practice** the static
  read missed: the turn *is* "run the energy engine, then attack to end." On the strategy axis that is an
  off-equilibrium finding the forecast alone could not see.
- **Reconcile vs a candidate policy.** We diffed *our own agent's* implied ordering against the observed
  one. The gap was exact and mechanical: our policy ranked ATTACH **6th of 8**; the experts ranked it
  **1st**. That single diff — invisible to self-play, invisible to forecast — was the fix. (`tools/diagnose_our_games.py`.)
- **The cost of not having it.** We burned two live submissions (scores **393**, then **527**) discovering
  *by field result* what one pass of this lens told us in an afternoon. Gygax-native, the multi-day arc is
  a single reconciliation report.

Honest boundary the run also taught: **self-play — a forecast-vs-forecast simulation — did not predict the
field.** Two models agreeing is not a measurement (exactly §1). Only the observed corpus was.

## 4. What it ingests — the decision trace (extends the sidecar contract)

The awareness-ladder established a **sidecar** spine: artifact-grounded records of what an actor actually
did. This lens consumes the same spine, one record per *decision*:

```
{ actor_id, episode_id, t,
  context:  <game-state digest the choice was made in>,   # phase, board, resources — for conditioning
  offered:  [option, …],                                  # the legal set the system presented
  chosen:   <option> | [options],                         # what the actor selected
  outcome?: <result if known> }                           # optional → also feeds pick×win (existing Reality Plane)
```

**Source-agnostic by design.** The corpus may be *found telemetry* (competition replays, logged human
play), an *awareness-ladder batch* (real agents), or an *Arneson sim* (forecast). The schema is the
contract; **provenance sets the claim-strength tag** — same record shape, different epistemic weight.

## 5. What it computes

1. **Revealed preference** — conditional pick-frequency `P(chosen = A | A ∈ offered)`: the empirical
   ordering over option *types* and over specific options, **segmented** (skill tier, seat, game phase),
   never flattened to one average (roadmap §5a: *segment, don't average*).
2. **Reconciliation vs forecast** — diff the revealed ordering against the Decision Point Map:
   - forecast "false choice" **confirmed** by observed near-unanimity → a real false choice, now evidenced;
   - forecast "balanced" but observed near-pure → a **false choice the forecast missed** (off-equilibrium);
   - forecast "dominant" but observed mixed → the forecast **over-called**; correct it.
3. **Reconciliation vs a candidate policy** (optional) — diff a proposed (or one's own) policy's implied
   ordering against the observed one; emit the largest divergences as ranked, mechanical findings.

This is precisely Balance-2's "optimal-frequency vs intended-frequency divergence" (roadmap §2), **sourced
from reality** instead of solved in the abstract — the empirical half the intransitive engine (C-008) will
want anyway. The two compose: C-008 says what the equilibrium *should* be; this lens says what play *does*.

## 6. What it emits

Claim-tagged findings (`observed > simulation-derived > forecast` — always the first line of each):
- **False-choice-in-practice** `[observed]` — options the design offers that play collapses to one.
- **Revealed dominant line** `[observed]` — the actual strategy spine, with its conditional frequencies.
- **Forecast correction** — where the Decision Point Map's dominant/false-choice call disagrees with play.
- **Policy divergence** `[observed vs candidate]` — ranked gaps between a candidate policy and expert play.
- **No-divergence is a finding**, not a failure (awareness-ladder §9): "forecast and play agree — the
  design's choices are live as intended" is a real, valuable result, reported as-is.

## 7. How it reaches the user (the `/cabal` surface)

The observed-play family already lives on `/cabal`:
- `--incentives` — *forecast* where an incentive is gamed.
- `--observed` — *measure* whether agents **hacked a reward** (artifact: file diffs + a test re-run).
- **NEW · `--observed --strategy <corpus>`** (alias `--revealed`) — the same seam, a **second classifier**:
  not "did they cheat the metric" but "what strategy did they reveal," reconciled against the Decision
  Point Map. A thin shell over a `scripts/lib/trace/` extractor, exactly as `--observed` is today.

No new archetype machinery. The **Optimizer** archetype gains a factual backbone: instead of *forecasting*
the dominant line, it can be shown the **observed** one and asked where the design's other options went.

## 8. Honest boundaries

- **Analyst, not author.** This reads a corpus and reconciles; it does **not** write the policy/agent that
  produced the corpus. (In the proof, the agent lived in a separate repo; Gygax only analyzed — the
  standing construct boundary.)
- **Read-only** against game-state; findings are hypotheses (Cabal's standing rule).
- **Corpus quality is the ceiling.** Revealed preference of *weak* play reveals weak strategy. Tag the
  tier; a finding from expert play and from flailing play are different claims. Segment, don't average.
- **Revealed ≠ optimal.** Players reveal *what they do*, which may be convention, not the true optimum. The
  lens reports the empirical equilibrium; *calling* it optimal is the intransitive engine's job (C-008),
  not this one. Keep the claim honest.
- **Provenance sets claim strength.** Found telemetry and real-agent batches are `observed`; an Arneson sim
  corpus is `forecast` — same schema, different tag, **never blended** (awareness-ladder §9, roadmap §5a).

## 9. What we'd build (FRs, when greenlit)

1. **Revealed-preference extractor** — `scripts/lib/trace/` consumes a decision-trace corpus → conditional,
   segmented pick-frequencies. (Generalize the bespoke PTCG `mine_pilot_policy.py`.)
2. **Reconciler** — diff revealed preference vs the Decision Point Map (and vs an optional candidate
   policy) → claim-tagged findings. (Generalize `diagnose_our_games.py`.)
3. **`/cabal --observed --strategy` shell** — load corpus, run extractor + reconciler, fold findings into
   the report under a **Revealed Strategy** section beside Decision Points.
4. **Acceptance fixture** — ship the PTCG decision-traces (in hand) as the golden case: the lens must
   reproduce *"ATTACH is the revealed #1; the design's turn is a false choice in practice; the candidate
   policy mis-ranks ATTACH 6→1."* Cycle-005 discipline: prove the capability on one real case, don't boil
   the ocean.

## 10. Related capabilities (same run, same spine — candidate sibling FRs)

- **Execution-complexity / skill-floor lens.** The PTCG run also produced a strategy *complexity*
  classifier — how many coordinated pieces/turns a winning line needs (`tools/classify_decks.py`). It
  answers a different roadmap question, "strong on paper, unplayable in hand," and extends Gygax's
  scaling-failure analysis onto the **skill axis** (a card balanced for an expert can be dead for a
  novice). Natural C-012b; pairs with the awareness-ladder's novice→expert depth curve.
- **Prediction tracking.** Have every `/augury` and `/cabal` claim emit a *falsifiable prediction +
  validation method*, scored when a corpus arrives. This makes roadmap §5a (claim-strength as identity) a
  *loop* and §5b (intent first-class) operational on the prediction side. The reconciler above is its first
  consumer — it turns "Bellibolt will be top-tier" from an assertion into a settled bet.

## 11. Pointers

- Roadmap: `gygax-evolution-roadmap.md` — §2 (Balance-2 intransitive), §4 (Reality Plane), §5a (epistemics).
- Sibling: `awareness-ladder-experiment.md` — the sidecar/trace spine; the reward-hack question.
- Surface: `skills/cabal/SKILL.md` — Step 2.7d Decision Point Map; the `--observed` / `--incentives` modes.
- Seam to extend: `scripts/lib/trace/`, alongside `scripts/lib/payoff/`.
- Proof artifacts (read-only reference, not a dependency): `~/ptcg-agent` —
  `tools/mine_pilot_policy.py` (extractor), `tools/diagnose_our_games.py` (reconciler),
  `strategy/pilot-policy-analysis.md`, `strategy/metagame-map.md`, `CONTEXT.md` (the full arc).
