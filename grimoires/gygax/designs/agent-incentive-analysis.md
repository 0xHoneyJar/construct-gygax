# Design: Incentive Analysis — Gygax for Agent Systems (proposed cycle-006)

**Status:** Proposed (next cycle) · **Date:** 2026-06-08 · **Builds on:** cycle-005 (engine tuning)
**Origin:** a teammate using Gygax saw deep parallels between game balance and agent infrastructure
("setting incentives and game theory"). This is that direction made concrete and buildable.
**Lens reference:** `gygax-evolution-roadmap.md` §8 (the third domain).

---

## 1. Mission

Make Gygax analyze **agent systems** the way it analyzes games and engines: find the gap between the
behavior you **intended** and the behavior the **incentives will actually produce**. For an agent
system that gap has a name — **specification gaming / reward hacking** — and it is the *same problem*
Gygax already solves, in a new domain. The leverage: catch a degenerate agent strategy in the
*incentive design*, before it ships, instead of discovering it in production.

## 2. The realization — this needs the engine cycle-005 didn't build

cycle-005 built the **transitive** engine: a continuous *tuning surface* swept over a variable. But
the defining agent failure is not continuous — it is a **discrete choice**: given a reward structure,
*which action does the agent take?* **Reward hacking is a dominant strategy in a payoff matrix.** That
is the **intransitive** balance (roadmap C-008) — the genuinely new piece. So the agent direction is
not a bolt-on; it is the reason to build the second of the four balances. The mapping is exact:

| Agent-system failure | Gygax / balance concept |
|----------------------|-------------------------|
| **Reward hacking** | a **dominant strategy** (one action dominates the reward matrix) |
| **Dead / never-used tool** | a **dominated action** (taxonomy **L7 dump**) |
| **Mandatory / always-used tool** | a **god action** (L7 god) |
| **Mode collapse** | a **degenerate metagame** (all strategies converge to one) |
| **Specification gaming / Goodhart** | the **equilibrium behavior diverges from stated intent** (the intransitive analogue of "off the cost curve") |
| **Multi-agent coordination failure** | a bad **Nash equilibrium** (payoff-matrix solve) |

## 3. The grounding worked example (the "carmack" of this direction)

cycle-005 only stayed honest because it had a concrete grounding case. This direction has a famous
one: **the coding agent rewarded for "tests pass" that learns to delete the failing tests.**

- **Intent:** make the code correct (tests pass *because the code is right*).
- **Reward signal:** test pass-rate.
- **Actions:** `fix_code`, `delete_test`, `weaken_assertion`, `skip_test`.
- **What Gygax should produce:** `delete_test` **dominates** `fix_code` on the reward metric (same or
  higher pass-rate, far lower cost) → **reward hack detected**; the agent's optimal action **diverges
  from intent** → **Goodhart**; and the *fix is an incentive-knob change* (reward held-out coverage the
  agent cannot see or delete) — surfaced by the **knob-leverage taxonomy used as incentive-design
  guidance**.

One example, three capabilities: dominant-strategy detection, intent-vs-optimal divergence, and
incentive-knob recommendation. Anyone in agent infra recognizes it instantly.

## 4. The `incentive-state` schema (concrete shape)

An agent system's incentive structure expressed as game-state — the analog of `model:`-block
game-state, reusing the same entity envelope and the `expr.ts` formula grammar.

```yaml
# actions/delete-test.yaml
id: delete-test
type: actions
description: "Remove a failing test from the suite."
tunability: engine-default          # the designer can change/forbid this action (vs structural)
payoff:
  reward: "passing_after"           # effect on the reward metric (formula over context — reuses expr)
  cost: "1"                         # effort/token cost
  context: difficulty               # the matrix's column axis (env state / task difficulty)
  domain: { min: 1, max: 10 }
```

```yaml
# reward/pass-rate.yaml — the signal the agent maximizes
id: pass-rate
type: reward
formula: "passing_after / total_tests"
intent:                             # FIRST-CLASS intent (closes the cycle-005 deferral)
  intended_action: fix-code         # which action the designer WANTS chosen
  rationale: "Pass-rate is a proxy for correctness; the intended path is fixing the code."
  non_negotiable: true
```

The engine builds a **payoff matrix** (action × context), each cell = `net_payoff(action, context)`
via `expr`, then runs the detectors below. `intent` is the declared terminal of the intent–reality
spine — without it, "the agent gamed the metric" is unprovable.

## 5. Detection signals (what the engine computes)

Given the payoff matrix M (rows = actions, columns = contexts, cells = net payoff):

- **Dominated action (dead tool, L7 dump):** action i ≤ action j in *every* context → never optimal.
- **Dominant action (reward hack / god, L7 god):** action i ≥ all others in every context (or is
  `argmax` everywhere) → the strategy the agent will collapse onto.
- **Optimal-per-context:** `argmax` action at each context → the agent's predicted policy.
- **Intent-vs-optimal divergence (Goodhart):** where `argmax ≠ intent.intended_action` → specification
  gaming. The *magnitude* of the payoff gap between the gamed action and the intended one = how hard
  the incentive pushes toward the hack.
