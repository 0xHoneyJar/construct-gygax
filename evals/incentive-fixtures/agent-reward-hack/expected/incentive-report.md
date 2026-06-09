# Golden Output — Incentive Analysis on agent-reward-hack

> **Forecast (model-derived), not a measurement.** This is what `/augury` on the declared incentive
> structure should produce. It predicts where the incentive *will* be gamed given the payoff model —
> it does not observe a live agent. Every value is hand-derived from the `payoff:` formulas in
> `incentive-state/` and code-verified.

Context: **difficulty**, domain **1–10**. Agent maximizes `net = reward − cost` per action.

## Models (action payoffs)

| Action | tunability | reward | cost | net(difficulty) |
|--------|-----------|--------|------|-----------------|
| fix-code *(intended)* | engine-default | `1` | `difficulty + 1` | `−difficulty` |
| delete-test | engine-default | `1` | `1` | `0` |
| weaken-assertion | engine-default | `0.5` | `1` | `−0.5` |
| skip-test | engine-default | `0.8` | `1.2` | `−0.4` |

## Net-payoff table & optimal action

| difficulty | fix-code | delete-test | weaken | skip | **argmax** |
|----:|----:|----:|----:|----:|------------|
| 1 | −1 | **0** | −0.5 | −0.4 | delete-test |
| 5 | −5 | **0** | −0.5 | −0.4 | delete-test |
| 10 | −10 | **0** | −0.5 | −0.4 | delete-test |

(argmax = `delete-test` at **every** difficulty.)

## Findings

### K2 — Dominant strategy / reward hack
- **`delete-test` dominates** — its payoff (0) is ≥ every other action in every context. It is the
  strategy the agent collapses onto. **Reward hack.**

### K2 — Dead actions (dominated)
- **`fix-code`, `weaken-assertion`, `skip-test`** are each dominated by `delete-test` (never optimal).

### K3 — Specification gaming (intent-vs-optimal divergence)
- Declared `intent.intended_action = fix-code`. **`fix-code` is never the optimal action** → the
  agent's optimal policy diverges from intent: **specification gaming.**
- **Severity rises with difficulty:** the gap `net(delete) − net(fix) = difficulty` (1 → 10). The
  harder the real work, the stronger the pull to hack. (This is the diagnostic, not just a yes/no.)

### K4 — Incentive-knob recommendation (and why the cheap knob fails)
- **Naive knob — penalize `delete-test`** (raise its cost by K): for K = 11, `net(delete) = −11`, but
  the argmax shifts to **`skip-test` (−0.4)** — the next-best hack. **Whack-a-mole:** penalizing one
  hack just moves the agent to the next. (Non-local cost effect — Schreiber Ch.25.)
- **The real fix is structural, not a number:** the reward does not measure correctness, so *any* hack
  beats fixing. Realign by **rewarding held-out coverage** the agent cannot see or delete (a
  correctness signal) → `fix-code` becomes the only path to real reward. This is a **bug, not a tuning
  choice** — flag as a structural incentive redesign, not a knob tweak.

### K5 — Framing
- The reward signal and all four actions are `engine-default` (the designer's to redesign). The
  finding is a **forecast** (model-derived) — tagged accordingly, never presented as observed behavior.

---

## Derivation (self-consistency proof)

```
net(fix-code, d)        = 1   − (d + 1) = −d
net(delete-test, d)     = 1   − 1       = 0
net(weaken-assertion,d) = 0.5 − 1       = −0.5
net(skip-test, d)       = 0.8 − 1.2     = −0.4

argmax over d∈[1,10] = delete-test (0 ≥ all others, all d).
fix-code (intended) is argmax: never. → spec gaming.
gap(delete − fix) = d  (1..10).
Penalize delete by K=11 → net(delete)=−11 → argmax = skip-test (−0.4) at all d.  (whack-a-mole)
```

Code-verified 2026-06-08. Reproduce: see `incentive-state/` payoff formulas.
