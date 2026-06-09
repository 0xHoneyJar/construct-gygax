# Golden Output — Multi-Agent Coordination Analysis (agent-coordination)

> **FORECAST (model-derived).** Predicts the equilibrium behavior of the declared incentive, not a
> live multi-agent run. Hand-derived + code-verified from the payoff matrix.

Symmetric 2-player game. `payoff_matrix[my][their]` = my payoff.

| my \ their | cooperate | defect |
|------------|----------:|-------:|
| **cooperate** | 3 | 0 |
| **defect** | 5 | 1 |

## Findings

- **Dominant strategy (each agent): `defect`** — better regardless of the opponent (5 > 3 if they
  cooperate; 1 > 0 if they defect).
- **Dominant-strategy equilibrium: `(defect, defect)`** → payoff **1 each**.
- **Intended joint action: `(cooperate, cooperate)`** → payoff **3 each**.
- **Coordination failure:** equilibrium ≠ intent. The individual-landing reward drives both agents to
  defect, even though cooperating is better for both.
- **Price of anarchy = 3.0** (intended payoff 3 ÷ equilibrium payoff 1); **2 units of value left on
  the table per agent.**
- **Fix (structural):** the reward is individual; cooperation is dominated. Reward the **joint/team
  outcome** (shared credit for a clean solution) so cooperation is no longer dominated — a change to
  *what is rewarded*, not a per-action penalty.

## Derivation

```
defect vs cooperate:  vs C: 5>3 ✓   vs D: 1>0 ✓   → defect strictly dominant for each player
equilibrium = (defect, defect) = 1 each
intended    = (cooperate, cooperate) = 3 each
price of anarchy = 3 / 1 = 3.0 ;  value left on table = 3 − 1 = 2 per agent
```
Code-verified 2026-06-08.
