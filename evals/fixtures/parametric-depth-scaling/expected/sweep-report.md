# Golden Output — `/augury --sweep` on parametric-depth-scaling

> **This is the expected output the Sprint-B/C engine must reproduce from the
> fixture formulas alone.** Every number below is hand-derived from the `model:`
> formulas in `../game-state/` and code-verified (see the derivation block at the
> end). No value comes from outside this repo.

Progression variable: **wave**, domain **1–20**.

## Models (entity formulas)

| Entity | tunability | formula |
|--------|-----------|---------|
| player-attack | engine-default | `12` |
| enemy-armor | engine-default | `min(4, floor(wave/4))` |
| enemy-hp | engine-default | `60 + 6*wave + 200*floor(wave/16)` |
| enemy-attack | engine-default | `3 + floor(wave/5)` |
| player-max-hp | engine-default | `120` |
| heal-value | engine-default | `20` |
| damage-formula | **structural** | `max(1, player_attack - enemy_armor)` |

## Swept metric table

| wave | armor | dmg | enemy_hp | **time_to_kill** | Δttk | incoming_per_kill |
|----:|----:|----:|----:|----:|----:|----:|
| 1 | 0 | 12 | 66 | 6 | — | 18 |
| 2 | 0 | 12 | 72 | 6 | +0 | 18 |
| 3 | 0 | 12 | 78 | 7 | +1 | 21 |
| 4 | 1 | 11 | 84 | 8 | +1 | 24 |
| 5 | 1 | 11 | 90 | **9** | +1 | 36 |
| 6 | 1 | 11 | 96 | 9 | +0 | 36 |
| 7 | 1 | 11 | 102 | 10 | +1 | 40 |
| 8 | 2 | 10 | 108 | 11 | +1 | 44 |
| 9 | 2 | 10 | 114 | 12 | +1 | 48 |
| 10 | 2 | 10 | 120 | 12 | +0 | 60 |
| 11 | 2 | 10 | 126 | 13 | +1 | 65 |
| 12 | 3 | 9 | 132 | 15 | +2 | 75 |
| 13 | 3 | 9 | 138 | 16 | +1 | 80 |
| 14 | 3 | 9 | 144 | 16 | +0 | 80 |
| 15 | 3 | 9 | 150 | 17 | +1 | 102 |
| 16 | 4 | 8 | 356 | **45** | **+28** | **270** |
| 17 | 4 | 8 | 362 | 46 | +1 | 276 |
| 18 | 4 | 8 | 368 | 46 | +0 | 276 |
| 19 | 4 | 8 | 374 | 47 | +1 | 282 |
| 20 | 4 | 8 | 380 | 48 | +1 | 336 |

## K2 — Declared-threshold first-crossings

| metric | threshold | **first-crossing wave** |
|--------|-----------|:----:|
| time_to_kill | `> 8` | **5** (TTK 8→9) |
| incoming_per_kill | `> 120` (player max HP) | **16** (102→270) |

## K3 — Threshold-free spike detection

| metric | spike? | wave | jump | justification |
|--------|:---:|:---:|:---:|---------------|
| time_to_kill | **YES** | **16** | **+28** | 14× the largest non-surge kink (+2 at wave 12); the enemy-hp surge |
| enemy_armor | **NO** | — | — | pure unit-step stair (0,0,0,1,…,4,4,4,4) then flat — no drastic jump |

> The detector must flag the wave-16 envelope spike and must **not** flag the
> small armor-induced kinks (≤+2) nor the regular `enemy_armor` stair-steps.

## K4 — Knob-leverage ranking (one-step perturbation, ΣTTK over domain)

| rank | knob | tunability | Δ(ΣTTK) for +1 | crossover-mover (L4)? |
|:--:|------|-----------|:----:|:----:|
| 1 | **enemy-armor** | engine-default | **+51** | yes (5 → 4) |
| 2 | player-attack | engine-default | −40 | yes (5 → 7) |
| 3 | enemy-attack | engine-default | (0 on TTK; moves incoming_per_kill) | no |
| 4 | **heal-value** | engine-default | **0** | no |
| — | damage-formula (`max(1,…)`) | **structural** | **NOT PROPOSED** | — |

Unambiguous ordering: **enemy-armor > player-attack ≫ heal-value**. The structural
min-damage floor is excluded from perturbation entirely.

## K5 — Tunability framing

- **engine-default** findings read as *"yours to tune — here's the lever"*:
  player-attack (the flat lever to scale), enemy-armor (dominant), enemy-hp (the
  surge), etc.
- **structural** findings read as *engine constraints*: the `max(1, …)` damage
  floor is a property of the combat model, never a tuning knob.

---

## Derivation (self-consistency proof)

```
armor(w)   = min(4, floor(w/4))
dmg(w)     = max(1, 12 - armor(w))
hp(w)      = 60 + 6w + 200*floor(w/16)
ttk(w)     = ceil(hp(w) / dmg(w))
incoming(w)= ttk(w) * (3 + floor(w/5))

TTK>8 first at w=5 (ttk(4)=8 not >8; ttk(5)=9).
incoming>120 first at w=16 (incoming(15)=102; incoming(16)=270).
Δttk series w2..w20 = [0,1,1,1,0,1,1,1,0,1,2,1,0,1,28,1,0,1,1]
  -> single drastic jump +28 at w16; all else ≤+2.  Spike = {w16}.
enemy_armor Δ = [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0] -> unit steps, no spike.
Perturbation (+1, ΣTTK base=399): armor +51, player_attack -40, heal 0.
Crossover wave: base 5; +player_attack -> 7; +armor -> 4; +heal -> 5 (unchanged).
```

Reproduce: see `game-state/` formulas; the Sprint-B engine sweeps them to this table.
