# Fixture: parametric-depth-scaling

The **cycle-005 (Engine-Tuning Support) acceptance fixture** — a self-contained,
content-agnostic "wave-survival" depth engine whose balance lives in tunable
formulas rather than fixed stat blocks.

## Why this exists (and why it is self-authored)

Acceptance for cycle-005 is **capability-based**, not reproduction of any specific
game. This fixture is the cycle's own ground truth: it proves the parametric
engine can do K1–K5 from formulas alone, with every value present in-repo.

- **K1** safe formula evaluation (whitelisted arithmetic + `floor/ceil/min/max/abs`, never `eval`)
- **K2** declared-threshold first-crossing (`time_to_kill > 8` at wave 5)
- **K3** threshold-free spike detection (envelope spike at wave 16) **and** its
  negative case (`enemy_armor` stair-steps must NOT be flagged)
- **K4** knob-leverage ranking (enemy-armor > player-attack ≫ heal-value)
- **K5** engine-default vs structural framing (the `max(1, …)` floor is structural)

## On carmack-engine

The carmack-engine dogfooding finding *motivated* this cycle ("an engine Gygax
tried to tune without being prepared for it"), but its real numbers live downstream
in `project-purupuru/carmack-engine` and are **not** required here. They are
illustration only. Binding acceptance to them was the original mis-specification
(R-GROUND, resolved). If that game-state is ever ported in, add it as a sibling
`carmack-engine-depth-scaling/` fixture for *optional* real-world validation.

## Honest caveat

A self-authored fixture proves the **mechanism** works; it cannot prove Gygax
finds *surprising real* problems (a synthetic fixture risks teaching-to-the-test).
Real-engine validation stays a downstream activity and ties to R1 (difficulty-vs-
progression testing on an actual economy).

## Layout

```
parametric-depth-scaling/
├── manifest.yaml                 # parametric metadata + expected signals
├── game-state/
│   ├── index.yaml
│   ├── stats/                    # player-attack, enemy-armor, enemy-hp,
│   │                             #   enemy-attack, player-max-hp, heal-value
│   ├── mechanics/damage-formula.yaml   # STRUCTURAL: max(1, atk - def)
│   └── progression/encounter-scaling.yaml  # variable, metric defs, thresholds
└── expected/sweep-report.md      # hand-derived + code-verified golden output
```

See `expected/sweep-report.md` for the full swept table and the derivation proof.
