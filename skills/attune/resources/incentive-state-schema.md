# Gygax Incentive-State Schema (cycle-006)

The **incentive-state** expresses an agent system's incentive structure as analyzable game-state — the
agent-systems analog of game-state with `model:` blocks. It reuses the same entity envelope and the
`expr` formula grammar (`scripts/lib/parametric/expr.ts`: `+ - * / %`, `floor/ceil/min/max/abs`,
declared names, never `eval`).

> **What Gygax does with it:** builds a payoff matrix (action × context), detects the dominant
> strategy (reward hack), dominated actions (dead tools), and where the agent's optimal action
> diverges from declared intent (specification gaming) — then recommends the incentive fix. Output is
> a **forecast** (model-derived), tagged as such, never an observation of a live agent.

## Entity Type: `actions/`

The agent's available actions/tools. The agent is modeled as choosing the action that maximizes
`net = reward − cost` at each context.

```yaml
id: delete-test
type: actions
description: "..."
tunability: engine-default | structural   # changeable incentive vs fixed engine constraint
payoff:
  context: difficulty            # the matrix column axis (an environment-state variable)
  domain: { min: 1, max: 10 }    # finite, bounded
  reward: "1"                    # effect on the reward signal (formula over context — reuses expr)
  cost: "1"                      # effort/token/latency cost (formula over context)
```

- `reward` and `cost` are `expr` formulas over the declared `context` variable (and may reference
  other declared names). `net = reward − cost` is computed by the engine.
- `tunability`: `engine-default` = an incentive the designer can re-weight or forbid; `structural` =
  a fixed property (e.g. the agent's actual capability) that must NOT be proposed as a knob.

## Entity Type: `reward/`

The signal the agent maximizes, plus the **first-class intent**.

```yaml
id: pass-rate
type: reward
formula: "passing / total"        # informational — the underlying signal
tunability: engine-default
intent:                           # the behavior the designer ACTUALLY wants
  intended_action: fix-code       # which action should be optimal
  rationale: "Pass-rate is a proxy for correctness; the intended path is fixing the code."
  non_negotiable: true            # if true, divergence is a bug, not a tolerated choice
```

`intent` is the declared terminal of the intent–reality spine. Without it, "the agent gamed the
metric" is unprovable. (This is the same first-class intent the cycle-005 AC#3 deferral needs.)

## `index.yaml`

```yaml
system: "..."
domain: agent-system
context: { name: difficulty, domain: { min: 1, max: 10 } }
reward_signal: reward/pass-rate.yaml
actions: [actions/fix-code.yaml, actions/delete-test.yaml, ...]
```

## Detection signals (what the engine computes)

| Signal | Meaning |
|--------|---------|
| **Dominated action** (≤ another in every context) | a **dead tool** (taxonomy L7 dump) |
| **Dominant action** (≥ all others everywhere / argmax) | the **reward hack** (L7 god) |
| **argmax ≠ `intent.intended_action`** | **specification gaming / Goodhart** |
| gap between gamed and intended payoff | *how hard* the incentive pushes toward the hack |
| cheapest knob that flips argmax back to intent | the incentive-knob recommendation (L4 over incentives) |
| (multi-agent, later) equilibrium mix `c = M⁻¹p` | expected behavior distribution; degenerate metagame flag |

## Honesty boundary

Gygax analyzes the **declared** incentive structure, not the live agent — a *forecast*, tagged with
claim strength, never a measurement. Some divergences are *desired* emergent behavior; only a declared
`intent` lets Gygax tell a **bug** from a **choice** (the same discipline as `tunability` framing).

## Backwards compatibility

The incentive-state is a separate construct from game-state — it does not change `game-state-schema.md`
or any existing analysis. See `grimoires/gygax/designs/agent-incentive-analysis.md` for the full design.
