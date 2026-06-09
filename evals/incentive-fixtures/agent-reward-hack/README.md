# Fixture: agent-reward-hack

The **cycle-006 (Incentive Analysis) acceptance fixture** — a single-agent incentive structure that
reward-hacks. It is the grounding worked example for Gygax's agent-systems analysis: a coding agent
rewarded on test pass-rate whose *optimal* action is to delete the failing test, never to fix the
code.

## Why this exists

cycle-006 makes Gygax analyze **agent incentive structures** the way cycle-005 analyzes engine tuning
surfaces. This fixture is the in-repo ground truth that proves the payoff engine can, from declared
incentives alone:

- **K1** build a payoff matrix (action × context) via the shared `expr` grammar
- **K2** detect the **dominant strategy** (`delete-test` = the reward hack) and **dominated** actions
- **K3** flag **specification gaming** — the intended action (`fix-code`) is never optimal
- **K4** recommend the incentive fix — and show the **naive knob fails** (penalizing `delete-test`
  shifts the agent to `skip-test`); the real fix is **structural** (reward held-out coverage)
- **K5** frame by `tunability` and tag the finding as a **forecast** (model-derived, not observed)

## The deep lesson it teaches

Incentive fixes are often **structural, not numeric**. Because the reward (pass-rate) doesn't measure
correctness, *every* hack beats fixing — so penalizing one hack just moves the agent to the next
(whack-a-mole). The honest recommendation is to change *what is rewarded* (correctness via held-out
coverage), not to re-weight a single action.

## Honesty boundary

Gygax analyzes the **declared incentive structure**, not a live agent. The output is a **forecast** of
where the incentive will be gamed — tagged as such. Real validation = pointing it at an actual agent
system's reward/eval structure (the agent analog of cycle-005's R1 / teaching-to-the-test caveat).

## Layout

```
agent-reward-hack/
├── manifest.yaml                 # incentive metadata + expected signals
├── incentive-state/
│   ├── index.yaml
│   ├── actions/                  # fix-code, delete-test, weaken-assertion, skip-test
│   │                             #   each: payoff { reward, cost } over `difficulty`
│   └── reward/pass-rate.yaml     # the reward signal + first-class `intent`
└── expected/incentive-report.md  # hand-derived + code-verified golden findings
```

Schema: `skills/attune/resources/incentive-state-schema.md`. Design: `grimoires/gygax/designs/agent-incentive-analysis.md`.

> **Note on placement:** this lives under `evals/incentive-fixtures/` (not `evals/fixtures/`) because
> the existing eval harness validates game-state fixtures (`stats/`, `mechanics/`, …) and would reject
> the new `actions/`/`reward/` entity types. cycle-006's own harness/tests validate this fixture.