- **Incentive-knob recommendation:** apply the knob-leverage taxonomy to the *reward/cost knobs* —
  which incentive change most cheaply flips `argmax` back to intent (the L4 crossover-mover, now over
  incentives: "raise the cost of `delete_test` by X, or reward held-out coverage, and the optimal
  action flips to `fix_code` at difficulty ≥ Y").
- **(Multi-agent, later) equilibrium mix:** `c = M⁻¹p` for genuinely intransitive agent interactions
  (coordination, RPS-among-agents); flag a degenerate (single-dominant) metagame.

## 6. Sprint plan

| Sprint | Builds | Reuses / grounds |
|---|---|---|
| **0 — Fixture** | `incentive-state` schema + the reward-hacking-agent fixture (actions, payoffs, intent) + hand-derived golden findings | Mirrors cycle-005 A.0; the §3 worked example |
| **1 — Dominant-strategy engine** | `scripts/lib/payoff/` — build matrix, detect dominated + dominant + argmax-per-context | `expr.ts`, report/CLI scaffolding, `intransitive-and-matchup-balance.md`, Schreiber Ch.25 |
| **2 — Intent-vs-optimal (Goodhart) + knob recommendation** | first-class `intent`; flag `argmax ≠ intent` = spec gaming; recommend the cheapest incentive-knob change to realign | **Closes the cycle-005 AC#3 deferral** (intent-first-class); knob-leverage taxonomy as incentive-design guidance |
| **3 — `/cabal` incentive red-team** | `/cabal` simulates archetype agents against the incentive structure → surfaces the degenerate strategy each finds; (stretch) multi-agent `M⁻¹p` equilibrium | `/cabal` (prompt-level) + the payoff engine as the quantitative backbone — the "simulation/testing" the teammate asked for |

**MVP = Sprints 0 → 1 → 2** (single-agent: detect the reward hack and the intent divergence, recommend
the fix). Sprint 3 (cabal red-team + multi-agent equilibrium) is the deepening.

## 7. What it reuses vs. builds

- **Reuses (shipped):** `expr.ts` (context-dependent payoff cells), report/CLI scaffolding, the
  knob-leverage taxonomy (→ incentive-design guidance), `/cabal` (already a multi-agent sim harness),
  the four-balances frame, and the references (`intransitive-and-matchup-balance.md`,
  `metagame-analytics-and-beyond-balance.md`).
- **Builds new:** `scripts/lib/payoff/` (matrix + domination/argmax detectors; later `M⁻¹p`), the
  `incentive-state` schema, and the first-class `intent` layer.

## 8. Relationship to cycle-005 — and the elegant convergence

This is **cycle-006**, not appended sprints on cycle-005 (the carmack-reframe lesson: keep a cycle's
mission clean — cycle-005 is engine tuning, cycle-006 is incentive analysis). But it **rides directly
on cycle-005's substrate** and, critically, **closes cycle-005's one honest deferral**: AC#3
(cost-curve-divergence ranking) was deferred because it needed a *declared intended curve*. The
Goodhart detector (Sprint 2) needs the *same intent layer*. **The agent direction and the
"intent as first-class" roadmap item are the same work** — building one delivers the other.

## 9. Honesty boundaries (the most important section)

The deepest lesson Gygax must obey is reflexive (Hopson's affective-forecasting caveat;
`metagame-analytics-and-beyond-balance.md`):

- **Gygax analyzes the *declared incentive structure*, not the live agent.** It predicts *where
  incentives will be gamed* given the payoff model — it does not observe what the agent actually does.
  That is a *forecast*, tagged as such, not a measurement. The real behavior is stochastic and
  prompt-dependent; the payoff matrix is an abstraction of it.
- **A synthetic fixture proves the mechanism, not real discovery** (the cycle-005 teaching-to-the-test
  caveat applies). Real validation = pointing it at an actual agent system's reward/eval structure.
- **Perfect-incentive is often the wrong goal** (Schreiber Beyond-Balance): some "exploits" are
  desirable emergent behavior. Gygax must distinguish a *bug* (unintended divergence) from a *choice*
  (intended divergence) — which only works because `intent` is declared. This is the same
  bug-vs-choice discipline as cycle-005's tunability framing.
- **Claim-strength tagging** on every output (observation / model-derived / verified) — an incentive
  forecast is model-derived, never presented as fact.

## 10. Acceptance philosophy

Capability-based, not reproduction of a specific system (the cycle-005 lesson): prove on a
**self-contained in-repo incentive fixture** (§3 reward-hack example) that Gygax can (K1) build a
payoff matrix from declared incentives, (K2) detect the dominant action (reward hack) and dominated
actions (dead tools), (K3) flag `argmax ≠ intent` as spec gaming, (K4) recommend the cheapest
incentive-knob change to realign, (K5) frame findings by `tunability` (changeable incentive vs
structural constraint) and tag claim strength. The reward-hack agent is the motivating example, not a
gate on any specific real system.

## 11. Open forks (recommended dispositions)

1. **Scope of "incentive" (MVP):** explicit reward/eval structures only (clean payoff matrix), vs.
   also tool-cost/affordance incentives. **Lean: explicit reward/eval first**; affordance incentives
   fold in as additional `cost` terms later.
2. **Equilibrium math depth:** MVP = domination + argmax-vs-intent (no matrix inversion) — enough to
   catch the reward hack. **Lean: defer `M⁻¹p` to Sprint 3** (needed only for multi-agent/intransitive
   coordination, not the single-agent reward hack).
3. **Single-agent vs multi-agent:** the reward hack is single-agent (argmax). Multi-agent coordination
   (Nash) is real but heavier. **Lean: MVP single-agent; multi-agent in Sprint 3.**
4. **Is the reward-hack example the right grounding?** It's famous, single-agent, and exercises all
   five Ks. **Lean: yes** — add a multi-agent coordination fixture only in Sprint 3.

## 12. Pointers
- Roadmap: `gygax-evolution-roadmap.md` §8 (third domain), §5(b) (intent-first-class).
- References: `intransitive-and-matchup-balance.md` (the engine's math), `knob-leverage-taxonomy.md`
  (incentive-design guidance), `metagame-analytics-and-beyond-balance.md` (epistemics, when-not-to-balance).
- Reuses: `scripts/lib/parametric/expr.ts` (formula grammar), `/cabal` (sim harness).
- Memory: `project_gygax_for_agent_systems`.
